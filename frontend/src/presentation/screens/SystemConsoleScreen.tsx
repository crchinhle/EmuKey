import { Alert, Button, Input, Table } from 'antd';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, useAuth } from '../../application/auth/authContext';

import type { AuditEvent } from '../../domain/workspace';
import {
  auditEvents,
  healthMetrics,
  jobs,
} from '../../infrastructure/workspace/mockWorkspace';
import {
  FactList,
  MetricCard,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function SystemConsoleScreen() {
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const permitted = user?.role === 'SYSTEM_ADMIN';
  const accounts = useQuery({ queryKey: ['identity', 'users'], queryFn: async () => { const response = await api('/auth/users'); if (!response.ok) throw new Error('USERS_REQUEST_FAILED'); return response.json() as Promise<Array<{ id: string; email: string; displayName: string; role: string; status: string }>>; }, enabled: permitted });
  const [accountId, setAccountId] = useState<string | null>(null);
  const detail = useQuery({ queryKey: ['identity', 'user', accountId], queryFn: async () => { const response = await api(`/auth/users/${accountId}`); if (!response.ok) throw new Error('USER_DETAIL_FAILED'); return response.json() as Promise<Record<string, unknown>>; }, enabled: permitted && Boolean(accountId) });
  const stateMutation = useMutation({ mutationFn: async ({ id, action }: { id: string; action: 'lock' | 'unlock' | 'disable' }) => { const response = await api(`/auth/users/${id}/${action}`, { method: 'POST', body: JSON.stringify({ reason: 'System console action' }) }); if (!response.ok) throw new Error('ACCOUNT_STATE_FAILED'); }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['identity'] }); } });
  const [selected, setSelected] = useState<AuditEvent>(auditEvents[0]!);
  const [query, setQuery] = useState('');
  const visibleEvents = useMemo(
    () =>
      auditEvents.filter((event) =>
        `${event.action} ${event.actor} ${event.resource}`
          .toLocaleLowerCase('vi')
          .includes(query.trim().toLocaleLowerCase('vi')),
      ),
    [query],
  );
  return (
    <>
      <PageHeader
        title="System Console"
        description="Sức khỏe hệ thống, job nền và audit log chỉ đọc."
        action={<StatusChip tone="error">2 cảnh báo</StatusChip>}
      />
      <section className="metric-grid metric-grid--four">
        {healthMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>
      <div className="system-console-grid">
        <section className="workspace-card operations-card">
          <h2>Integration jobs</h2>
          <div className="stack-list">
            {jobs.map((job) => (
              <article key={job.id}>
                <div>
                  <strong>{job.name}</strong>
                  <small>{job.helper}</small>
                </div>
                <StatusChip tone={job.tone}>{job.status}</StatusChip>
              </article>
            ))}
          </div>
        </section>
        <aside className="workspace-card detail-card">
          <h2>Chi tiết audit</h2>
          <FactList
            facts={[
              { label: 'Hành động', value: selected.action },
              { label: 'Tài nguyên', value: selected.resource },
              { label: 'Actor', value: selected.actor },
              { label: 'Request ID', value: <code>{selected.requestId}</code> },
              { label: 'IP demo', value: selected.ip },
            ]}
          />
        </aside>
      </div>
      <section className="workspace-card table-card spaced-card">
        {new URLSearchParams(location.search).get('view') === 'accounts' ? <>
          {!permitted ? <Alert message="Bạn không có quyền quản lý tài khoản." type="warning" /> : null}
          {accounts.isError ? <Alert message="Không thể tải danh sách tài khoản." type="error" /> : null}
          {stateMutation.isError ? <Alert message="Không thể cập nhật trạng thái tài khoản." type="error" /> : null}
          <Table dataSource={accounts.data ?? []} loading={accounts.isLoading} rowKey="id" onRow={(record) => ({ onClick: () => setAccountId(record.id) })} columns={[{ title: 'Tên', dataIndex: 'displayName' }, { title: 'Email', dataIndex: 'email' }, { title: 'Vai trò', dataIndex: 'role' }, { title: 'Trạng thái', dataIndex: 'status' }, { title: 'Thao tác', render: (_: unknown, record) => <span><Button disabled={!permitted || stateMutation.isPending} onClick={(event) => { event.stopPropagation(); void stateMutation.mutateAsync({ id: record.id, action: record.status === 'LOCKED' ? 'unlock' : 'lock' }); }}>{record.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'}</Button>{record.status !== 'DISABLED' ? <Button danger disabled={!permitted || stateMutation.isPending} onClick={(event) => { event.stopPropagation(); void stateMutation.mutateAsync({ id: record.id, action: 'disable' }); }}>Vô hiệu hóa</Button> : null}</span> }]} />
          {accountId ? <div role="region" aria-label="Chi tiết tài khoản">{detail.isLoading ? <span>Đang tải chi tiết...</span> : detail.isError ? <Alert message="Không thể tải chi tiết tài khoản." type="error" /> : <pre>{JSON.stringify(detail.data, null, 2)}</pre>}</div> : null}
        </> : null}
        <div className="card-heading section-title">
          <h2>Audit Log</h2>
          <Input.Search
            aria-label="Lọc audit log"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm action, actor"
            value={query}
          />
        </div>
        <Table
          dataSource={[...visibleEvents]}
          pagination={false}
          rowKey="id"
          scroll={{ x: 760 }}
          columns={[
            { title: 'Thời gian', dataIndex: 'time' },
            { title: 'Actor', dataIndex: 'actor' },
            {
              title: 'Hành động',
              dataIndex: 'action',
              render: (value: string, record) => (
                <Button type="link" onClick={() => setSelected(record)}>
                  {value}
                </Button>
              ),
            },
            { title: 'Tài nguyên', dataIndex: 'resource' },
            { title: 'IP', dataIndex: 'ip' },
          ]}
        />
      </section>
    </>
  );
}
