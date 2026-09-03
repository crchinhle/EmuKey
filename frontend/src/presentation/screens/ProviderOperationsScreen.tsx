import { Input, Tabs } from 'antd';
import { useMemo, useState } from 'react';

import {
  jobs,
  providerOrders,
} from '../../infrastructure/workspace/mockWorkspace';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function ProviderOperationsScreen() {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('vi');
  const visibleOrders = useMemo(
    () =>
      providerOrders.filter((order) =>
        `${order.id} ${order.company} ${order.product}`
          .toLocaleLowerCase('vi')
          .includes(normalized),
      ),
    [normalized],
  );
  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) =>
        job.name.toLocaleLowerCase('vi').includes(normalized),
      ),
    [normalized],
  );
  return (
    <>
      <PageHeader
        title="Vận hành"
        description="Theo dõi provisioning, đối soát và các job tích hợp."
      />
      <div className="inline-filter">
        <Input.Search
          aria-label="Tìm dữ liệu vận hành"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm đơn hoặc job"
          value={query}
        />
      </div>
      <section className="workspace-card operations-card">
        <Tabs
          items={[
            {
              key: 'orders',
              label: 'Đơn cần xử lý',
              children: (
                <div className="stack-list">
                  {visibleOrders.map((order) => (
                    <article key={order.id}>
                      <div>
                        <strong>
                          {order.id} · {order.company}
                        </strong>
                        <small>
                          {order.product} · {order.devices} thiết bị
                        </small>
                      </div>
                      <StatusChip tone="warning">
                        {order.statusLabel}
                      </StatusChip>
                    </article>
                  ))}
                </div>
              ),
            },
            {
              key: 'jobs',
              label: 'Integration jobs',
              children: (
                <div className="stack-list">
                  {visibleJobs.map((job) => (
                    <article key={job.id}>
                      <div>
                        <strong>{job.name}</strong>
                        <small>{job.helper}</small>
                      </div>
                      <StatusChip tone={job.tone}>{job.status}</StatusChip>
                    </article>
                  ))}
                </div>
              ),
            },
            {
              key: 'reconcile',
              label: 'Đối soát',
              children: (
                <FactList
                  facts={[
                    { label: 'Giao dịch hôm nay', value: '24' },
                    { label: 'Đã khớp', value: '23' },
                    { label: 'Cần kiểm tra', value: '01' },
                  ]}
                />
              ),
            },
          ]}
        />
      </section>
    </>
  );
}
