import { Alert, Button, Table } from 'antd';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, useAuth } from '../../application/auth/authContext';

import { PageHeader } from '../components/WorkspacePrimitives';

export function SystemConsoleScreen() {
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const permitted = user?.role === 'SYSTEM_ADMIN';
  const accounts = useQuery({ queryKey: ['identity', 'users'], queryFn: async () => { const response = await api('/auth/users'); if (!response.ok) throw new Error('USERS_REQUEST_FAILED'); return response.json() as Promise<Array<{ id: string; email: string; displayName: string; role: string; status: string }>>; }, enabled: permitted });
  const [accountId, setAccountId] = useState<string | null>(null);
  const detail = useQuery({ queryKey: ['identity', 'user', accountId], queryFn: async () => { const response = await api(`/auth/users/${accountId}`); if (!response.ok) throw new Error('USER_DETAIL_FAILED'); return response.json() as Promise<Record<string, unknown>>; }, enabled: permitted && Boolean(accountId) });
  const stateMutation = useMutation({ mutationFn: async ({ id, action }: { id: string; action: 'lock' | 'unlock' | 'disable' }) => { const response = await api(`/auth/users/${id}/${action}`, { method: 'POST', body: JSON.stringify({ reason: 'System console action' }) }); if (!response.ok) throw new Error('ACCOUNT_STATE_FAILED'); }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['identity'] }); } });
  return (
    <>
      <PageHeader
        title="System Console"
        description="Sức khỏe hệ thống, job nền và audit log chỉ đọc."
        action={null}
      />
      <section className="workspace-card section-card"><h2>System operations</h2><p className="muted-copy">Health, audit, notification và reconcile widgets chưa có một API canonical chung trong Phase 1-7; dữ liệu giả đã được ẩn.</p></section>
      <section className="workspace-card table-card spaced-card">
        {new URLSearchParams(location.search).get('view') === 'accounts' ? <>
          {!permitted ? <Alert message="Bạn không có quyền quản lý tài khoản." type="warning" /> : null}
          {accounts.isError ? <Alert message="Không thể tải danh sách tài khoản." type="error" /> : null}
          {stateMutation.isError ? <Alert message="Không thể cập nhật trạng thái tài khoản." type="error" /> : null}
          <Table dataSource={accounts.data ?? []} loading={accounts.isLoading} rowKey="id" onRow={(record) => ({ onClick: () => setAccountId(record.id) })} columns={[{ title: 'Tên', dataIndex: 'displayName' }, { title: 'Email', dataIndex: 'email' }, { title: 'Vai trò', dataIndex: 'role' }, { title: 'Trạng thái', dataIndex: 'status' }, { title: 'Thao tác', render: (_: unknown, record) => <span><Button disabled={!permitted || stateMutation.isPending} onClick={(event) => { event.stopPropagation(); void stateMutation.mutateAsync({ id: record.id, action: record.status === 'LOCKED' ? 'unlock' : 'lock' }); }}>{record.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'}</Button>{record.status !== 'DISABLED' ? <Button danger disabled={!permitted || stateMutation.isPending} onClick={(event) => { event.stopPropagation(); void stateMutation.mutateAsync({ id: record.id, action: 'disable' }); }}>Vô hiệu hóa</Button> : null}</span> }]} />
          {accountId ? <div role="region" aria-label="Chi tiết tài khoản">{detail.isLoading ? <span>Đang tải chi tiết...</span> : detail.isError ? <Alert message="Không thể tải chi tiết tài khoản." type="error" /> : <pre>{JSON.stringify(detail.data, null, 2)}</pre>}</div> : null}
        </> : null}
        <p className="muted-copy">Audit log runtime API chưa được expose cho client này.</p>
      </section>
    </>
  );
}
