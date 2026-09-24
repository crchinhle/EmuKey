import { Alert, Button, Empty, Input, Popconfirm, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';

import { useLicenseLifecycle, usePhase6Command, useProviderLicenses } from '../../application/licenses/licenseQueries';
import { PageHeader, StatusChip } from '../components/WorkspacePrimitives';

export function ProviderLicensesScreen() {
  const licenses = useProviderLicenses();
  const lifecycle = useLicenseLifecycle();
  const [reason, setReason] = useState('');
  const [command, setCommand] = useState<{ commandId: string; status: string } | null>(null);
  const commandStatus = usePhase6Command(command?.commandId);
  const refreshedCommand = useRef<string | null>(null);

  useEffect(() => {
    if (
      commandStatus.data?.status === 'CONFIRMED' &&
      refreshedCommand.current !== commandStatus.data.commandId
    ) {
      refreshedCommand.current = commandStatus.data.commandId;
      void licenses.refetch();
    }
  }, [commandStatus.data?.status, licenses]);

  const run = (licenseId: string, action: 'SUSPEND_LICENSE' | 'RESUME_LICENSE' | 'REVOKE_LICENSE') => {
    const note = reason.trim();
    void lifecycle.mutateAsync({ licenseId, command: action, ...(note ? { reason: note } : {}) })
      .then(setCommand)
      .catch(() => undefined);
  };

  return (
    <>
      <PageHeader title="Bản quyền Provider" />
      {licenses.isPending ? <Spin aria-label="Đang tải license của nhà cung cấp" /> : null}
      {licenses.isError ? <Alert showIcon type="error" message="Không thể tải danh sách license." action={<Button onClick={() => void licenses.refetch()}>Thử lại</Button>} /> : null}
      {lifecycle.error ? <Alert showIcon type="error" message="Không thể gửi lifecycle command." description="Kiểm tra trạng thái license và thử lại." /> : null}
      {command ? <Alert showIcon type={commandStatus.data?.status === 'CONFIRMED' ? 'success' : commandStatus.data?.status === 'DEAD_LETTER' ? 'error' : 'info'} message={`Command ${commandStatus.data?.status ?? command.status}: ${command.commandId}`} description={commandStatus.data?.transactionHash ? `Transaction: ${commandStatus.data.transactionHash}` : 'Projection sẽ đổi trạng thái sau khi transaction đạt finality.'} /> : null}
      <Input aria-label="Lý do thay đổi trạng thái license" onChange={(event) => setReason(event.target.value)} placeholder="Lý do (không bắt buộc)" value={reason} />
      {!licenses.isPending && !licenses.isError && licenses.data?.length === 0 ? <Empty description="Chưa có license." /> : null}
      <div className="stack-list">
        {(licenses.data ?? []).map((license) => (
          <article className="workspace-card" key={license.id}>
            <div>
              <strong>{license.productName} · {license.publicLicenseId}</strong>
              <small>{license.plan.name} v{license.plan.version} · hết hạn {new Date(license.expiresAt).toLocaleDateString('vi-VN')}</small>
              <small>Finality: {license.finality} ({license.confirmationCount})</small>
            </div>
            <StatusChip tone={license.status === 'ACTIVE' ? 'success' : license.status === 'REVOKED' ? 'error' : 'warning'}>{license.status}</StatusChip>
            <div className="table-actions">
              {license.status === 'ACTIVE' ? <Button loading={lifecycle.isPending} onClick={() => run(license.id, 'SUSPEND_LICENSE')}>Suspend</Button> : null}
              {license.status === 'SUSPENDED' ? <Button loading={lifecycle.isPending} onClick={() => run(license.id, 'RESUME_LICENSE')}>Resume</Button> : null}
              {license.status === 'ACTIVE' || license.status === 'SUSPENDED' ? (
                <Popconfirm description="Thao tác revoke license không thể hoàn tác." onConfirm={() => run(license.id, 'REVOKE_LICENSE')} title="Thu hồi license?">
                  <Button danger loading={lifecycle.isPending}>Revoke</Button>
                </Popconfirm>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
