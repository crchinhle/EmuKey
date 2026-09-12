import { FactList, formatMoney } from './WorkspacePrimitives';

export function OrderSummary({ order }: { readonly order: { readonly total: number } }) {
  return (
    <section className="workspace-card order-summary">
      <h2>Chi tiết thanh toán</h2>
      <FactList
        facts={[
          { label: 'Tổng thanh toán', value: formatMoney(order.total) },
        ]}
      />
       <small>Giá cuối cùng được snapshot từ gói đã công bố khi tạo đơn.</small>
    </section>
  );
}
