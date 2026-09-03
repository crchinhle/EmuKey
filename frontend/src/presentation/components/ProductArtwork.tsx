import {
  CloudOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

import type { ProductTone } from '../../domain/product';

interface ProductArtworkProps {
  readonly tone: ProductTone;
  readonly productName: string;
  readonly large?: boolean;
}

const artworkByTone = {
  brand: SafetyCertificateOutlined,
  module: CloudOutlined,
  neutral: DatabaseOutlined,
} as const;

export function ProductArtwork({
  tone,
  productName,
  large = false,
}: ProductArtworkProps) {
  const Artwork = artworkByTone[tone];
  const className = [
    'product-artwork',
    'product-artwork--' + tone,
    large ? 'product-artwork--large' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      aria-label={'Minh họa ' + productName}
      className={className}
      role="img"
    >
      <Artwork />
    </div>
  );
}
