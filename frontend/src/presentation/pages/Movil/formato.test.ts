import { formatear } from './formato';

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
