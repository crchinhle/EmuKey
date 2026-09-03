import type { OrderRecord } from '../../domain/workspace';
import { FactList, formatMoney } from './WorkspacePrimitives';

export function OrderSummary({ order }: { readonly order: OrderRecord }) {
  return (
    <section className="workspace-card order-summary">
      <h2>Chi tiết thanh toán</h2>
      <FactList
        facts={[
          { label: 'Tạm tính', value: formatMoney(order.subtotal) },
          {
            label: 'Khuyến mãi Summer 2026',
            value: `− ${formatMoney(order.discount)}`,
          },
          { label: 'Tổng thanh toán', value: formatMoney(order.total) },
        ]}
      />
      <small>Giá hiển thị là dữ liệu mock đã snapshot cho bản mẫu UI.</small>
    </section>
  );
}
