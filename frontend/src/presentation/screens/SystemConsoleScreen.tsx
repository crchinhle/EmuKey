import { Button, Input, Table } from 'antd';
import { useMemo, useState } from 'react';

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
