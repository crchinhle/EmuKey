import {
  Alert,
  Button,
  Drawer,
  Empty,
  Input,
  Result,
  Select,
  Spin,
  Table,
} from 'antd';
import { useMemo, useState } from 'react';

import { describeApiError } from '../../application/auth/authContext';
import {
  useOrder,
  useOrderMutations,
  useOrders,
  orderStatusLabel,
  orderStatusTone,
} from '../../application/orders/orderQueries';
import {
  FactList,
  formatMoney,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function BuyerOrdersScreen() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const { data: orders, isLoading, isError, error } = useOrders();
  const detailQuery = useOrder(selectedId ?? '');
  const mutations = useOrderMutations();
  const data = useMemo(
    () =>
      (orders ?? []).filter((order) => {
        const matchesQuery = `${order.orderNumber} ${order.planId}`
          .toLocaleLowerCase('vi')
          .includes(query.trim().toLocaleLowerCase('vi'));
        const matchesFilter =
          filter === 'all' ||
          (filter === 'awaiting-payment' &&
            order.orderStatus === 'WAITING_PAYMENT') ||
          (filter === 'complete' && order.orderStatus === 'PAYMENT_ACCEPTED');
        return matchesQuery && matchesFilter;
      }),
    [filter, orders, query],
  );

  if (isLoading) return <Spin aria-label="Đang tải đơn hàng" />;
  if (isError)
    return (
      <Result
        status="error"
        title="Không thể tải đơn hàng"
        subTitle={describeApiError(
          error,
          'Lịch sử đơn hàng đang tạm thời không khả dụng.',
        )}
      />
    );

  return (
    <>
      <PageHeader
        title="Đơn hàng của tôi"
        description="Theo dõi đơn hàng, thanh toán và trạng thái cấp license."
        action={
          <div className="filter-bar">
            <Input.Search
              aria-label="Tìm đơn hàng"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã đơn, sản phẩm"
              value={query}
            />
            <Select
              aria-label="Lọc trạng thái đơn hàng"
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'awaiting-payment', label: 'Chờ thanh toán' },
                { value: 'complete', label: 'Đã nhận thanh toán' },
              ]}
              value={filter}
            />
          </div>
        }
      />
      <section
        className="workspace-card table-card"
        aria-label="Danh sách đơn hàng"
      >
        <Table
          dataSource={[...data]}
          locale={{
            emptyText: <Empty description="Bạn chưa có đơn hàng nào." />,
          }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 760 }}
          columns={[
            {
              title: 'Mã đơn',
              dataIndex: 'orderNumber',
              render: (value: string, record) => (
                <Button type="link" onClick={() => setSelectedId(record.id)}>
                  {value}
                </Button>
              ),
            },
            { title: 'Gói', dataIndex: 'planId' },
            {
              title: 'Tổng tiền',
              dataIndex: 'priceVndSnapshot',
              render: formatMoney,
            },
            {
              title: 'Trạng thái',
              render: (_, record) => (
                <StatusChip tone={orderStatusTone(record)}>
                  {orderStatusLabel(record)}
                </StatusChip>
              ),
            },
          ]}
        />
      </section>
      <Drawer
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(undefined)}
        motion={{ motionName: '' }}
        title={`Chi tiết ${detailQuery.data?.orderNumber ?? ''}`}
      >
        {detailQuery.isLoading ? (
          <Spin aria-label="Đang tải chi tiết đơn hàng" />
        ) : detailQuery.isError ? (
          <Alert
            type="error"
            message={describeApiError(
              detailQuery.error,
              'Không thể tải chi tiết đơn hàng.',
            )}
          />
        ) : detailQuery.data ? (
          <FactList
            facts={[
              {
                label: 'Sản phẩm',
                value: detailQuery.data.productNameSnapshot,
              },
              { label: 'Gói', value: detailQuery.data.planNameSnapshot },
              {
                label: 'Tổng thanh toán',
                value: formatMoney(detailQuery.data.priceVndSnapshot),
              },
              {
                label: 'Trạng thái',
                value: (
                  <StatusChip tone={orderStatusTone(detailQuery.data)}>
                    {orderStatusLabel(detailQuery.data)}
                  </StatusChip>
                ),
              },
              {
                label: 'Hạn thanh toán',
                value: new Date(detailQuery.data.paymentDueAt).toLocaleString(
                  'vi-VN',
                ),
              },
            ]}
          />
        ) : null}
        {detailQuery.data?.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ||
        detailQuery.data?.orderStatus === 'WAITING_PAYMENT' ? (
          <Button
            danger
            loading={mutations.cancel.isPending}
            onClick={() => mutations.cancel.mutate(detailQuery.data!.id)}
          >
            Hủy đơn
          </Button>
        ) : null}
      </Drawer>
    </>
  );
}
