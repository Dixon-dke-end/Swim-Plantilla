export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { href: '/coleccion', label: 'Colección' },
  { href: '/coleccion?cat=bikinis', label: 'Bikinis' },
  { href: '/coleccion?cat=enterizos', label: 'Enterizos' },
  { href: '/coleccion?cat=hombre', label: 'Hombre' },
  { href: '/pruebas', label: 'Pruebas' },
];
