import { Pool } from 'pg';

const PRIVATE_COLUMNS = `
  l.id, l.public_license_id, l.origin_order_id, l.status, l.period_start, l.expires_at,
  l.max_active_devices, l.activation_key_version, l.entitlement_version,
  l.created_at, l.updated_at, p.name AS product_name, pl.name AS plan_name,
  pl.version AS plan_version, encode(l.plan_commitment,'hex') AS plan_commitment,
  provider.display_name AS provider_display_name,
  provider.organization_name AS provider_organization_name,
  ce.transaction_hash, ce.block_number, ce.confirmation_count, ce.finality_status`;

export class LicenseProjectionRepository {
  constructor(private readonly pool: Pool) {}

  async listProvider(providerUserId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ${PRIVATE_COLUMNS}
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id
       WHERE l.provider_user_id=$1
       ORDER BY l.created_at DESC`,
      [providerUserId],
    );
    return result.rows.map((row) => this.map(row));
  }

  async listCustomer(customerUserId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ${PRIVATE_COLUMNS}
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id
       WHERE l.customer_user_id=$1
       ORDER BY l.created_at DESC`,
      [customerUserId],
    );
    return result.rows.map((row) => this.map(row));
  }

  async findProvider(providerUserId: string, id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ${PRIVATE_COLUMNS}
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id
       WHERE l.id=$2 AND l.provider_user_id=$1`,
      [providerUserId, id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findCustomer(customerUserId: string, id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ${PRIVATE_COLUMNS}
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id
       WHERE l.id=$2 AND l.customer_user_id=$1`,
      [customerUserId, id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findPublic(publicId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT l.public_license_id, l.status, l.expires_at,
         encode(l.plan_commitment,'hex') AS plan_commitment,
         p.name AS product_name, pl.name AS plan_name, pl.version AS plan_version,
         provider.display_name AS provider_display_name,
         provider.organization_name AS provider_organization_name,
         ce.transaction_hash, ce.block_number, ce.confirmation_count,
         ce.finality_status,
         EXISTS(SELECT 1 FROM chain_commands cc WHERE cc.license_id=l.id
           AND cc.status='SUBMITTED_UNKNOWN') AS projection_stale
       FROM licenses l JOIN products p ON p.id=l.product_id
       JOIN plans pl ON pl.id=l.plan_id JOIN users provider ON provider.id=l.provider_user_id
       LEFT JOIN LATERAL (
         SELECT transaction_hash, block_number, confirmation_count, finality_status
         FROM chain_events WHERE license_id=l.id
         ORDER BY block_number DESC, log_index DESC, observed_at DESC LIMIT 1
       ) ce ON TRUE
       WHERE l.public_license_id=$1`,
      [publicId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const state =
      row.finality_status === 'REORGED'
        ? 'REORGED'
        : row.projection_stale
          ? 'PROJECTION_STALE'
          : row.status === 'PENDING_ONCHAIN'
            ? 'PENDING_ONCHAIN'
            : row.finality_status === 'CONFIRMED'
              ? 'CHAIN_CONFIRMED'
              : 'PROJECTION_STALE';
    return {
      blockNumber: row.block_number === null ? null : Number(row.block_number),
      confirmationCount: Number(row.confirmation_count ?? 0),
      expiresAt: row.expires_at,
      finality: row.finality_status ?? 'PENDING',
      licenseId: row.public_license_id,
      plan: {
        commitment: `0x${String(row.plan_commitment)}`,
        name: row.plan_name,
        version: Number(row.plan_version),
      },
      productName: row.product_name,
      provider: {
        displayName: row.provider_display_name,
        organizationName: row.provider_organization_name,
      },
      state,
      status: String(row.status),
      transactionHash:
        typeof row.transaction_hash === 'string' ? row.transaction_hash : null,
    };
  }

  async activationCommand(customerUserId: string, id: string) {
    const result = await this.pool.query<{
      command_id: string;
      commitment: string;
      key_version: number;
      license_id: string;
    }>(
      `SELECT cc.id AS command_id, l.id AS license_id,
         ('0x' || encode(l.activation_commitment, 'hex')) AS commitment,
         l.activation_key_version AS key_version
       FROM licenses l JOIN chain_commands cc ON cc.license_id=l.id
         AND cc.command_type='ISSUE_LICENSE' AND cc.status='CONFIRMED'
       WHERE l.id=$1 AND l.status='ACTIVE' AND l.customer_user_id=$2`,
      [id, customerUserId],
    );
    return result.rows[0] ?? null;
  }

  private map(row: Record<string, unknown>) {
    return {
      blockNumber: row.block_number === null ? null : Number(row.block_number),
      confirmationCount: Number(row.confirmation_count ?? 0),
      createdAt: row.created_at,
      entitlementVersion: Number(row.entitlement_version),
      expiresAt: row.expires_at,
      finality: row.finality_status ?? 'PENDING',
      id: row.id,
      keyVersion: Number(row.activation_key_version),
      maxActiveDevices: Number(row.max_active_devices),
      originOrderId: String(row.origin_order_id),
      periodStart: row.period_start,
      plan: {
        commitment: `0x${String(row.plan_commitment)}`,
        name: String(row.plan_name),
        version: Number(row.plan_version),
      },
      productName: String(row.product_name),
      provider: {
        displayName: String(row.provider_display_name),
        organizationName:
          typeof row.provider_organization_name === 'string'
            ? row.provider_organization_name
            : null,
      },
      publicLicenseId: String(row.public_license_id),
      status: row.status,
      transactionHash: row.transaction_hash,
      updatedAt: row.updated_at,
    };
  }
}
