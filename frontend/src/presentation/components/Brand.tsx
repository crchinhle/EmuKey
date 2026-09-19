import { Link } from 'react-router-dom';

interface BrandProps {
  readonly inverted?: boolean;
}

export function Brand({ inverted = false }: BrandProps) {
  return (
    <Link
      aria-label="Emukey - Trang sản phẩm"
      className={inverted ? 'brand brand--inverted' : 'brand'}
      to="/products"
    >
      <span className="brand-wordmark">Emukey</span>
    </Link>
  );
}
