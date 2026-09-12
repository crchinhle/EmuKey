import { Alert, Button, Card, Empty, Input, Select, Spin, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  formatVnd,
  useProducts,
} from '../../application/catalog/catalogQueries';
import { ProductArtwork } from '../components/ProductArtwork';
import { PublicHeader } from '../components/PublicHeader';

const sortOptions = [
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price-asc', label: 'Giá tăng dần' },
] as const;

export function CatalogScreen() {
  const [search, setSearch] = useState('');
  const [sort, setSort] =
    useState<(typeof sortOptions)[number]['value']>('popular');
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
      <PublicHeader />
      <main className="catalog-content">
        <section className="catalog-hero">
          <div>
            <h1>Bản quyền phần mềm cho doanh nghiệp hiện đại</h1>
            <p>
              Chọn gói phù hợp theo số thiết bị và điều khoản cấp phép đã được
              công bố.
            </p>
            <a className="primary-link" href="#product-grid">
              Khám phá sản phẩm
            </a>
          </div>
          <Card className="trust-card">
            <Tag color="blue">Blockchain verified</Tag>
            <h2>Quyền license có bằng chứng on-chain</h2>
            <p>Tra cứu trạng thái, commitment và finality theo mã xác thực.</p>
          </Card>
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
            <Card className="product-card" key={product.slug}>
              <ProductArtwork imageUrl={product.imageUrl} productName={product.name} tone={product.tone} />
              <h2>{product.name}</h2>
              <p>{product.summary}</p>
              <strong>Từ {formatVnd(product.plans[0]!.priceVnd)}</strong>
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
          {!isLoading && !isError && products.length > 0 && visibleProducts.length === 0 ? (
            <Empty description="Không tìm thấy sản phẩm phù hợp" />
          ) : null}
        </section>
      </main>
    </div>
  );
}
