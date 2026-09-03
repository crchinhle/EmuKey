import { Button, Drawer, Input, Select, Table } from 'antd';
import { useMemo, useState } from 'react';

import type { OrderRecord } from '../../domain/workspace';
import {
  filterOrders,
  type OrderStatusFilter,
} from '../../application/workspace/workspaceSelectors';
import { orders } from '../../infrastructure/workspace/mockWorkspace';
import {
  FactList,
  formatMoney,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function BuyerOrdersScreen() {
  const [filter, setFilter] = useState<OrderStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<OrderRecord>();
  const data = useMemo(
    () => filterOrders(orders, query, filter),
    [filter, query],
  );

  return (
    <>
      <PageHeader
        title="Đơn hàng của tôi"
        description="Theo dõi hợp đồng, thanh toán và trạng thái cấp license."
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
                { value: 'awaiting-signature', label: 'Chờ ký' },
                { value: 'awaiting-payment', label: 'Chờ thanh toán' },
                { value: 'complete', label: 'Hoàn tất' },
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
          pagination={false}
          rowKey="id"
          scroll={{ x: 760 }}
          columns={[
            {
              title: 'Mã đơn',
              dataIndex: 'id',
              render: (value: string, record) => (
                <Button type="link" onClick={() => setSelected(record)}>
                  {value}
                </Button>
              ),
            },
            { title: 'Sản phẩm', dataIndex: 'product' },
            { title: 'Gói', dataIndex: 'plan' },
            { title: 'Thiết bị', dataIndex: 'devices' },
            { title: 'Tổng tiền', dataIndex: 'total', render: formatMoney },
            {
              title: 'Trạng thái',
              dataIndex: 'statusLabel',
              render: (value: string, record) => (
                <StatusChip
                  tone={record.status === 'complete' ? 'success' : 'warning'}
                >
                  {value}
                </StatusChip>
              ),
            },
          ]}
        />
      </section>
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        title={`Chi tiết ${selected?.id ?? ''}`}
      >
        {selected ? (
          <FactList
            facts={[
              { label: 'Sản phẩm', value: selected.product },
              { label: 'Gói', value: selected.plan },
              { label: 'Số thiết bị', value: selected.devices },
              { label: 'Tổng thanh toán', value: formatMoney(selected.total) },
              {
                label: 'Trạng thái',
                value: (
                  <StatusChip tone="warning">{selected.statusLabel}</StatusChip>
                ),
              },
            ]}
          />
        ) : null}
      </Drawer>
    </>
  );
}
