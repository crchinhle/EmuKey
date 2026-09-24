import { Alert, Button, Empty, Spin } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatVnd, useProducts } from '../../application/catalog/catalogQueries';
import { AiAssistantLauncher } from '../components/AiAssistantLauncher';
import { ProductArtwork } from '../components/ProductArtwork';
import { SiteHeader } from '../components/SiteHeader';
import type { Product } from '../../domain/product';

const publicHomeStyles = `
  .public-home-screen {
    min-height: 100vh;
    background: var(--canvas);
  }

  .public-home-content {
    width: min(100% - 80px, 1320px);
    margin: 0 auto;
  }

  .public-home-hero {
    padding: 36px 48px;
    border-radius: 0 0 12px 12px;
    color: var(--sidebar-text);
    background: var(--sidebar);
  }

  .public-home-hero h1 {
    max-width: 760px;
    margin: 0 0 16px;
    font-size: clamp(1.9rem, 3vw, 2.375rem);
    line-height: 1.16;
    letter-spacing: -0.01em;
  }

  .public-home-hero p {
    max-width: 720px;
    margin: 0;
    color: var(--sidebar-muted, #b0ada6);
    font-size: 16px;
    line-height: 1.55;
  }

  .public-home-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 26px;
  }

  .public-home-featured {
    padding: 44px 56px 64px;
  }

  .public-home-featured-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }

  .public-home-featured-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .public-home-carousel {
    position: relative;
  }

  .public-home-viewport {
    overflow: hidden;
  }

  .public-home-track {
    width: 100%;
    display: flex;
    transition: transform 350ms ease;
    will-change: transform;
  }

  .public-home-page {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
    flex: 0 0 100%;
    width: 100%;
    min-width: 100%;
    box-sizing: border-box;
  }

  .public-home-featured-card {
    height: 100%;
    border-color: var(--border);
    display: flex;
    flex-direction: column;
  }

  .public-home-featured-card .ant-card-body {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 24px;
  }

  .public-home-featured-card h3,
  .public-home-featured-card p {
    margin: 0;
  }

  .public-home-featured-card h3 {
    font-size: 20px;
    line-height: 28px;
  }

  .public-home-featured-card p {
    min-height: 48px;
    color: var(--text-secondary);
    font-size: 16px;
    line-height: 1.55;
  }

  .public-home-featured-card strong {
    font-size: 17px;
  }

  .public-home-featured-card .ant-btn {
    align-self: flex-start;
    margin-top: auto;
    min-height: 44px;
  }

  .public-home-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin-top: 24px;
  }

  .public-home-arrow {
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--text);
    font-size: 20px;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .public-home-arrow:hover:not(:disabled) {
    background: var(--subtle);
    border-color: var(--border-hover);
  }

  .public-home-arrow:disabled {
    color: var(--text-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .public-home-dots {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .public-home-dots button {
    width: 12px;
    height: 12px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--border);
    cursor: pointer;
    transition: background 120ms ease, transform 120ms ease;
  }

  .public-home-dots button.active {
    background: var(--primary);
    transform: scale(1.15);
  }

  .public-home-pause {
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--text-secondary);
    font-size: 15px;
    cursor: pointer;
  }

  .public-home-pause:hover {
    background: var(--subtle);
    border-color: var(--border-hover);
  }

  .public-home-all-products {
    margin-top: 28px;
  }

  @media (max-width: 1100px) {
    .public-home-page { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 960px) {
    .public-home-hero { padding: 40px 32px; }
    .public-home-featured { padding: 40px 32px 56px; }
  }

  @media (max-width: 760px) {
    .public-home-hero {
      padding: 32px 16px;
    }

    .public-home-hero h1 {
      font-size: clamp(1.6rem, 6vw, 1.9rem);
    }

    .public-home-featured {
      padding: 32px 16px 48px;
    }

    .public-home-featured-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }

    .public-home-page {
      grid-template-columns: 1fr;
      gap: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .public-home-track { transition: none; }
    .public-home-dots button { transition: none; }
  }
`;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cardsPerPage(): number {
  if (typeof window === 'undefined') return 3;
  const w = window.innerWidth;
  if (w <= 760) return 1;
  if (w <= 1100) return 2;
  return 3;
}

