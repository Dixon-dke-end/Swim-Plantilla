import type { LabTestId } from '../../catalog/data/types';

export type LabTestKey = 'cloro' | 'sol' | 'sal' | 'elasticidad' | 'secado';

export interface LabTest {
  id: LabTestKey;
  /** Short tab label. */
  name: string;
  title: string;
  /** Number that counts up. */
  value: number;
  prefix?: string;
  suffix?: string;
  /** What the number measures. */
  valueLabel: string;
  summary: string;
  method: string;
  result: string;
  /** Progress bar 0..1. */
  score: number;
  scoreLabel: string;
  /** Product badge shown on product pages for this test, if any. */
  badge?: { id: LabTestId; label: string };
}

export const labTests: LabTest[] = [
  {
    id: 'cloro',
    name: 'Cloro',
    title: 'Resistencia al cloro',
    value: 200,
    suffix: ' h',
    valueLabel: 'de inmersión continua sin perder color',
    summary: 'Cada tela pasa 200 horas sumergida en agua con cloro antes de aprobarse.',
    method: 'Inmersión continua en agua con 3 ppm de cloro a 28 °C, con medición de color cada 25 horas.',
    result: 'Variación de color imperceptible al ojo (ΔE inferior a 1,5) y elasticidad intacta.',
    score: 0.98,
    scoreLabel: 'Color conservado',
    badge: { id: 'cloro', label: 'Cloro' },
  },
  {
    id: 'sol',
    name: 'Sol',
    title: 'Protección solar',
    value: 50,
    prefix: 'UPF ',
    suffix: '+',
    valueLabel: 'factor de protección ultravioleta',
    summary: 'La tela bloquea más del 98 % de la radiación UV, incluso mojada y estirada.',
    method: 'Cámara de xenón con radiación solar simulada. La medición se repite con la tela seca, mojada y estirada.',
    result: 'Factor de protección UPF 50+ en todas las condiciones medidas.',
    score: 0.98,
    scoreLabel: 'Radiación UV bloqueada',
    badge: { id: 'upf', label: 'UPF 50+' },
  },
  {
    id: 'sal',
    name: 'Sal',
    title: 'Resistencia al agua de mar',
    value: 300,
    suffix: ' h',
    valueLabel: 'en agua de mar sin deformarse',
    summary: 'Trescientas horas en agua salada para comprobar que la tela conserva forma y color.',
    method: 'Inmersión continua en solución salina al 3,5 % a 30 °C, con ciclos de secado al sol.',
    result: 'Sin deformaciones, sin cristales de sal visibles y con colores estables.',
    score: 0.96,
    scoreLabel: 'Forma conservada',
    badge: { id: 'sal', label: 'Sal' },
  },
  {
    id: 'elasticidad',
    name: 'Elasticidad',
    title: 'Elasticidad en cuatro direcciones',
    value: 20000,
    valueLabel: 'estiramientos sin perder la forma',
    summary: 'La tela se estira en cuatro direcciones y vuelve a su forma original después de 20.000 ciclos.',
    method: 'Estiramiento cíclico al 60 % en dirección longitudinal, transversal y ambas diagonales.',
    result: 'Recuperación del 97 % de la forma original al terminar los 20.000 ciclos.',
    score: 0.97,
    scoreLabel: 'Forma recuperada',
  },
  {
    id: 'secado',
    name: 'Secado',
    title: 'Secado rápido',
    value: 40,
    prefix: '−',
    suffix: ' %',
    valueLabel: 'menos tiempo de secado',
    summary: 'Seca un 40 % más rápido que una tela de baño convencional.',
    method: 'Pesaje cada cinco minutos de muestras saturadas de agua, a 25 °C y 60 % de humedad relativa.',
    result: 'Tiempo de secado reducido en un 40 % frente a la referencia de poliamida convencional.',
    score: 0.4,
    scoreLabel: 'Menos tiempo de secado',
  },
];

export interface LabStage {
  step: string;
  title: string;
  text: string;
}

export const labTimeline: LabStage[] = [
  {
    step: '01',
    title: 'Selección de la fibra',
    text: 'Elegimos poliamida reciclada y elastano de proveedores que certifican su origen y su resistencia.',
  },
  {
    step: '02',
    title: 'Tejido y teñido',
    text: 'Tejemos muestras y las teñimos en dos pasos para fijar el color dentro de la fibra.',
  },
  {
    step: '03',
    title: 'Cinco pruebas de laboratorio',
    text: 'Cloro, sol, sal, elasticidad y secado. Si una muestra falla en una sola, vuelve al paso uno.',
  },
  {
    step: '04',
    title: 'Prototipo en uso real',
    text: 'Un grupo de nadadores usa el prototipo durante cuatro semanas y reporta ajuste y comodidad.',
  },
  {
    step: '05',
    title: 'Aprobación y producción',
    text: 'Solo las telas que superan las cinco pruebas y el uso real pasan a producción.',
  },
];

export const labFaq: { question: string; answer: string }[] = [
  {
    question: '¿Las pruebas se hacen en un laboratorio externo?',
    answer:
      'Las pruebas de cloro, sal y elasticidad se realizan en nuestro taller de materiales. La medición de protección UV la verifica un laboratorio independiente.',
  },
  {
    question: '¿Qué significa UPF 50+?',
    answer:
      'El factor de protección ultravioleta mide cuánta radiación UV atraviesa la tela. Con UPF 50+, la tela bloquea más del 98 % de los rayos UV.',
  },
  {
    question: '¿Cuánto dura un traje de baño MAREA?',
    answer:
      'Con uso regular y siguiendo las instrucciones de cuidado, nuestras prendas conservan color y forma por varias temporadas. Si algo falla antes de lo esperado, lo cambiamos.',
  },
  {
    question: '¿Qué pasa si una tela no supera una prueba?',
    answer:
      'Se descarta. No usamos telas que superen cuatro pruebas de cinco: deben aprobar todas para llegar a producción.',
  },
  {
    question: '¿Puedo ver los informes completos?',
    answer:
      'Estamos preparando una sección con los informes de cada tela. Mientras tanto, puedes escribirnos y te los enviamos por correo.',
  },
];
