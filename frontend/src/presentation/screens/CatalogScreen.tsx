import { Alert, Button, Card, Empty, Input, Select, Spin } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  formatVnd,
  useProducts,
} from '../../application/catalog/catalogQueries';
import { ProductArtwork } from '../components/ProductArtwork';
import { SiteHeader } from '../components/SiteHeader';

const sortOptions = [
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price-asc', label: 'Giá tăng dần' },
] as const;

export function CatalogScreen({ authenticated = false }: { readonly authenticated?: boolean }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] =
    useState<(typeof sortOptions)[number]['value']>('popular');
  const navigate = useNavigate();
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi');
    const filtered = products.filter(
      (product) =>
        !normalizedSearch ||
        `${product.name} ${product.summary}`
          .toLocaleLowerCase('vi')
          .includes(normalizedSearch),
    );

    return sort === 'price-asc'
      ? filtered.sort(
          (left, right) => left.plans[0]!.priceVnd - right.plans[0]!.priceVnd,
        )
      : filtered;
  }, [products, search, sort]);

  return (
    <div className="page-shell">
      {!authenticated ? <SiteHeader /> : null}
      <main className="catalog-content">
        <section className="catalog-hero">
          <div>
            <h1>Sản phẩm</h1>
            <p>Chọn gói phù hợp với số thiết bị, thời hạn và nhu cầu sử dụng.</p>
          </div>
        </section>

        <section aria-label="Bộ lọc sản phẩm" className="catalog-toolbar">
          <label>
            <span>Tìm sản phẩm</span>
            <Input
              aria-label="Tìm sản phẩm"
              placeholder="Tìm theo tên hoặc mô tả"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="catalog-compare-action">
            <span>Cần chọn nhanh?</span>
            <Link className="secondary-link" to="/compare">So sánh các gói</Link>
          </div>
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
          {isLoading ? <Spin aria-label="Đang tải sản phẩm" /> : null}
          {isError ? <Alert message="Không thể tải danh mục sản phẩm" type="error" showIcon action={<Button onClick={() => void refetch()}>Thử lại</Button>} /> : null}
          {!isLoading && !isError && products.length === 0 ? (
            <Empty description="Chưa có sản phẩm và gói giá được công bố." />
          ) : null}
          {!isLoading && !isError && visibleProducts.map((product) => (
            <Card
              aria-label={`Mở chi tiết ${product.name}`}
              className="product-card"
              key={product.slug}
              onClick={() => void navigate(`${authenticated ? '/buyer/products/' : '/products/'}${product.slug}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void navigate(`${authenticated ? '/buyer/products/' : '/products/'}${product.slug}`);
                }
              }}
              role="link"
              tabIndex={0}
            >
              <ProductArtwork imageUrl={product.imageUrl} productName={product.name} tone={product.tone} />
              <h2>{product.name}</h2>
              <p>{product.summary}</p>
              <strong>Từ {formatVnd(product.plans[0]!.priceVnd)}</strong>
              <div className="product-actions">
                <Link
                  className="primary-link"
                  to={`${authenticated ? '/buyer/products/' : '/products/'}${product.slug}`}
                >
                  Xem gói & chi tiết
                </Link>
              </div>
            </Card>
          ))}
          {!isLoading && !isError && products.length > 0 && visibleProducts.length === 0 ? (
            <Empty description="Không tìm thấy sản phẩm phù hợp" />
          ) : null}
        </section>
      </main>
    </div>
  );
}
