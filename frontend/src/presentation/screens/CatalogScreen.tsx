import { Card, Empty, Input, Select, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  formatVnd,
  listProducts,
} from '../../application/catalog/catalogQueries';
import { products } from '../../infrastructure/catalog/mockCatalog';
import { ProductArtwork } from '../components/ProductArtwork';
import { PublicHeader } from '../components/PublicHeader';

const groupOptions = [
  { value: 'all', label: 'Tất cả' },
  ...Array.from(new Set(products.map((product) => product.group))).map(
    (group) => ({ value: group, label: group }),
  ),
];

const sortOptions = [
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price-asc', label: 'Giá tăng dần' },
] as const;

export function CatalogScreen() {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [sort, setSort] =
    useState<(typeof sortOptions)[number]['value']>('popular');
  const visibleProducts = useMemo(() => {
    const filtered = [...listProducts(search, group)];

    return sort === 'price-asc'
      ? filtered.sort(
          (left, right) => left.plans[0]!.salePrice - right.plans[0]!.salePrice,
        )
      : filtered;
  }, [group, search, sort]);

  return (
    <div className="page-shell">
      <PublicHeader />
      <main className="catalog-content">
        <section className="catalog-hero">
          <div>
            <h1>Bản quyền phần mềm cho doanh nghiệp hiện đại</h1>
            <p>
              Chọn gói phù hợp theo số thiết bị. Khuyến mãi hợp lệ được áp dụng
              tự động, không cần nhập mã.
            </p>
            <a className="primary-link" href="#product-grid">
              Khám phá sản phẩm
            </a>
          </div>
          <Card className="trust-card">
            <Tag color="blue">Blockchain verified</Tag>
            <h2>Hợp đồng có bằng chứng bất biến</h2>
            <p>Tra cứu trạng thái công khai theo mã xác thực.</p>
          </Card>
        </section>

        <section aria-label="Bộ lọc sản phẩm" className="catalog-toolbar">
          <label>
            <span>Tìm sản phẩm</span>
            <Input
              aria-label="Tìm sản phẩm"
              placeholder="Tìm theo tên hoặc tính năng"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span>Nhóm sản phẩm</span>
            <Select
              aria-label="Nhóm sản phẩm"
              options={groupOptions}
              value={group}
              onChange={setGroup}
            />
          </label>
          <label>
            <span>Sắp xếp</span>
            <Select
              aria-label="Sắp xếp"
              options={[...sortOptions]}
              value={sort}
              onChange={setSort}
            />
          </label>
        </section>

        <section
          aria-label="Danh sách sản phẩm"
          className="product-grid"
          id="product-grid"
        >
          {visibleProducts.map((product) => (
            <Card className="product-card" key={product.slug}>
              <ProductArtwork productName={product.name} tone={product.tone} />
              <Tag className="promotion-tag">% {product.promotion}</Tag>
              <h2>{product.name}</h2>
              <p>{product.summary}</p>
              <strong>Từ {formatVnd(product.plans[0]!.salePrice)}</strong>
              <div className="product-actions">
                <Link className="ghost-link" to={'/products/' + product.slug}>
                  Xem chi tiết
                </Link>
                <Link
                  className="secondary-link"
                  to={'/products/' + product.slug}
                >
                  Chọn gói
                </Link>
              </div>
            </Card>
          ))}
          {visibleProducts.length === 0 ? (
            <Empty description="Không tìm thấy sản phẩm phù hợp" />
          ) : null}
        </section>
      </main>
    </div>
  );
}
