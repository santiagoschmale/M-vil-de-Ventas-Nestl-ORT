import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { MovilPage } from './Movil';
import { mensajeDeError } from '../../../stores/useMovil/useMovil';
import { Cruce, Estado } from '../../../stores/useMovil/useMovil.type';

const vacio = { kilos: [], plata: [] };
const estado = (cambios: Partial<Estado> = {}): Estado => ({
  faltan: [],
  entradas: {
    input1: { archivo: 'input1.xlsx', skus: 2, kilos: '1500.000', nns: '100.00' },
    input2: { canales: 2, texto: 'Canal\tKilos', kilos: '1500.000', plata: '100.00' },
    base: { archivo: 'base.xlsx', celdas: 3, aperturas: 1 },
  },
  cierra: { kilos: true, plata: true },
  inconsistencias: vacio, avisos: vacio, problemas: [],
  apagados: { skus: [], entidades: [] },
  fijas: vacio, historial: [],
  ...cambios,
});

// Un monto con más dígitos de los que un float representa exacto.
const GRANDE = '12345678901234567.891';
const cruce: Cruce = {
  unidad: 'kilos', cierra: true,
  canales: [
    { nombre: 'Catering', pedido: '1000.000', repartido: '1000.000' },
    { nombre: 'Directa (BA)', pedido: '500.000', repartido: '499.999' },
  ],
  skus: [
    { codigo: '100', descripcion: 'Café 1 kg', objetivo: '1500.000', activo: true,
      celdas: { Catering: { monto: '1000.000', fijada: false }, 'Directa (BA)': { monto: GRANDE, fijada: true } } },
    { codigo: '200', descripcion: 'SKU nuevo', objetivo: '0.000', activo: true, celdas: {} },
  ],
};

const pedidos: { metodo: string; url: string; cuerpo: unknown }[] = [];
beforeEach(() => {
  pedidos.length = 0;
  const anotar = async ({ request }: { request: Request }) => {
    pedidos.push({ metodo: request.method, url: new URL(request.url).pathname, cuerpo: await request.json() });
    return HttpResponse.json(estado());
  };
  server.use(
    http.get('*/api/movil', () => HttpResponse.json(estado())),
    http.get('*/api/movil/cruce/kilos', () => HttpResponse.json(cruce)),
    http.get('*/api/movil/apertura/*', () => HttpResponse.json({ detail: 'no se abre' }, { status: 404 })),
    http.put('*/api/movil/skus/*', anotar),
    http.put('*/api/movil/celdas/*', anotar),
  );
});

// Renderiza la pantalla entera con MUI: con toda la suite en paralelo, 5 s no siempre alcanzan.
describe('MovilPage', { timeout: 15000 }, () => {
  it('muestra los montos tal como vienen, con separadores argentinos y sin redondear', async () => {
    render(<MovilPage />);
    expect(await screen.findByText('1.000,000')).toBeInTheDocument();
    expect(screen.getByText('12.345.678.901.234.567,891')).toBeInTheDocument();
    expect(screen.getByText('repartido 499,999')).toBeInTheDocument();
  });

  it('fijar una celda manda el monto como texto con su motivo', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: '100 en Catering: 1.000,000' }));
    const dialogo = screen.getByRole('dialog');
    const valor = within(dialogo).getByLabelText('Nuevo valor');
    await user.clear(valor);
    await user.type(valor, '1234,5');
    const fijar = within(dialogo).getByRole('button', { name: 'Fijar' });
    expect(fijar).toBeDisabled(); // sin motivo no se puede
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'acuerdo comercial');
    await user.click(fijar);

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual({
      metodo: 'PUT', url: '/api/movil/celdas/kilos/100/Catering',
      cuerpo: { monto: '1234,5', motivo: 'acuerdo comercial' },
    });
  });

  it('apagar un SKU pide motivo y codifica la ruta', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Apagar 200' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'SKU nuevo sin historia');
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar' }));

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual({
      metodo: 'PUT', url: '/api/movil/skus/200', cuerpo: { activo: false, motivo: 'SKU nuevo sin historia' },
    });
  });

  it('si el backend rechaza el valor, el motivo se ve en el diálogo y no se cierra', async () => {
    const detalle = 'El valor supera el objetivo del SKU 100 (1500.000).';
    server.use(http.put('*/api/movil/celdas/*', () => HttpResponse.json({ detail: detalle }, { status: 422 })));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: '100 en Catering: 1.000,000' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'x');
    await user.click(within(dialogo).getByRole('button', { name: 'Fijar' }));

    expect(await within(dialogo).findByText(detalle)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('exportar se habilita solo cuando kilos y pesos cierran', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({ cierra: { kilos: true, plata: false } }))));
    render(<MovilPage />);
    expect(await screen.findByRole('link', { name: 'Exportar' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('mensajeDeError', () => {
  it('sin respuesta es un problema de conexión', () => {
    expect(mensajeDeError(new Error('Network Error'))).toMatch(/No se pudo conectar/);
  });
  it('usa el detalle del backend cuando lo hay', () => {
    expect(mensajeDeError({ response: { status: 422, data: { detail: 'Todo ajuste necesita un motivo.' } } }))
      .toBe('Todo ajuste necesita un motivo.');
  });
  it('un 500 dice que no se aplicó', () => {
    expect(mensajeDeError({ response: { status: 500, data: 'Internal server error' } })).toMatch(/no se aplicó/);
  });
  it('una validación de formato (lista de pydantic) no muestra inglés técnico', () => {
    const m = mensajeDeError({ response: { status: 422, data: { detail: [{ msg: 'Input should be a valid string' }] } } });
    expect(m).not.toMatch(/Input should/);
  });
});
