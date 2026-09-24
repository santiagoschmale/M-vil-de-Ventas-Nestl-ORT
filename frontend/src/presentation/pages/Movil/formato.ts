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

/**
 * Cómo se nombra cada unidad en pantalla. En la API la segunda se llama "plata";
 * acá "pesos", que es la unidad y se entiende fuera del Río de la Plata.
 */
export const UNIDADES = {
  kilos: { nombre: 'Kilos', simbolo: 'kg', decimales: 3 },
  plata: { nombre: 'Pesos', simbolo: '$', decimales: 2 },
} as const;

/** "7.000,000 kg" o "$ 1.234,56". */
export const conUnidad = (monto: string | null | undefined, unidad: keyof typeof UNIDADES): string =>
  unidad === 'kilos' ? `${formatear(monto)} kg` : `$ ${formatear(monto)}`;
