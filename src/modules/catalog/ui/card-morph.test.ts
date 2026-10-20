import { describe, expect, it } from 'vitest';
import { productSlugFromUrl } from './card-morph';

describe('productSlugFromUrl', () => {
  it('reads the slug of a product page', () => {
    expect(productSlugFromUrl(new URL('http://localhost/producto/ola'))).toBe('ola');
  });

  it('ignores a trailing slash, query and hash', () => {
    expect(productSlugFromUrl(new URL('http://localhost/producto/jardin/?color=2#tallas'))).toBe('jardin');
  });

  it('returns null for any other page', () => {
    expect(productSlugFromUrl(new URL('http://localhost/coleccion?cat=bikinis'))).toBeNull();
    expect(productSlugFromUrl(new URL('http://localhost/producto/'))).toBeNull();
    expect(productSlugFromUrl(new URL('http://localhost/producto/ola/extra'))).toBeNull();
  });
});
