import { Alert, Empty, Input, Spin, Tabs } from 'antd';
import { useMemo, useState } from 'react';

import { usePaymentHistory } from '../../application/orders/orderQueries';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function ProviderOperationsScreen() {
  const payments = usePaymentHistory();
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('vi');
  const visibleOrders = useMemo(
    () =>
      (payments.data ?? []).filter((payment) =>
        `${payment.orderNumber} ${payment.productNameSnapshot} ${payment.providerTransactionReference ?? ''}`
          .toLocaleLowerCase('vi')
          .includes(normalized),
      ),
    [normalized, payments.data],
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
              label: 'Đơn hàng & thanh toán',
              children: (
                <div className="stack-list">
                  {payments.isPending ? <Spin aria-label="Đang tải thanh toán" /> : null}
                  {payments.isError ? <Alert showIcon type="error" message="Không thể tải lịch sử thanh toán." /> : null}
                  {!payments.isPending && !payments.isError && visibleOrders.length === 0 ? (
                    <Empty description="Chưa có thanh toán phù hợp." />
                  ) : null}
                  {visibleOrders.map((payment) => (
                    <article key={payment.transactionId}>
                      <div>
                        <strong>
                          {payment.orderNumber} · {payment.orderType === 'RENEWAL' ? 'Gia hạn' : 'Mua mới'}
                        </strong>
                        <small>
                          {payment.productNameSnapshot} · {payment.planNameSnapshot} · {payment.amountVnd.toLocaleString('vi-VN')} ₫
                        </small>
                      </div>
                      <StatusChip tone={payment.classification === 'MATCHED' ? 'success' : 'warning'}>
                        {payment.classification}
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
                  <Empty description="Job integration chưa có API Phase 1-7 cho Provider; đã ẩn dữ liệu giả." />
                </div>
              ),
            },
            {
              key: 'reconcile',
              label: 'Đối soát thanh toán',
              children: (
                <FactList
                  facts={[
                    { label: 'Tổng giao dịch', value: String(payments.data?.length ?? 0) },
                    { label: 'Đã khớp', value: String(payments.data?.filter((payment) => payment.classification === 'MATCHED').length ?? 0) },
                    { label: 'Cần kiểm tra', value: String(payments.data?.filter((payment) => payment.classification !== 'MATCHED').length ?? 0) },
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
