export interface Review {
  name: string;
  /** City initial and short code, kept deliberately generic. */
  city: string;
  rating: 4 | 5;
  title: string;
  body: string;
  product: string;
}

/** Sample content for the prototype. Names and cities are generic placeholders. */
export const reviews: Review[] = [
  {
    name: 'Camila',
    city: 'B.',
    rating: 5,
    title: 'No se corre ni se transparenta',
    body: 'Lo usé una semana entera en la piscina y el mar. El color sigue igual y el ajuste es perfecto.',
    product: 'Enterizo Ola',
  },
  {
    name: 'Daniela',
    city: 'M.',
    rating: 5,
    title: 'La mejor talla que he comprado online',
    body: 'La guía de tallas es precisa. El calzón no se mueve y el top sostiene sin apretar.',
    product: 'Bikini Alba',
  },
  {
    name: 'Andrés',
    city: 'C.',
    rating: 5,
    title: 'Seca rapidísimo',
    body: 'Salí del mar y en veinte minutos ya estaba seco. El bolsillo con cierre es un acierto.',
    product: 'Short Costa',
  },
  {
    name: 'Laura',
    city: 'B.',
    rating: 4,
    title: 'Hermoso estampado',
    body: 'Los colores son aún más bonitos en persona. Recomiendo pedir una talla según la guía.',
    product: 'Bikini Palma',
  },
  {
    name: 'Valentina',
    city: 'M.',
    rating: 5,
    title: 'Cómodo todo el día',
    body: 'Costuras planas, tela suave y una caída muy elegante. Ideal para viajes largos.',
    product: 'Enterizo Lago',
  },
  {
    name: 'Mateo',
    city: 'C.',
    rating: 5,
    title: 'Resiste el cloro',
    body: 'Entreno natación tres veces por semana y después de un mes se ve como el primer día.',
    product: 'Short Piscina',
  },
  {
    name: 'Sofía',
    city: 'P.',
    rating: 5,
    title: 'Un empaque muy cuidado',
    body: 'Llegó en dos días, en un empaque de papel reciclado. La calidad se nota desde que lo abres.',
    product: 'Enterizo Jardín',
  },
  {
    name: 'Isabela',
    city: 'S.',
    rating: 4,
    title: 'Favorito del verano',
    body: 'El corte de cintura alta favorece muchísimo. Lo volvería a comprar en otro color.',
    product: 'Bikini Lunares',
  },
];
