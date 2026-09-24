import { Alert, Button, Table } from 'antd';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, useAuth } from '../../application/auth/authContext';
import { useAssistanceHealth, useBlockchainReconciliation, usePlatformReadiness } from '../../application/operations/operationsQueries';
import { usePaymentHistory } from '../../application/orders/orderQueries';
import { NotificationCenter } from '../components/NotificationCenter';

import { PageHeader } from '../components/WorkspacePrimitives';

export function SystemConsoleScreen() {
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const permitted = user?.role === 'SYSTEM_ADMIN';
  const readiness = usePlatformReadiness();
  const assistance = useAssistanceHealth(permitted);
  const payments = usePaymentHistory();
  const reconciliation = useBlockchainReconciliation();
  const view = new URLSearchParams(location.search).get('view');
  const accounts = useQuery({ queryKey: ['identity', 'users'], queryFn: async () => { const response = await api('/auth/users'); if (!response.ok) throw new Error('USERS_REQUEST_FAILED'); return response.json() as Promise<Array<{ id: string; email: string; displayName: string; role: string; status: string }>>; }, enabled: permitted });
  const [accountId, setAccountId] = useState<string | null>(null);
  const detail = useQuery({ queryKey: ['identity', 'user', accountId], queryFn: async () => { const response = await api(`/auth/users/${accountId}`); if (!response.ok) throw new Error('USER_DETAIL_FAILED'); return response.json() as Promise<Record<string, unknown>>; }, enabled: permitted && Boolean(accountId) });
  const stateMutation = useMutation({ mutationFn: async ({ id, action }: { id: string; action: 'lock' | 'unlock' | 'disable' }) => { const response = await api(`/auth/users/${id}/${action}`, { method: 'POST', body: JSON.stringify({ reason: 'System console action' }) }); if (!response.ok) throw new Error('ACCOUNT_STATE_FAILED'); }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['identity'] }); } });
  return (
    <>
      <PageHeader
        title="Giám sát & nhật ký"
        action={<NotificationCenter />}
      />
      <section aria-label="Sức khỏe hệ thống" className="metric-grid metric-grid--four">
        <article className="metric-card"><span className="status-chip status-chip--info">API</span><strong>{readiness.data?.status ?? (readiness.isLoading ? '...' : '—')}</strong><small>Platform readiness</small></article>
        <article className="metric-card"><span className="status-chip status-chip--success">PostgreSQL</span><strong>{readiness.data?.dependencies.postgres ?? '—'}</strong><small>Dependency health</small></article>
        <article className="metric-card"><span className="status-chip status-chip--info">Redis</span><strong>{readiness.data?.dependencies.redis ?? '—'}</strong><small>Dependency health</small></article>
        <article className="metric-card"><span className="status-chip status-chip--warning">Support</span><strong>{assistance.data?.conversations.waitingSupport ?? '—'}</strong><small>Đang chờ hỗ trợ</small></article>
      </section>
      {readiness.isError ? <Alert showIcon type="warning" message="Platform readiness đang degraded hoặc chưa thể truy xuất." /> : null}
      {assistance.isError && permitted ? <Alert showIcon type="warning" message="Không thể tải health của notification/support." /> : null}
      <nav aria-label="Bộ lọc nhật ký" className="system-tabs">
        {[
          ['all', 'Tất cả sự kiện'],
          ['users', 'Người dùng'],
          ['payments', 'Thanh toán'],
          ['blockchain', 'Blockchain'],
        ].map(([value, label]) => (
          <a className={new URLSearchParams(location.search).get('view') === value || (value === 'all' && !new URLSearchParams(location.search).get('view')) ? 'active' : ''} href={value === 'all' ? '/system/console' : `/system/console?view=${value}`} key={value}>{label}</a>
        ))}
      </nav>
      <section className="workspace-card table-card spaced-card">
        {view === 'users' ? <>
          {!permitted ? <Alert message="Bạn không có quyền quản lý tài khoản." type="warning" /> : null}
          {accounts.isError ? <Alert message="Không thể tải danh sách tài khoản." type="error" /> : null}
          {stateMutation.isError ? <Alert message="Không thể cập nhật trạng thái tài khoản." type="error" /> : null}
          <Table dataSource={accounts.data ?? []} loading={accounts.isLoading} rowKey="id" scroll={{ x: 900 }} onRow={(record) => ({ onClick: () => setAccountId(record.id) })} columns={[{ title: 'Tên', dataIndex: 'displayName' }, { title: 'Email', dataIndex: 'email' }, { title: 'Vai trò', dataIndex: 'role' }, { title: 'Trạng thái', dataIndex: 'status' }, { title: 'Thao tác', render: (_: unknown, record) => <span className="table-actions"><Button disabled={!permitted || stateMutation.isPending} onClick={(event) => { event.stopPropagation(); void stateMutation.mutateAsync({ id: record.id, action: record.status === 'LOCKED' ? 'unlock' : 'lock' }); }}>{record.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'}</Button>{record.status !== 'DISABLED' ? <Button danger disabled={!permitted || stateMutation.isPending} onClick={(event) => { event.stopPropagation(); void stateMutation.mutateAsync({ id: record.id, action: 'disable' }); }}>Vô hiệu hóa</Button> : null}</span> }]} />
          {accountId ? <div role="region" aria-label="Chi tiết tài khoản">{detail.isLoading ? <span>Đang tải chi tiết...</span> : detail.isError ? <Alert message="Không thể tải chi tiết tài khoản." type="error" /> : <pre className="json-detail">{JSON.stringify(detail.data, null, 2)}</pre>}</div> : null}
        </> : view === 'payments' ? <>
          {payments.isError ? <Alert type="error" message="Không thể tải lịch sử thanh toán." /> : null}
          <Table dataSource={payments.data ?? []} loading={payments.isLoading} rowKey="transactionId" scroll={{ x: 900 }} columns={[
            { title: 'Mã đơn', dataIndex: 'orderNumber' },
            { title: 'Sản phẩm', dataIndex: 'productNameSnapshot' },
            { title: 'Số tiền', dataIndex: 'amountVnd', render: (value: number) => `${value.toLocaleString('vi-VN')} ₫` },
            { title: 'Phân loại', dataIndex: 'classification' },
          ]} />
        </> : view === 'blockchain' ? <>
          <div className="section-heading"><h2 className="section-title">Blockchain reconciliation</h2><Button loading={reconciliation.isPending} disabled={!permitted} onClick={() => reconciliation.mutate()}>Chạy reconcile</Button></div>
          {reconciliation.isError ? <Alert type="error" message="Không thể chạy blockchain reconciliation." /> : null}
          {reconciliation.data ? <div className="stack-list"><p>Indexed events: {reconciliation.data.indexedEvents}</p><p>Unknown commands: {reconciliation.data.health.unknown_commands}</p><p>Pending events: {reconciliation.data.health.pending_events}</p><p>Projection repairs: {reconciliation.data.projection.licenseRepairs + reconciliation.data.projection.commandRepairs}</p></div> : <div className="empty-state"><strong>Chưa chạy reconciliation</strong><p>Thao tác này yêu cầu quyền System Admin và sẽ gọi API backend thật.</p></div>}
        </> : <div className="empty-state"><strong>Chưa có sự kiện mẫu</strong><p>Audit log runtime API chưa được expose cho client này.</p></div>}
      </section>
    </>
  );
}
