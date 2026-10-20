const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Formats an amount in Colombian pesos, e.g. `$ 159.000`. */
export function formatCOP(amount: number): string {
  return copFormatter.format(amount);
}

const integerFormatter = new Intl.NumberFormat('es-CO');

/** Formats a plain number with Colombian separators, e.g. `20.000`. */
export function formatNumber(value: number, fractionDigits = 0): string {
  if (fractionDigits === 0) return integerFormatter.format(Math.round(value));
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
