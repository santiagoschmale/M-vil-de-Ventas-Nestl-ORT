/**
 * "1234567.89" -> "1.234.567,89". Opera sobre el texto: un monto nunca pasa por
 * un número de JavaScript (float), así que no se redondea nada al mostrarlo.
 */
export const formatear = (monto: string | null | undefined): string => {
  if (monto == null) return '—';
  const [entero, decimales] = monto.split('.');
  const signo = entero.startsWith('-') ? '-' : '';
  const miles = entero.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}${miles}${decimales === undefined ? '' : `,${decimales}`}`;
};
