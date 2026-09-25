// Tinta de planner: lo que alguien fijó a mano se ve como una marca sobre la planilla.
export const TINTA = '#1F4E9A';
export const AVENA = '#E7E4E1';
export const CIERRA = '#2E7D4F';
export const NO_CIERRA = '#B3261E';
export const APAGADO = '#8A8580';
// La fila a la que se llegó desde "Para revisar".
// Opaco: la primera columna de la matriz es fija y no tiene que transparentar lo que pasa por detrás.
export const ENFOCADA = {
  '& td': { backgroundColor: '#ECF0F6' },
  '& td:first-of-type': { boxShadow: `inset 3px 0 0 ${TINTA}` },
};

export const numeros = {
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
};
