import type { Product } from '../../domain/product';
import { products } from '../../infrastructure/catalog/mockCatalog';

export function listProducts(search = '', group = 'all'): readonly Product[] {
  const normalizedSearch = search.trim().toLocaleLowerCase('vi');

  return products.filter((product) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      [product.name, product.summary, ...product.tags]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(normalizedSearch);
    const matchesGroup = group === 'all' || product.group === group;

    return matchesSearch && matchesGroup;
  });
}

export function findProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
}
