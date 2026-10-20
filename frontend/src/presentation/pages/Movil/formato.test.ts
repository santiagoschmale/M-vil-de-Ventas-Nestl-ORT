import { conUnidad, formatear } from './formato';

// El backend manda montos como texto con los decimales de su unidad. El front sólo
// cambia separadores: nunca pasa por un número de JavaScript.
describe('formatear', () => {
  it.each([
    ['0.000', '0,000'],
    ['12.500', '12,500'],
    ['1234.500', '1.234,500'],
    ['1234567.89', '1.234.567,89'],
    ['-1234.50', '-1.234,50'],
    ['999', '999'],
    ['1000', '1.000'],
    // Más dígitos que los que un double representa exacto: no se pierde nada.
    ['12345678901234567.891', '12.345.678.901.234.567,891'],
  ])('%s -> %s', (monto, esperado) => {
    expect(formatear(monto)).toBe(esperado);
  });

  it('un monto que no hay se muestra como raya', () => {
    expect(formatear(null)).toBe('—');
  });
});

describe('conUnidad', () => {
  it('une la unidad al número con espacio duro, para que no quede sola al cortar la línea', () => {
    expect(conUnidad('1234.50', 'plata')).toBe('$\u00A01.234,50');
    expect(conUnidad('7000.000', 'kilos')).toBe('7.000,000\u00A0kg');
  });
});
