import { Button, Table } from 'antd';
import { Link } from 'react-router-dom';

import {
  providerMetrics,
  providerOrders,
  providerRevenue,
} from '../../infrastructure/workspace/mockWorkspace';
import {
  MetricCard,
  PageHeader,
  StatusChip,
  formatMoney,
} from '../components/WorkspacePrimitives';

export function ProviderDashboardScreen() {
  const maximum = Math.max(...providerRevenue.map((point) => point.value));
  return (
    <>
      <PageHeader
        title="Tổng quan nhà cung cấp"
        description="Doanh thu, license và công việc cần xử lý trong một màn hình."
        action={
          <Link to="/provider/catalog">
            <Button type="primary">Quản lý danh mục</Button>
          </Link>
        }
      />
      <section className="metric-grid metric-grid--four">
        {providerMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>
      <div className="provider-dashboard-grid">
        <section className="workspace-card chart-card">
          <div className="card-heading">
            <h2>Doanh thu 6 tháng</h2>
            <StatusChip tone="commerce">Triệu ₫</StatusChip>
          </div>
          <div className="bar-chart" aria-label="Biểu đồ doanh thu">
            {providerRevenue.map((point) => (
              <div key={point.month}>
                <span
                  style={{ height: `${(point.value / maximum) * 100}%` }}
                  title={`${point.value} triệu ₫`}
                />
                <small>{point.month}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="workspace-card activity-card">
          <h2>Việc cần chú ý</h2>
          <ul>
            <li>02 job Blockchain cần kiểm tra</li>
            <li>07 đơn đang chờ xử lý</li>
            <li>01 tài liệu AI chờ duyệt</li>
          </ul>
        </section>
      </div>
      <section className="workspace-card table-card">
        <h2 className="section-title">Đơn hàng gần đây</h2>
        <Table
          dataSource={[...providerOrders]}
          pagination={false}
          rowKey="id"
          scroll={{ x: 640 }}
          columns={[
            { title: 'Mã đơn', dataIndex: 'id' },
            { title: 'Khách hàng', dataIndex: 'company' },
            { title: 'Gói', dataIndex: 'plan' },
            { title: 'Tổng tiền', dataIndex: 'total', render: formatMoney },
          ]}
        />
      </section>
    </>
  );
}
