import { Link } from 'react-router-dom';

interface BrandProps {
  readonly inverted?: boolean;
}

export function Brand({ inverted = false }: BrandProps) {
  return (
    <Link
      aria-label="EmuKey - Trang sản phẩm"
      className={
        inverted ? 'brand brand--script brand--inverted' : 'brand brand--script'
      }
      to="/products"
    >
      EmuKey
    </Link>
  );
}
