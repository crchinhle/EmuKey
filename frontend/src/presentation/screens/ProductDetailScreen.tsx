import { Button, Result, Select, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  findProduct,
  formatVnd,
} from '../../application/catalog/catalogQueries';
import { ProductArtwork } from '../components/ProductArtwork';
import { PublicHeader } from '../components/PublicHeader';

const tabs = ['Tổng quan', 'Tính năng', 'Gói giá', 'Tài liệu'] as const;

export function ProductDetailScreen() {
  const { slug = '' } = useParams();
  const product = findProduct(slug);
  const [selectedDevices, setSelectedDevices] = useState(
    product?.plans.find((plan) => plan.devices === 25)?.devices ??
      product?.plans[0]?.devices ??
      0,
  );
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [purchaseStarted, setPurchaseStarted] = useState(false);
  const selectedPlan = useMemo(
    () =>
      product?.plans.find((plan) => plan.devices === selectedDevices) ??
      product?.plans[0],
    [product, selectedDevices],
  );

  if (!product || !selectedPlan) {
    return (
      <Result
        extra={<Button href="/products">Về danh mục</Button>}
        status="404"
        title="Không tìm thấy sản phẩm"
      />
    );
  }

  return (
    <div className="page-shell">
      <PublicHeader />
      <main className="detail-content">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to="/products">Sản phẩm</Link>
          <span>/</span>
          <span>{product.name}</span>
        </nav>

        <section className="product-hero">
          <ProductArtwork
            large
            productName={product.name}
            tone={product.tone}
          />
          <div className="product-summary">
            <Tag className="promotion-tag">% Đang giảm 15%</Tag>
            <h1>{product.name}</h1>
            <p>{product.summary}</p>
            <div className="tag-row">
              {product.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          </div>
          <aside className="assistant-card">
            <Tag color="purple">AI</Tag>
            <h2>Chưa biết chọn gói?</h2>
            <p>Hỏi trợ lý về số thiết bị, thời hạn và quyền sử dụng.</p>
            <Button onClick={() => setAssistantOpen((open) => !open)}>
              Hỏi AI
            </Button>
            {assistantOpen ? (
              <p className="inline-message" role="status">
                Gói Business phù hợp với nhóm từ 11–50 thiết bị.
              </p>
            ) : null}
          </aside>
        </section>

        <nav aria-label="Nội dung sản phẩm" className="detail-tabs">
          {tabs.map((tab, index) => (
            <button
              className={index === 0 ? 'active' : ''}
              key={tab}
              type="button"
            >
              {tab}
            </button>
          ))}
        </nav>

        <section className="detail-lower">
          <article className="feature-card">
            <h2>Tính năng nổi bật</h2>
            <ul>
              {product.features.map((feature) => (
                <li key={feature}>
                  <span aria-hidden="true">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </article>
          <article className="pricing-card">
            <h2>Gói Business</h2>
            <p>Phù hợp 11–50 thiết bị</p>
            <del>{formatVnd(selectedPlan.listPrice)}</del>
            <strong>{formatVnd(selectedPlan.salePrice)}</strong>
            <small>
              Tiết kiệm{' '}
              {formatVnd(selectedPlan.listPrice - selectedPlan.salePrice)} · tự
              động áp dụng
            </small>
            <label>
              <span>Số thiết bị</span>
              <Select
                aria-label="Số thiết bị"
                options={product.plans.map((plan) => ({
                  value: plan.devices,
                  label: plan.label,
                }))}
                value={selectedDevices}
                onChange={setSelectedDevices}
              />
            </label>
            <div className="plan-actions">
              <Button>So sánh gói</Button>
              <Button type="primary" onClick={() => setPurchaseStarted(true)}>
                Mua ngay
              </Button>
            </div>
            {purchaseStarted ? (
              <p className="inline-message" role="status">
                Đã chọn gói {selectedPlan.label}. Dữ liệu hiện tại là dữ liệu
                mẫu.
              </p>
            ) : null}
          </article>
        </section>
      </main>
    </div>
  );
}
