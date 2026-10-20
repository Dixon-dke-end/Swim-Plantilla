import { photos, type Photo } from '../../../shared/assets/photos';
import type { Category, Product, ProductColor } from './types';

export type { Category, LabTestId, Product, ProductColor } from './types';

export const CATEGORY_LABELS: Record<Category, string> = {
  bikinis: 'Bikinis',
  enterizos: 'Enterizos',
  hombre: 'Hombre',
  resort: 'Resort',
};

const WOMEN_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const MEN_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const CARE = [
  'Enjuagar con agua dulce y fría después de cada uso.',
  'Lavar a mano con jabón neutro, sin blanqueadores.',
  'Secar a la sombra, sin retorcer ni usar secadora.',
  'No planchar ni lavar en seco.',
];

const SHIPPING =
  'Envío estándar en 2 a 4 días hábiles a las principales ciudades de Colombia. Envío gratis desde $250.000. Cambios y devoluciones dentro de los 30 días posteriores a la entrega.';

function color(name: string, hex: string, photo: Photo): ProductColor {
  return { name, hex, image: photo.src, alt: photo.alt, position: photo.position };
}

export const products: Product[] = [
  {
    slug: 'alba',
    name: 'Bikini Alba',
    category: 'bikinis',
    price: 189_000,
    isNew: false,
    bestsellerRank: 1,
    releasedAt: '2026-02-10',
    rating: 4.8,
    reviewCount: 214,
    shortDescription: 'Top de triángulo con tiras ajustables y calzón de corte clásico.',
    description:
      'El bikini que resume la marca: líneas limpias, tiras ajustables y una tela que se siente como una segunda piel. El top de triángulo se adapta a cada silueta y el calzón de corte clásico mantiene su forma después de horas en el agua.',
    materials: 'Poliamida reciclada (78 %) y elastano (22 %). Forro interior de poliéster reciclado. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: WOMEN_SIZES,
    colors: [color('Negro', '#15191A', photos.bikiniBlackTop), color('Coral', '#E26D5A', photos.bikiniRedBeach)],
    testedFor: ['cloro', 'upf', 'sal'],
  },
  {
    slug: 'ola',
    name: 'Enterizo Ola',
    category: 'enterizos',
    price: 289_000,
    isNew: false,
    bestsellerRank: 2,
    releasedAt: '2026-01-25',
    rating: 4.9,
    reviewCount: 168,
    shortDescription: 'Enterizo de rayas finas con espalda baja y copas con forro.',
    description:
      'Un clásico de rayas finas con espalda baja y tirantes anchos que se quedan en su lugar. Está pensado para nadar, no solo para posar: el corte no se corre con el movimiento y el forro conserva su forma.',
    materials: 'Poliamida reciclada (80 %) y elastano (20 %). Forro de poliéster reciclado. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: WOMEN_SIZES,
    colors: [
      color('Rayas Marino', '#2C4A6B', photos.onepieceStripeWaves),
      color('Rayas Cielo', '#5F8FBF', photos.monokiniSand),
    ],
    testedFor: ['cloro', 'upf', 'sal'],
  },
  {
    slug: 'lunares',
    name: 'Bikini Lunares',
    category: 'bikinis',
    price: 179_000,
    isNew: false,
    bestsellerRank: 3,
    releasedAt: '2026-03-20',
    rating: 4.7,
    reviewCount: 131,
    shortDescription: 'Bikini retro de cintura alta con estampado de lunares.',
    description:
      'Inspirado en los trajes de baño de los años cincuenta, con cintura alta que estiliza y un top con aro suave. El estampado de lunares está impreso con tintas que resisten el cloro y el sol.',
    materials: 'Poliamida reciclada (82 %) y elastano (18 %). Forro de poliéster reciclado. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: WOMEN_SIZES,
    colors: [color('Rojo Lunares', '#B3262B', photos.bikiniPolka), color('Coral', '#E26D5A', photos.bikiniRedBeach)],
    testedFor: ['cloro', 'upf'],
  },
  {
    slug: 'costa',
    name: 'Short Costa',
    category: 'hombre',
    price: 169_000,
    isNew: false,
    bestsellerRank: 4,
    releasedAt: '2026-02-28',
    rating: 4.8,
    reviewCount: 97,
    shortDescription: 'Short de baño de secado rápido con cintura elástica y bolsillo interior.',
    description:
      'Un short de baño que pasa del mar al almuerzo sin cambiarse. Seca un 40 % más rápido que una tela de baño convencional, tiene cintura elástica con cordón interno y un bolsillo con cierre para lo esencial.',
    materials: 'Poliéster reciclado (88 %) y elastano (12 %). Malla interior de secado rápido. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: MEN_SIZES,
    colors: [color('Negro', '#15191A', photos.menBlackRock), color('Azul Mar', '#2A5D9F', photos.menBlueShorts)],
    testedFor: ['cloro', 'upf', 'sal'],
  },
  {
    slug: 'lago',
    name: 'Enterizo Lago',
    category: 'enterizos',
    price: 269_000,
    isNew: true,
    bestsellerRank: 5,
    releasedAt: '2026-09-28',
    rating: 4.9,
    reviewCount: 42,
    shortDescription: 'Enterizo de escote profundo en tonos de agua, con espalda descubierta.',
    description:
      'Escote en V profundo, espalda descubierta y una caída que alarga la silueta. Los tonos de la colección Lago están tomados de aguas reales: verde azulado, salvia y gris niebla.',
    materials: 'Poliamida reciclada (80 %) y elastano (20 %). Forro de poliéster reciclado. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: WOMEN_SIZES,
    colors: [
      color('Verde Lago', '#0F6E6B', photos.onepieceBlue),
      color('Salvia', '#8A8F7A', photos.onepieceSage),
      color('Gris Niebla', '#8B8F99', photos.onepieceGrey),
    ],
    testedFor: ['cloro', 'upf', 'sal'],
  },
  {
    slug: 'sol',
    name: 'Enterizo Sol',
    category: 'enterizos',
    price: 319_000,
    isNew: false,
    bestsellerRank: 6,
    releasedAt: '2026-04-18',
    rating: 4.6,
    reviewCount: 76,
    shortDescription: 'Enterizo con cortes laterales y escote cruzado en color borgoña.',
    description:
      'Cortes laterales que enmarcan la cintura y un escote cruzado que se ajusta a cada cuerpo. El color borgoña se tiñe en dos pasos para que no se apague con el cloro ni con el sol.',
    materials: 'Poliamida reciclada (78 %) y elastano (22 %). Forro de poliéster reciclado. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: WOMEN_SIZES,
    colors: [color('Borgoña', '#5A1F2B', photos.onepieceBrownHat), color('Gris Niebla', '#8B8F99', photos.onepieceGrey)],
    testedFor: ['cloro', 'upf'],
  },
  {
    slug: 'palma',
    name: 'Bikini Palma',
    category: 'bikinis',
    price: 209_000,
    isNew: true,
    bestsellerRank: 7,
    releasedAt: '2026-09-12',
    rating: 4.7,
    reviewCount: 38,
    shortDescription: 'Bikini de triángulo con estampado tropical exclusivo.',
    description:
      'Estampado tropical diseñado en casa, inspirado en las palmas y los hibiscos de la costa. Top de triángulo deslizable y calzón con lazos laterales para ajustar el largo a tu medida.',
    materials: 'Poliamida reciclada (80 %) y elastano (20 %). Forro de poliéster reciclado. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: WOMEN_SIZES,
    colors: [
      color('Palma Tropical', '#C9B04A', photos.bikiniFloralPalm),
      color('Floral Marino', '#1F3A5F', photos.bikiniFloralBlue),
    ],
    testedFor: ['cloro', 'upf', 'sal'],
  },
  {
    slug: 'roca',
    name: 'Bikini Roca',
    category: 'bikinis',
    price: 159_000,
    isNew: true,
    bestsellerRank: 8,
    releasedAt: '2026-10-05',
    rating: 4.5,
    reviewCount: 24,
    shortDescription: 'Bikini esencial con tiras finas y calzón de lazos laterales.',
    description:
      'Nuestra pieza más ligera: tiras finas, tela suave y un ajuste que se siente apenas. Ideal para días largos de sol y para combinar en distintos colores.',
    materials: 'Poliamida reciclada (80 %) y elastano (20 %). Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: WOMEN_SIZES,
    colors: [color('Rosa Coral', '#E58C8A', photos.bikiniBlueRock), color('Negro', '#15191A', photos.bikiniBlackTop)],
    testedFor: ['cloro', 'sal'],
  },
  {
    slug: 'jardin',
    name: 'Enterizo Jardín',
    category: 'resort',
    price: 349_000,
    isNew: true,
    bestsellerRank: 9,
    releasedAt: '2026-10-02',
    rating: 4.8,
    reviewCount: 18,
    shortDescription: 'Enterizo floral de la línea Resort, con tirantes cruzados.',
    description:
      'La pieza de la línea Resort: estampado floral nocturno, tirantes cruzados en la espalda y una tela con caída suave. Funciona igual de bien en la piscina que en la cena junto al mar.',
    materials: 'Poliamida reciclada (80 %) y elastano (20 %). Forro de poliéster reciclado. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: WOMEN_SIZES,
    colors: [color('Floral Noche', '#1E2B3D', photos.onepieceFloral), color('Negro', '#15191A', photos.poolOrangeGlass)],
    testedFor: ['cloro', 'upf', 'sal'],
  },
  {
    slug: 'piscina',
    name: 'Short Piscina',
    category: 'hombre',
    price: 175_000,
    isNew: false,
    bestsellerRank: 10,
    releasedAt: '2026-05-12',
    rating: 4.6,
    reviewCount: 64,
    shortDescription: 'Short de baño de largo medio con estampado discreto.',
    description:
      'Largo medio, estampado discreto y una tela que no se infla en el agua. Cintura elástica con cordón y malla interior suave.',
    materials: 'Poliéster reciclado (88 %) y elastano (12 %). Malla interior de secado rápido. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: MEN_SIZES,
    colors: [color('Grafito', '#2B2F33', photos.menPool), color('Azul Mar', '#2A5D9F', photos.menBlueShorts)],
    testedFor: ['cloro', 'upf'],
  },
  {
    slug: 'girasol',
    name: 'Short Girasol',
    category: 'hombre',
    price: 185_000,
    isNew: false,
    bestsellerRank: 11,
    releasedAt: '2026-06-02',
    rating: 4.7,
    reviewCount: 52,
    shortDescription: 'Short de baño con estampado gráfico en amarillo intenso.',
    description:
      'Para quienes prefieren el color. Estampado gráfico en amarillo intenso con tintas que resisten el sol y el cloro, y un corte ligeramente por encima de la rodilla.',
    materials: 'Poliéster reciclado (88 %) y elastano (12 %). Malla interior de secado rápido. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: MEN_SIZES,
    colors: [color('Amarillo', '#E8B923', photos.menYellowRed), color('Negro', '#15191A', photos.menBlackRock)],
    testedFor: ['cloro', 'upf', 'sal'],
  },
  {
    slug: 'oasis',
    name: 'Enterizo Oasis',
    category: 'resort',
    price: 389_000,
    isNew: false,
    bestsellerRank: 12,
    releasedAt: '2026-05-30',
    rating: 4.9,
    reviewCount: 29,
    shortDescription: 'Enterizo de la línea Resort con escote profundo y tela satinada.',
    description:
      'La pieza más cuidada de la línea Resort: tela de acabado satinado, escote profundo y costuras planas que no marcan. Hecha para pasar horas en la piscina sin dejar de verse impecable.',
    materials: 'Poliamida reciclada (76 %) y elastano (24 %). Forro de poliéster reciclado. Protección UPF 50+.',
    care: CARE,
    shipping: SHIPPING,
    sizes: WOMEN_SIZES,
    colors: [color('Negro', '#15191A', photos.poolOrangeGlass), color('Salvia', '#8A8F7A', photos.onepieceSage)],
    testedFor: ['cloro', 'upf', 'sal'],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = products.filter((other) => other.slug !== product.slug && other.category === product.category);
  const others = products.filter((other) => other.slug !== product.slug && other.category !== product.category);
  return [...sameCategory, ...others].slice(0, limit);
}

export function getBestsellers(limit = 4): Product[] {
  return [...products].sort((a, b) => a.bestsellerRank - b.bestsellerRank).slice(0, limit);
}

/** Newest products that are not already part of the best seller list. */
export function getNewArrivals(limit = 4): Product[] {
  const bestSlugs = new Set(getBestsellers(limit).map((product) => product.slug));
  return products
    .filter((product) => product.isNew && !bestSlugs.has(product.slug))
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))
    .slice(0, limit);
}

/** Price of a "from" label: the lowest price among all products of a category. */
export function startingPrice(category: Category): number {
  return Math.min(...products.filter((product) => product.category === category).map((product) => product.price));
}

export function productCount(category: Category): number {
  return products.filter((product) => product.category === category).length;
}
