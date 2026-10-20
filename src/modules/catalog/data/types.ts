import type { ImageMetadata } from 'astro';

export type Category = 'bikinis' | 'enterizos' | 'hombre' | 'resort';

export type LabTestId = 'cloro' | 'upf' | 'sal';

export interface ProductColor {
  name: string;
  hex: string;
  image: ImageMetadata;
  /** Spanish alternative text describing the photo. */
  alt: string;
  /** CSS object-position used when the photo is cropped to a card. */
  position?: string;
}

export interface Product {
  slug: string;
  name: string;
  category: Category;
  /** Price in Colombian pesos (COP). */
  price: number;
  isNew: boolean;
  /** 1 = best seller. */
  bestsellerRank: number;
  /** ISO date (YYYY-MM-DD), used to sort by "Novedades". */
  releasedAt: string;
  rating: number;
  reviewCount: number;
  shortDescription: string;
  description: string;
  materials: string;
  care: string[];
  shipping: string;
  sizes: string[];
  colors: ProductColor[];
  testedFor: LabTestId[];
}