function FeaturedCarousel({ products }: { readonly products: readonly Product[] }) {
  const perPage = cardsPerPage();
  const pageCount = Math.max(1, Math.ceil(products.length / perPage));
  const hasMorePages = pageCount > 1;

  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setReducedMotion(query.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const autoplayActive =
    hasMorePages &&
    !paused &&
    !reducedMotion &&
    !isHovering &&
    !isFocusWithin &&
    !isInteracting &&
    isTabVisible;

  const advance = useCallback(() => {
    setPage((current) => (current + 1) % pageCount);
  }, [pageCount]);

  useEffect(() => {
    if (!autoplayActive) return;
    const id = window.setInterval(advance, 4000);
    return () => window.clearInterval(id);
  }, [autoplayActive, advance]);

  useEffect(() => {
    const onVisibility = () => setIsTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const goPrev = useCallback(() => setPage((current) => Math.max(0, current - 1)), []);
  const goNext = useCallback(() => setPage((current) => (current + 1) % pageCount), [pageCount]);
  const goFirst = useCallback(() => setPage(0), []);
  const goLast = useCallback(() => setPage(pageCount - 1), [pageCount]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (event.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); goPrev(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); goNext(); }
    else if (event.key === 'Home') { event.preventDefault(); goFirst(); }
    else if (event.key === 'End') { event.preventDefault(); goLast(); }
  };

  const pages: Product[][] = [];
  for (let i = 0; i < products.length; i += perPage) {
    pages.push(products.slice(i, i + perPage));
  }

  const markInteracting = () => {
    setIsInteracting(true);
    window.setTimeout(() => setIsInteracting(false), 400);
  };

  return (
    <div
      aria-label="Sản phẩm nổi bật"
      className="public-home-carousel"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusWithin(false);
      }}
      onFocus={() => setIsFocusWithin(true)}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      role="region"
    >
      <div className="public-home-viewport">
        <div
          aria-live="polite"
          className="public-home-track"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {pages.map((pageProducts, pageIndex) => (
            <div aria-hidden={pageIndex !== page} className="public-home-page" key={`page-${pageIndex}`}>
              {pageProducts.map((product) => {
                const startingPlan = product.plans[0];
                return (
                  <div className="public-home-featured-card ant-card ant-card-bordered" key={product.slug}>
                    <div className="ant-card-body">
                      <ProductArtwork imageUrl={product.imageUrl} productName={product.name} tone={product.tone} />
                      <h3>{product.name}</h3>
                      <p>{product.summary}</p>
                      {startingPlan ? <strong>Từ {formatVnd(startingPlan.priceVnd)}</strong> : null}
                      <Button href={`/products/${product.slug}`} onClick={markInteracting} type="primary">
                        Xem chi tiết
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="public-home-nav">
        <button aria-label="Trước" className="public-home-arrow" disabled={page === 0} onClick={() => { markInteracting(); goPrev(); }} type="button">&#8249;</button>
        <div aria-label="Chọn trang sản phẩm" className="public-home-dots" role="tablist">
          {pages.map((_, pageIndex) => (
            <button
              aria-label={`Trang ${pageIndex + 1}`}
              aria-selected={pageIndex === page}
              className={pageIndex === page ? 'active' : undefined}
              key={`dot-${pageIndex}`}
              onClick={() => { markInteracting(); setPage(pageIndex); }}
              role="tab"
              type="button"
            />
          ))}
        </div>
        <button aria-label="Sau" className="public-home-arrow" onClick={() => { markInteracting(); goNext(); }} type="button">&#8250;</button>
        {hasMorePages && !reducedMotion ? (
          <button
            aria-label={paused ? 'Tiếp tục tự động chuyển' : 'Tạm dừng tự động chuyển'}
            className="public-home-pause"
            onClick={() => setPaused((p) => !p)}
            type="button"
          >
            {paused ? '▶' : '❚❚'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PublicHomeScreen() {
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const featured = products.slice(0, 6);

  return (
    <div className="page-shell public-home-screen">
      <style>{publicHomeStyles}</style>
      <SiteHeader />
      <main className="public-home-content">
        <section aria-labelledby="public-home-title" className="public-home-hero">
          <h1 id="public-home-title">Bản quyền phần mềm được xác lập on-chain</h1>
          <p>Thanh toán off-chain, quyền sử dụng được xác lập và kiểm chứng on-chain.</p>
          <div className="public-home-hero-actions">
            <Button href="/products" type="primary">
              Xem sản phẩm
            </Button>
            <Button href="/verify">Xác minh bản quyền</Button>
          </div>
        </section>

        <section aria-labelledby="public-home-featured-title" className="public-home-featured">
          <div className="public-home-featured-header">
            <h2 id="public-home-featured-title">Sản phẩm nổi bật</h2>
          </div>

          {isLoading ? <Spin aria-label="Đang tải sản phẩm" /> : null}
          {isError ? (
            <Alert
              action={<Button onClick={() => void refetch()}>Thử lại</Button>}
              message="Không thể tải danh mục sản phẩm"
              showIcon
              type="error"
            />
          ) : null}
          {!isLoading && !isError && featured.length === 0 ? (
            <Empty description="Chưa có sản phẩm." />
          ) : null}
          {!isLoading && !isError && featured.length > 0 ? (
            <>
              <FeaturedCarousel products={featured} />
              <div className="public-home-all-products">
                <Link className="primary-link" to="/products">
                  Xem tất cả sản phẩm
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </main>
      <AiAssistantLauncher />
    </div>
  );
}
