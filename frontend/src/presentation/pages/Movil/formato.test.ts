import { conUnidad, distintos, enMenores, formatear } from './formato';

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

describe('enMenores y distintos', () => {
  it('una cantidad menor a uno también se dice en gramos o centavos', () => {
    expect(enMenores('0.100', 'kilos')).toBe(' (100 gramos)');
    expect(enMenores('-0.001', 'kilos')).toBe(' (1 gramo)');
    expect(enMenores('0.50', 'plata')).toBe(' (50 centavos)');
    expect(enMenores('1.500', 'kilos')).toBe('');
    expect(enMenores('0.000', 'kilos')).toBe('');
  });

  it('marca los dígitos que cambian, alineando a la derecha', () => {
    expect(distintos('454.981,590', '454.981,490').map((d, i) => (d ? i : -1)).filter(i => i >= 0)).toEqual([8]);
    expect(distintos('1.000,000', '999,000').filter(Boolean).length).toBe(5);
  });
});
