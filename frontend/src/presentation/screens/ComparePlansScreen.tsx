import { Alert, Button, Checkbox, Empty, Spin, Table, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  formatVnd,
  useComparePlans,
  useProducts,
} from '../../application/catalog/catalogQueries';
import { SiteHeader } from '../components/SiteHeader';

function displayDimension(key: string, value: unknown): string {
  if (key === 'priceVnd' && typeof value === 'number') return formatVnd(value);
  if (key === 'durationMonths' && typeof value === 'number') return `${value} tháng`;
  if (key === 'maxActiveDevices' && typeof value === 'number') return `${value} thiết bị`;
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => name)
      .join(', ') || 'Không có';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

export function ComparePlansScreen() {
  const [searchParams] = useSearchParams();
  const initialIds = useMemo(
    () => [...new Set((searchParams.get('ids') ?? '').split(',').filter(Boolean))].slice(0, 4),
    [searchParams],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const products = useProducts();
  const comparison = useComparePlans(selectedIds);
  const choices = (products.data ?? []).flatMap((product) =>
    product.plans.map((plan) => ({
      id: plan.id,
      label: `${product.name} · ${plan.label}`,
      productSlug: product.slug,
    })),
  );
  const firstSelectedChoice = choices.find((choice) => choice.id === selectedIds[0]);

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="catalog-content comparison-content">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to="/products">Sản phẩm</Link><span>/</span><span>So sánh gói</span>
        </nav>
        <section className="catalog-hero comparison-hero">
          <div>
            <Tag color="blue">CAT-05</Tag>
            <h1>So sánh gói bản quyền</h1>
            <p>Chọn từ hai đến bốn gói. Dữ liệu so sánh được lấy trực tiếp từ catalog đã công bố.</p>
          </div>
          <div className="comparison-selection" aria-label="Chọn gói để so sánh">
            {products.isLoading ? <Spin aria-label="Đang tải gói" /> : null}
            {choices.map((choice) => (
              <Checkbox
                checked={selectedIds.includes(choice.id)}
                disabled={!selectedIds.includes(choice.id) && selectedIds.length >= 4}
                key={choice.id}
                onChange={(event) => setSelectedIds((current) =>
                  event.target.checked
                    ? [...current, choice.id]
                    : current.filter((id) => id !== choice.id),
                )}
              >
                {choice.label}
              </Checkbox>
            ))}
          </div>
        </section>

        {selectedIds.length < 2 ? (
          <Empty description="Chọn ít nhất hai gói để bắt đầu so sánh." />
        ) : comparison.isLoading ? (
          <Spin aria-label="Đang so sánh gói" />
        ) : comparison.isError || !comparison.data ? (
          <Alert showIcon type="error" message="Không thể tải dữ liệu so sánh gói." />
        ) : (
          <section className="workspace-card table-card comparison-table" aria-label="Bảng so sánh gói">
            <Table
              dataSource={comparison.data.dimensions.map((dimension) => ({ ...dimension, id: dimension.key }))}
              pagination={false}
              rowKey="id"
              scroll={{ x: 720 }}
              columns={[
                { dataIndex: 'label', fixed: 'left', title: 'Tiêu chí', width: 190 },
                ...comparison.data.plans.map((plan) => ({
                  key: plan.id,
                  title: <span>{plan.productName}<br /><small>{plan.name}</small></span>,
                  render: (_: unknown, row: { key: string; values: Record<string, unknown> }) =>
                    displayDimension(row.key, row.values[plan.id]),
                })),
              ]}
            />
            <div className="workspace-actions comparison-actions">
              <Button href="/products">Chọn lại sản phẩm</Button>
              <Button
                disabled={!firstSelectedChoice}
                {...(firstSelectedChoice
                  ? { href: `/buyer/checkout?product=${encodeURIComponent(firstSelectedChoice.productSlug)}&planId=${encodeURIComponent(firstSelectedChoice.id)}` }
                  : {})}
                type="primary"
              >
                Chọn {comparison.data.plans[0]!.name}
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
