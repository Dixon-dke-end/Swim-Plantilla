import type { ImageMetadata } from 'astro';

import bikiniBlackTop from '../../assets/photos/bikini-black-top.jpg';
import bikiniBlueRock from '../../assets/photos/bikini-blue-rock.jpg';
import bikiniFloralBlue from '../../assets/photos/bikini-floral-blue.jpg';
import bikiniFloralPalm from '../../assets/photos/bikini-floral-palm.jpg';
import bikiniPolka from '../../assets/photos/bikini-polka.jpg';
import bikiniRedBeach from '../../assets/photos/bikini-red-beach.jpg';
import hibiscusFabric from '../../assets/photos/hibiscus-fabric.jpg';
import menBlackRock from '../../assets/photos/men-black-rock.jpg';
import menBlueShorts from '../../assets/photos/men-blue-shorts.jpg';
import menPool from '../../assets/photos/men-pool.jpg';
import menYellowRed from '../../assets/photos/men-yellow-red.jpg';
import monokiniSand from '../../assets/photos/monokini-sand.jpg';
import oceanAerial from '../../assets/photos/ocean-aerial.jpg';
import oceanRipple from '../../assets/photos/ocean-ripple.jpg';
import onepieceBlue from '../../assets/photos/onepiece-blue.jpg';
import onepieceBrownHat from '../../assets/photos/onepiece-brown-hat.jpg';
import onepieceFloral from '../../assets/photos/onepiece-floral.jpg';
import onepieceGrey from '../../assets/photos/onepiece-grey.jpg';
import onepieceSage from '../../assets/photos/onepiece-sage.jpg';
import onepieceStripeWaves from '../../assets/photos/onepiece-stripe-waves.jpg';
import poolOrangeGlass from '../../assets/photos/pool-orange-glass.jpg';
import resortPoolPalms from '../../assets/photos/resort-pool-palms.jpg';
import swimMilos from '../../assets/photos/swim-milos.jpg';

export interface Photo {
  src: ImageMetadata;
  /** Spanish alternative text. */
  alt: string;
  /** Sensible CSS object-position for cover crops. */
  position?: string;
}

export const photos = {
  bikiniBlackTop: {
    src: bikiniBlackTop,
    alt: 'Mujer con sombrero de paja y bikini negro de triángulo, sentada con la luz del atardecer',
    position: '50% 30%',
  },
  bikiniBlueRock: {
    src: bikiniBlueRock,
    alt: 'Mujer sentada sobre una roca junto al mar con bikini de tiras, vista de lado',
    position: '50% 55%',
  },
  bikiniFloralBlue: {
    src: bikiniFloralBlue,
    alt: 'Mujer frente a una roca con bikini floral azul marino con volante',
    position: '50% 40%',
  },
  bikiniFloralPalm: {
    src: bikiniFloralPalm,
    alt: 'Mujer apoyada en una palmera con bikini estampado de hojas tropicales',
    position: '50% 40%',
  },
  bikiniPolka: {
    src: bikiniPolka,
    alt: 'Mujer en la playa con bikini rojo de cintura alta y lunares blancos',
    position: '50% 40%',
  },
  bikiniRedBeach: {
    src: bikiniRedBeach,
    alt: 'Mujer sonriendo en la playa con bikini coral, con el mar de fondo',
    position: '40% 40%',
  },
  hibiscusFabric: {
    src: hibiscusFabric,
    alt: 'Detalle de una tela con estampado tropical de hibiscos y hojas de palma en tonos coral y azul',
    position: '50% 50%',
  },
  menBlackRock: {
    src: menBlackRock,
    alt: 'Hombre de espaldas con short de baño negro frente a una cala de aguas turquesa',
    position: '50% 50%',
  },
  menBlueShorts: {
    src: menBlueShorts,
    alt: 'Hombre con gafas y short de baño azul con detalles en negro sobre un terreno rocoso',
    position: '50% 45%',
  },
  menPool: {
    src: menPool,
    alt: 'Hombre saliendo de una piscina infinita con short de baño oscuro estampado',
    position: '50% 55%',
  },
  menYellowRed: {
    src: menYellowRed,
    alt: 'Hombre con short de baño amarillo estampado frente a un muro de grafiti',
    position: '50% 55%',
  },
  monokiniSand: {
    src: monokiniSand,
    alt: 'Mujer sentada sobre las rocas con enterizo de rayas azules y blancas, vista de espalda',
    position: '50% 40%',
  },
  oceanAerial: {
    src: oceanAerial,
    alt: 'Vista aérea de olas verdes rompiendo sobre la arena de una playa',
    position: '50% 50%',
  },
  oceanRipple: {
    src: oceanRipple,
    alt: 'Agua cristalina con suaves ondas y espuma blanca',
    position: '50% 50%',
  },
  onepieceBlue: {
    src: onepieceBlue,
    alt: 'Mujer con enterizo verde azulado de pie sobre una colina frente al cielo azul',
    position: '50% 55%',
  },
  onepieceBrownHat: {
    src: onepieceBrownHat,
    alt: 'Mujer con sombrero de paja y enterizo color borgoña con cortes laterales',
    position: '50% 45%',
  },
  onepieceFloral: {
    src: onepieceFloral,
    alt: 'Mujer en la orilla con enterizo floral oscuro y gafas de sol',
    position: '50% 50%',
  },
  onepieceGrey: {
    src: onepieceGrey,
    alt: 'Mujer con enterizo gris y espalda descubierta, abrazando sus rodillas',
    position: '50% 40%',
  },
  onepieceSage: {
    src: onepieceSage,
    alt: 'Mujer dentro del agua con enterizo verde salvia al atardecer',
    position: '50% 45%',
  },
  onepieceStripeWaves: {
    src: onepieceStripeWaves,
    alt: 'Mujer de espaldas con sombrero y enterizo de rayas finas entrando al mar entre las olas',
    position: '50% 35%',
  },
  poolOrangeGlass: {
    src: poolOrangeGlass,
    alt: 'Mujer en una piscina de aguas claras, apoyada en un flotador y con un vaso de bebida naranja',
    position: '50% 70%',
  },
  resortPoolPalms: {
    src: resortPoolPalms,
    alt: 'Piscina de un resort rodeada de palmeras y sombrillas naranja bajo el cielo azul',
    position: '50% 55%',
  },
  swimMilos: {
    src: swimMilos,
    alt: 'Mujer nadando vista desde arriba en aguas turquesa profundas',
    position: '50% 45%',
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof photos;
