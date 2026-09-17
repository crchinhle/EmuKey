import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';

import { AuditWriter } from '../../../platform/audit/audit-writer.js';

export type ChainEventType =
  | 'LICENSE_ISSUED'
  | 'LICENSE_RENEWED'
  | 'LICENSE_SUSPENDED'
  | 'LICENSE_RESUMED'
  | 'LICENSE_REVOKED'
  | 'KEY_ROTATED'
  | 'DEVICE_ACTIVATED'
  | 'DEVICE_REVOKED';

export interface ObservedChainEvent {
  blockHash: string;
  blockNumber: number;
  chainCommandId: string;
  chainId: number;
  confirmationCount: number;
  contractAddress: string;
  eventType: ChainEventType;
  licenseDeviceId?: string;
  licenseId: string;
  logIndex: number;
  network: string;
  payload: Record<string, unknown>;
  providerUserId: string;
  transactionHash: string;
}

export interface CanonicalProjectionRepairReport {
  commandRepairs: number;
  licenseIds: string[];
  licenseRepairs: number;
  remainingMismatches: number;
}

export class ChainEventRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit = new AuditWriter(),
  ) {}

  async ingest(
    event: ObservedChainEvent,
  ): Promise<{ created: boolean; id: string }> {
    return this.transaction(async (client) => {
      const id = randomUUID();
      const inserted = await client.query<{ created: boolean; id: string }>(
        `INSERT INTO chain_events
          (id, chain_command_id, event_type, provider_user_id, license_id,
           license_device_id, network, chain_id, contract_address,
           transaction_hash, log_index, block_number, block_hash,
           confirmation_count, payload, observed_at)
         SELECT $1::uuid,$2::uuid,$3::varchar,$4::uuid,$5::uuid,$6::uuid,
                $7::varchar,$8::bigint,$9::varchar,$10::varchar,$11::int,
                $12::bigint,$13::varchar,$14::int,$15::jsonb,now()
         FROM chain_commands command
         WHERE command.id=$2
           AND command.provider_user_id=$4
           AND command.license_id=$5
           AND command.license_device_id IS NOT DISTINCT FROM $6::uuid
           AND command.network=$7
           AND command.chain_id=$8
           AND lower(command.contract_address)=lower($9)
           AND lower(command.transaction_hash)=lower($10)
           AND command.status IN ('SUBMITTED','SUBMITTED_UNKNOWN','CONFIRMED')
           AND (command.command_type, $3::varchar) IN (
             ('ISSUE_LICENSE','LICENSE_ISSUED'),
             ('RENEW_LICENSE','LICENSE_RENEWED'),
             ('SUSPEND_LICENSE','LICENSE_SUSPENDED'),
             ('RESUME_LICENSE','LICENSE_RESUMED'),
             ('REVOKE_LICENSE','LICENSE_REVOKED'),
             ('ROTATE_KEY','KEY_ROTATED'),
             ('ACTIVATE_DEVICE','DEVICE_ACTIVATED'),
             ('REVOKE_DEVICE','DEVICE_REVOKED')
           )
         ON CONFLICT (network, chain_id, contract_address, transaction_hash, log_index)
         DO UPDATE SET block_number=EXCLUDED.block_number,
           block_hash=EXCLUDED.block_hash,
           confirmation_count=EXCLUDED.confirmation_count,
           finality_status='PENDING', observed_at=EXCLUDED.observed_at,
           finalized_at=NULL, reorged_at=NULL, updated_at=now()
         WHERE chain_events.finality_status='REORGED'
         RETURNING id, (xmax = 0) AS created`,
        [
          id,
          event.chainCommandId,
          event.eventType,
          event.providerUserId,
          event.licenseId,
          event.licenseDeviceId ?? null,
          event.network,
          event.chainId,
          event.contractAddress,
          event.transactionHash,
          event.logIndex,
          event.blockNumber,
          event.blockHash,
          event.confirmationCount,
          JSON.stringify(event.payload),
        ],
      );
      if (inserted.rows[0]) {
        return {
          created: inserted.rows[0].created === true,
          id: inserted.rows[0].id,
        };
      }
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM chain_events WHERE network=$1 AND chain_id=$2
           AND contract_address=$3 AND transaction_hash=$4 AND log_index=$5`,
        [
          event.network,
          event.chainId,
          event.contractAddress,
          event.transactionHash,
          event.logIndex,
        ],
      );
      if (!existing.rows[0]) throw new Error('CHAIN_EVENT_COMMAND_MISMATCH');
      return { created: false, id: existing.rows[0].id };
    });
  }

  async confirm(
    eventId: string,
    confirmations: number,
    canonicalBlockHash: string,
  ): Promise<boolean> {
    return this.transaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `UPDATE chain_events SET finality_status='CONFIRMED',
           confirmation_count=GREATEST(confirmation_count,$2), finalized_at=now(),
           reorged_at=NULL, updated_at=now()
         WHERE id=$1 AND finality_status = 'PENDING' AND block_hash=$3
         RETURNING *`,
        [eventId, confirmations, canonicalBlockHash],
      );
      const event = result.rows[0];
      if (!event) {
        const existing = await client.query(
          `UPDATE chain_events
           SET confirmation_count=GREATEST(confirmation_count,$2), updated_at=now()
           WHERE id=$1 AND finality_status='CONFIRMED' AND block_hash=$3
           RETURNING id`,
          [eventId, confirmations, canonicalBlockHash],
        );
        return existing.rows[0] !== undefined;
      }
      await this.applyEvent(client, event);
      await client.query(
        `UPDATE chain_commands SET status='CONFIRMED', confirmed_at=now(),
           locked_by=NULL, locked_at=NULL, updated_at=now() WHERE id=$1`,
        [event.chain_command_id],
      );
      await this.audit.write(client, {
        action: 'CHAIN_EVENT_CONFIRMED',
        metadata: {
          blockHash: event.block_hash,
          blockNumber: Number(event.block_number),
          confirmations,
          transactionHash: event.transaction_hash,
        },
        targetId: eventId,
        targetType: 'CHAIN_EVENT',
      });
      return true;
    });
  }

  async markReorged(eventId: string): Promise<void> {
    await this.transaction(async (client) => {
      const event = await client.query<Record<string, unknown>>(
        `UPDATE chain_events SET finality_status='REORGED', reorged_at=now(),
           finalized_at=NULL, updated_at=now()
         WHERE id=$1 AND finality_status <> 'REORGED' RETURNING *`,
        [eventId],
      );
      const row = event.rows[0];
      if (!row) return;
      await client.query(
        `UPDATE chain_commands SET status='SUBMITTED_UNKNOWN', confirmed_at=NULL,
           updated_at=now() WHERE id=$1`,
        [row.chain_command_id],
      );
      await this.rebuildProjection(client, String(row.license_id));
      await this.audit.write(client, {
        action: 'CHAIN_EVENT_REORGED',
        metadata: {
          blockHash: row.block_hash,
          blockNumber: Number(row.block_number),
          transactionHash: row.transaction_hash,
        },
        targetId: eventId,
        targetType: 'CHAIN_EVENT',
      });
    });
  }

  async reconcileCanonicalProjections(
    limit = 100,
  ): Promise<CanonicalProjectionRepairReport> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error('INVALID_RECONCILIATION_LIMIT');
    }
    return this.transaction(async (client) => {
      const locked = await client.query<{ acquired: boolean }>(
        `SELECT pg_try_advisory_xact_lock(
           hashtextextended('emukey.blockchain-projection-reconcile', 0)
         ) AS acquired`,
      );
      if (locked.rows[0]?.acquired !== true) {
        return {
          commandRepairs: 0,
          licenseIds: [],
          licenseRepairs: 0,
          remainingMismatches: 0,
        };
      }

      const confirmedCommands = await client.query<{ id: string }>(
        `WITH canonical AS (
           SELECT DISTINCT ON (event.chain_command_id)
             event.chain_command_id, event.finalized_at
           FROM chain_events event
           WHERE event.finality_status='CONFIRMED'
           ORDER BY event.chain_command_id, event.block_number DESC,
             event.log_index DESC
         )
         UPDATE chain_commands command
         SET status='CONFIRMED',
             confirmed_at=COALESCE(command.confirmed_at, canonical.finalized_at),
             locked_by=NULL, locked_at=NULL, last_error=NULL, updated_at=now()
         FROM canonical
         WHERE command.id=canonical.chain_command_id
           AND command.status <> 'CONFIRMED'
         RETURNING command.id`,
      );
      const orphanedCommands = await client.query<{ id: string }>(
        `UPDATE chain_commands command
         SET status='SUBMITTED_UNKNOWN', confirmed_at=NULL,
             locked_by=NULL, locked_at=NULL,
             last_error='Confirmed projection has no canonical event',
             updated_at=now()
         WHERE command.status='CONFIRMED'
           AND NOT EXISTS (
             SELECT 1 FROM chain_events event
             WHERE event.chain_command_id=command.id
               AND event.finality_status='CONFIRMED'
           )
         RETURNING command.id`,
      );

      const candidates = await this.projectionMismatches(client, limit);
      for (const { id } of candidates) {
        await this.rebuildProjection(client, id);
      }
      const remaining = await this.projectionMismatches(client, 1);

      return {
        commandRepairs:
          (confirmedCommands.rowCount ?? 0) + (orphanedCommands.rowCount ?? 0),
        licenseIds: candidates.map(({ id }) => id),
        licenseRepairs: candidates.length,
        remainingMismatches: remaining.length,
      };
    });
  }

  async deriveExpiredFromCanonicalChain(): Promise<string[]> {
    return this.transaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `UPDATE licenses l
         SET status='EXPIRED', status_reason='ONCHAIN_EXPIRY', updated_at=now()
         WHERE l.status='ACTIVE' AND l.expires_at <= now()
           AND EXISTS (
             SELECT 1 FROM chain_events event
             WHERE event.id=l.last_applied_chain_event_id
               AND event.license_id=l.id
               AND event.finality_status='CONFIRMED'
           )
         RETURNING l.id`,
      );
      return result.rows.map(({ id }) => id);
    });
  }

  private async applyEvent(
    client: PoolClient,
    event: Record<string, unknown>,
  ): Promise<void> {
    const id = String(event.id);
    const licenseId = String(event.license_id);
    const payload = event.payload as Record<string, unknown>;
    switch (event.event_type as ChainEventType) {
      case 'LICENSE_ISSUED':
        await client.query(
          `UPDATE licenses SET status='ACTIVE', last_applied_chain_event_id=$2,
             updated_at=now() WHERE id=$1 AND status='PENDING_ONCHAIN'`,
          [licenseId, id],
        );
        break;
      case 'LICENSE_RENEWED':
        await client.query(
          `UPDATE licenses SET expires_at=$2,
              status=CASE WHEN status='EXPIRED' THEN 'ACTIVE' ELSE status END,
              entitlement_version=entitlement_version + 1,
              last_applied_chain_event_id=$3, updated_at=now()
           WHERE id=$1 AND status <> 'PENDING_ONCHAIN'`,
          [licenseId, payload.expiresAt, id],
        );
        break;
      case 'LICENSE_SUSPENDED':
        await client.query(
          `UPDATE licenses SET status='SUSPENDED', suspended_at=$3,
              entitlement_version=entitlement_version + 1,
             last_applied_chain_event_id=$2, updated_at=now()
           WHERE id=$1 AND status <> 'PENDING_ONCHAIN'`,
          [licenseId, id, event.finalized_at ?? event.observed_at],
        );
        break;
      case 'LICENSE_RESUMED':
        await client.query(
          `UPDATE licenses SET status='ACTIVE', suspended_at=NULL,
              entitlement_version=entitlement_version + 1,
             last_applied_chain_event_id=$2, updated_at=now()
           WHERE id=$1 AND status <> 'PENDING_ONCHAIN'`,
          [licenseId, id],
        );
        break;
      case 'LICENSE_REVOKED':
        await client.query(
          `UPDATE licenses SET status='REVOKED', revoked_at=$3,
              entitlement_version=entitlement_version + 1,
             last_applied_chain_event_id=$2, updated_at=now()
           WHERE id=$1 AND status <> 'PENDING_ONCHAIN'`,
          [licenseId, id, event.finalized_at ?? event.observed_at],
        );
        break;
      case 'KEY_ROTATED':
        await client.query(
          `UPDATE licenses SET activation_commitment=decode($2,'hex'),
              activation_key_version=$3, pending_activation_commitment=NULL,
              pending_activation_key_version=NULL, entitlement_version=entitlement_version + 1,
              last_applied_chain_event_id=$4,
             updated_at=now() WHERE id=$1 AND status <> 'PENDING_ONCHAIN'`,
          [
            licenseId,
            String(payload.activationCommitment).replace(/^0x/, ''),
            payload.keyVersion,
            id,
          ],
        );
        break;
      case 'DEVICE_ACTIVATED':
      case 'DEVICE_REVOKED': {
        const active = event.event_type === 'DEVICE_ACTIVATED';
        await client.query(
          `UPDATE license_devices SET status=$2::varchar,
             activated_at=CASE WHEN $2::varchar='ACTIVE' THEN $4 ELSE activated_at END,
             revoked_at=CASE WHEN $2::varchar='REVOKED' THEN $4 ELSE NULL END,
             last_applied_chain_event_id=$3, updated_at=now()
           WHERE id=$1 AND EXISTS (
             SELECT 1 FROM licenses l
             WHERE l.id=license_devices.license_id
               AND l.status <> 'PENDING_ONCHAIN'
           )`,
          [
            event.license_device_id,
            active ? 'ACTIVE' : 'REVOKED',
            id,
            event.finalized_at ?? event.observed_at,
          ],
        );
        break;
      }
    }
  }

  private async rebuildProjection(
    client: PoolClient,
    licenseId: string,
  ): Promise<void> {
    const events = await client.query<Record<string, unknown>>(
      `SELECT * FROM chain_events WHERE license_id=$1 AND finality_status='CONFIRMED'
       ORDER BY block_number, log_index, id`,
      [licenseId],
    );
      await client.query(
        `UPDATE licenses l SET status='PENDING_ONCHAIN', suspended_at=NULL,
          revoked_at=NULL, last_applied_chain_event_id=NULL,
          pending_activation_commitment=NULL, pending_activation_key_version=NULL,
          entitlement_version=1,
         expires_at=(issue.payload->>'expiresAt')::timestamptz,
         activation_commitment=decode(
           replace(issue.payload->>'activationCommitment','0x',''), 'hex'
         ),
         activation_key_version=(issue.payload->>'keyVersion')::int,
         updated_at=now()
       FROM chain_commands issue
       WHERE l.id=$1 AND issue.license_id=l.id
         AND issue.command_type='ISSUE_LICENSE'`,
      [licenseId],
    );
    await client.query(
      `UPDATE license_devices
       SET status='PENDING_ONCHAIN', last_applied_chain_event_id=NULL,
           activated_at=NULL, revoked_at=NULL, updated_at=now()
       WHERE license_id=$1`,
      [licenseId],
    );
    for (const event of events.rows) await this.applyEvent(client, event);
    await client.query(
      `UPDATE licenses
       SET status='EXPIRED', status_reason='ONCHAIN_EXPIRY', updated_at=now()
       WHERE id=$1 AND status='ACTIVE' AND expires_at <= now()
         AND last_applied_chain_event_id IS NOT NULL`,
      [licenseId],
    );
  }

  private async projectionMismatches(
    client: PoolClient,
    limit: number,
  ): Promise<Array<{ id: string }>> {
    const result = await client.query<{ id: string }>(
      `SELECT license.id
       FROM licenses license
       JOIN LATERAL (
         SELECT command.payload
         FROM chain_commands command
         WHERE command.license_id=license.id
           AND command.command_type='ISSUE_LICENSE'
         ORDER BY command.created_at, command.id
         LIMIT 1
       ) issue ON TRUE
       LEFT JOIN LATERAL (
         SELECT event.id, event.event_type, event.finalized_at, event.observed_at
         FROM chain_events event
         WHERE event.license_id=license.id
           AND event.finality_status='CONFIRMED'
           AND event.event_type IN (
             'LICENSE_ISSUED','LICENSE_SUSPENDED','LICENSE_RESUMED','LICENSE_REVOKED'
           )
         ORDER BY event.block_number DESC, event.log_index DESC, event.id DESC
         LIMIT 1
       ) status_event ON TRUE
       LEFT JOIN LATERAL (
         SELECT event.payload
         FROM chain_events event
         WHERE event.license_id=license.id
           AND event.finality_status='CONFIRMED'
           AND event.event_type='LICENSE_RENEWED'
         ORDER BY event.block_number DESC, event.log_index DESC, event.id DESC
         LIMIT 1
       ) renewal_event ON TRUE
       LEFT JOIN LATERAL (
         SELECT event.payload
         FROM chain_events event
         WHERE event.license_id=license.id
           AND event.finality_status='CONFIRMED'
           AND event.event_type='KEY_ROTATED'
         ORDER BY event.block_number DESC, event.log_index DESC, event.id DESC
         LIMIT 1
       ) key_event ON TRUE
       LEFT JOIN LATERAL (
         SELECT event.id
         FROM chain_events event
         WHERE event.license_id=license.id
           AND event.finality_status='CONFIRMED'
           AND event.event_type NOT IN ('DEVICE_ACTIVATED','DEVICE_REVOKED')
         ORDER BY event.block_number DESC, event.log_index DESC, event.id DESC
         LIMIT 1
       ) last_event ON TRUE
          WHERE license.status IS DISTINCT FROM CASE status_event.event_type
            WHEN 'LICENSE_ISSUED' THEN CASE WHEN COALESCE(
              (renewal_event.payload->>'expiresAt')::timestamptz,
              (issue.payload->>'expiresAt')::timestamptz
            ) <= now() THEN 'EXPIRED' ELSE 'ACTIVE' END
            WHEN 'LICENSE_SUSPENDED' THEN 'SUSPENDED'
            WHEN 'LICENSE_RESUMED' THEN CASE WHEN COALESCE(
              (renewal_event.payload->>'expiresAt')::timestamptz,
              (issue.payload->>'expiresAt')::timestamptz
            ) <= now() THEN 'EXPIRED' ELSE 'ACTIVE' END
           WHEN 'LICENSE_REVOKED' THEN 'REVOKED'
             ELSE 'PENDING_ONCHAIN'
          END
         OR license.expires_at IS DISTINCT FROM COALESCE(
           (renewal_event.payload->>'expiresAt')::timestamptz,
           (issue.payload->>'expiresAt')::timestamptz
         )
         OR license.activation_key_version IS DISTINCT FROM COALESCE(
           (key_event.payload->>'keyVersion')::int,
           (issue.payload->>'keyVersion')::int
         )
         OR license.activation_commitment IS DISTINCT FROM decode(replace(
           COALESCE(
             key_event.payload->>'activationCommitment',
             issue.payload->>'activationCommitment'
           ), '0x', ''
         ), 'hex')
         OR license.last_applied_chain_event_id IS DISTINCT FROM last_event.id
         OR license.suspended_at IS DISTINCT FROM CASE
           WHEN status_event.event_type='LICENSE_SUSPENDED'
             THEN COALESCE(status_event.finalized_at, status_event.observed_at)
           ELSE NULL
         END
         OR license.revoked_at IS DISTINCT FROM CASE
           WHEN status_event.event_type='LICENSE_REVOKED'
             THEN COALESCE(status_event.finalized_at, status_event.observed_at)
           ELSE NULL
         END
         OR EXISTS (
           SELECT 1
           FROM license_devices device
           LEFT JOIN LATERAL (
             SELECT event.id, event.event_type
             FROM chain_events event
             WHERE event.license_device_id=device.id
               AND event.finality_status='CONFIRMED'
               AND event.event_type IN ('DEVICE_ACTIVATED','DEVICE_REVOKED')
             ORDER BY event.block_number DESC, event.log_index DESC, event.id DESC
             LIMIT 1
           ) device_event ON TRUE
           WHERE device.license_id=license.id
             AND (
               device.status IS DISTINCT FROM CASE device_event.event_type
                 WHEN 'DEVICE_ACTIVATED' THEN 'ACTIVE'
                 WHEN 'DEVICE_REVOKED' THEN 'REVOKED'
                 ELSE 'PENDING_ONCHAIN'
               END
               OR device.last_applied_chain_event_id IS DISTINCT FROM device_event.id
             )
         )
       ORDER BY license.updated_at, license.id
       LIMIT $1
       FOR UPDATE OF license SKIP LOCKED`,
      [limit],
    );
    return result.rows;
  }

  private async transaction<T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await work(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
