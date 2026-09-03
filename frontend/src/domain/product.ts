export type ProductTone = 'brand' | 'module' | 'neutral';

export interface DevicePlan {
  readonly devices: number;
  readonly label: string;
  readonly listPrice: number;
  readonly salePrice: number;
}

export interface Product {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly group: string;
  readonly promotion: string;
  readonly tone: ProductTone;
  readonly tags: readonly string[];
  readonly features: readonly string[];
  readonly plans: readonly DevicePlan[];
}
