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

/** "7.000,000 kg" o "$ 1.234,56", con espacio duro: al cortar la línea, la unidad no queda sola. */
export const conUnidad = (monto: string | null | undefined, unidad: keyof typeof UNIDADES): string =>
  unidad === 'kilos' ? `${formatear(monto)}\u00A0kg` : `$\u00A0${formatear(monto)}`;

/**
 * Menos de uno, también en gramos o centavos: " (100 gramos)". Con tantos ceros cuesta leerlo.
 * Opera sobre el texto ("0.100"), como formatear: no pasa por float.
 */
export const enMenores = (monto: string, unidad: keyof typeof UNIDADES): string => {
  const [entero, decimales = ''] = monto.replace(/^-/, '').split('.');
  const menores = Number(decimales);
  if (entero !== '0' || !menores) return '';
  const nombre = unidad === 'kilos' ? 'gramo' : 'centavo';
  return ` (${menores} ${nombre}${menores === 1 ? '' : 's'})`;
};

/**
 * Qué caracteres de `a` cambian respecto de `b`, alineados a la derecha (como se leen los números):
 * para resaltar el dígito que difiere entre dos montos casi iguales.
 */
export const distintos = (a: string, b: string): boolean[] => {
  const largo = Math.max(a.length, b.length);
  const [x, y] = [a.padStart(largo), b.padStart(largo)];
  return [...a].map((_, i) => x[i + largo - a.length] !== y[i + largo - a.length]);
};

/** El mes, legible: "2026-10" → "octubre 2026". */
export const nombreMes = (mes: string) => {
  const [anio, m] = mes.split('-').map(Number);
  return `${new Date(anio, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' })} ${anio}`;
};
