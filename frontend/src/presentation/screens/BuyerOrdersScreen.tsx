import { Alert, Button, Drawer, Empty, Input, Popconfirm, Result, Select, Spin } from 'antd';
import { useMemo, useState } from 'react';

import { describeApiError, useOptionalAuth } from '../../application/auth/authContext';
import { useOrder, useOrderMutations, useOrders } from '../../application/orders/orderQueries';
import { formatMoney, FactList, StatusChip } from '../components/WorkspacePrimitives';

type OrderTab = 'all' | 'sign' | 'payment' | 'complete';

function tableStatus(orderStatus: string): { label: string; tone: 'warning' | 'success' | 'info' } {
  if (orderStatus === 'WAITING_PAYMENT') return { label: 'Chờ thanh toán', tone: 'warning' };
  if (orderStatus === 'PAYMENT_ACCEPTED') return { label: 'Hoàn tất', tone: 'success' };
  return { label: 'Chờ ký', tone: 'info' };
}

function matchesTab(status: string, tab: OrderTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'sign') return status === 'WAITING_SERVICE_TERMS_ACCEPTANCE';
  if (tab === 'payment') return status === 'WAITING_PAYMENT';
  return status === 'PAYMENT_ACCEPTED';
}

function downloadOrdersCsv(orders: readonly { orderNumber: string; productNameSnapshot: string; priceVndSnapshot: number; orderStatus: string }[]) {
  const rows = [
    ['Mã đơn', 'Sản phẩm / gói', 'Thành tiền', 'Trạng thái'],
    ...orders.map((order) => [order.orderNumber, order.productNameSnapshot, String(order.priceVndSnapshot), tableStatus(order.orderStatus).label]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'emukey-orders.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BuyerOrdersScreen() {
  const auth = useOptionalAuth();
  const [tab, setTab] = useState<OrderTab>('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string>();
  const ordersQuery = useOrders();
  const detailQuery = useOrder(selectedId ?? '');
  const mutations = useOrderMutations();
  const orders = ordersQuery.data ?? [];
  const data = useMemo(() => orders.filter((order) => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    const matchesSearch = !normalized || `${order.orderNumber} ${order.productNameSnapshot} ${order.planNameSnapshot}`.toLocaleLowerCase('vi').includes(normalized);
    const matchesStatus = status === 'all' || order.orderStatus === status;
    return matchesSearch && matchesStatus && matchesTab(order.orderStatus, tab);
  }), [orders, query, status, tab]);
  const customerName = auth?.user?.displayName ?? 'Minh An';

  if (ordersQuery.isLoading) return <Spin aria-label="Đang tải đơn hàng" />;
  if (ordersQuery.isError) return <Result status="error" title="Không thể tải đơn hàng" subTitle={describeApiError(ordersQuery.error, 'Lịch sử đơn hàng đang tạm thời không khả dụng.')} />;

  return (
    <div className="buyer-orders-screen">

      <main className="buyer-orders-main">
        <header className="buyer-orders-title">
          <h1>Đơn hàng của tôi</h1>
          <p>Tra cứu đơn hàng, thanh toán và trạng thái cấp bản quyền.</p>
        </header>
        <nav aria-label="Bộ lọc đơn hàng" className="buyer-orders-tabs">
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')} type="button">Tất cả {orders.length}</button>
          <button className={tab === 'sign' ? 'active' : ''} onClick={() => setTab('sign')} type="button">Chờ ký</button>
          <button className={tab === 'payment' ? 'active' : ''} onClick={() => setTab('payment')} type="button">Chờ thanh toán</button>
          <button className={tab === 'complete' ? 'active' : ''} onClick={() => setTab('complete')} type="button">Hoàn tất</button>
        </nav>
        <section aria-label="Công cụ đơn hàng" className="buyer-orders-toolbar">
          <Input aria-label="Tìm đơn hàng" onChange={(event) => setQuery(event.target.value)} placeholder="Mã đơn hoặc sản phẩm" value={query} />
          <Select aria-label="Lọc trạng thái đơn hàng" onChange={setStatus} options={[{ label: 'Tất cả', value: 'all' }, { label: 'Chờ thanh toán', value: 'WAITING_PAYMENT' }, { label: 'Hoàn tất', value: 'PAYMENT_ACCEPTED' }]} value={status} />
          <Select aria-label="Lọc thời gian" defaultValue="6-months" options={[{ label: '6 tháng gần đây', value: '6-months' }]} />
          <Button onClick={() => downloadOrdersCsv(data)}>Xuất CSV</Button>
        </section>
        <section aria-label="Danh sách đơn hàng" className="buyer-orders-table-wrap">
          <table className="buyer-orders-table">
            <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm / gói</th><th>Thành tiền</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
            <tbody>
              {data.map((order) => {
                const state = tableStatus(order.orderStatus);
                return <tr key={order.id}>
                  <td><button className="buyer-orders-id" onClick={() => setSelectedId(order.id)} type="button">{order.orderNumber}</button></td>
                  <td><span className="buyer-orders-cell-text">{customerName}</span></td>
                  <td><span className="buyer-orders-cell-text">{order.productNameSnapshot} · {order.maxActiveDevicesSnapshot ?? 0} thiết bị</span></td>
                  <td className="buyer-orders-money">{formatMoney(order.priceVndSnapshot)}</td>
                  <td><StatusChip tone={state.tone}>{state.label}</StatusChip></td>
                  <td className="buyer-orders-actions">
                    {order.orderStatus === 'WAITING_PAYMENT' ? <Button href={`/buyer/orders/${encodeURIComponent(order.id)}/payment`} type="primary">Thanh toán</Button> : <Button onClick={() => setSelectedId(order.id)} type="primary">Xem chi tiết</Button>}
                    {order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? <Popconfirm title="Hủy đơn hàng?" onConfirm={() => mutations.cancel.mutate(order.id)}><Button danger loading={mutations.cancel.isPending}>Hủy</Button></Popconfirm> : null}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
          {data.length === 0 ? <Empty description="Bạn chưa có đơn hàng nào." /> : null}
        </section>
      </main>
      <Drawer open={Boolean(selectedId)} onClose={() => setSelectedId(undefined)} motion={{ motionName: '' }} title={`Chi tiết ${detailQuery.data?.orderNumber ?? ''}`}>
        {detailQuery.isLoading ? <Spin aria-label="Đang tải chi tiết đơn hàng" /> : detailQuery.isError ? <Alert type="error" message={describeApiError(detailQuery.error, 'Không thể tải chi tiết đơn hàng.')} /> : detailQuery.data ? <FactList facts={[{ label: 'Sản phẩm', value: detailQuery.data.productNameSnapshot }, { label: 'Gói', value: detailQuery.data.planNameSnapshot }, { label: 'Tổng thanh toán', value: formatMoney(detailQuery.data.priceVndSnapshot) }]} /> : null}
      </Drawer>
    </div>
  );
}
