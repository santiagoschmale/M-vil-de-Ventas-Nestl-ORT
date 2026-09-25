import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { MovilPage } from './Movil';
import { mensajeDeError } from '../../../stores/useMovil/useMovil';
import { Estado } from '../../../stores/useMovil/useMovil.type';
import { cruceFactory, estadoFactory, inconsistenciaFactory, reglaFactory } from '../../../mocks/movil/fabricas';

// Un monto con más dígitos de los que un float representa exacto (está en cruceFactory).
const GRANDE = '12345678901234567.891';
const estado = (cambios: Partial<Estado> = {}) => estadoFactory.build(cambios);
const cruce = cruceFactory.build();

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

  it('una sección que se abrió sola por un problema no se cierra sola cuando se arregla', async () => {
    const reglas = [reglaFactory.build({ id: 'R1' }), reglaFactory.build({ id: 'R2', limite: 'minimo' })];
    const conflicto = estado({ reglas, inconsistencias: { kilos: [inconsistenciaFactory.build()], plata: [] } });
    server.use(
      http.get('*/api/movil', () => HttpResponse.json(conflicto)),
      http.delete('*/api/movil/reglas/*', () => HttpResponse.json(estado({ reglas: reglas.slice(0, 1) }))),
    );
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    const seccion = await screen.findByRole('button', { name: /^Reglas/ });
    expect(seccion).toHaveAttribute('aria-expanded', 'true');  // se abrió sola: hay reglas que chocan

    await user.click(screen.getByRole('button', { name: 'Eliminar R2' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'era un error');
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.queryByText('Choca')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Reglas/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('desde "Para revisar" se va a la regla que choca: abre Reglas y marca la fila', async () => {
    const reglas = [reglaFactory.build({ id: 'R1' }), reglaFactory.build({ id: 'R2', limite: 'minimo' })];
    server.use(http.get('*/api/movil', () => HttpResponse.json(
      estado({ reglas, inconsistencias: { kilos: [inconsistenciaFactory.build({ reglas: ['R1', 'R2'] })], plata: [] } }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver R2' }));
    expect(screen.getByRole('button', { name: /^Reglas/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('row', { name: /^R2 / })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('row', { name: /^R1 / })).not.toHaveAttribute('aria-current');
  });

  it('desde "Para revisar" se va a la fila del SKU en la matriz', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      problemas: [{ severidad: 'aviso', mensaje: 'SKU con objetivo en cero.', sku: '200', bloque: 'input1' }],
    }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Para revisar/ }));  // no bloquea: está cerrada
    await user.click(screen.getByRole('button', { name: 'Ver SKU 200' }));
    expect(screen.getByRole('row', { name: /^Apagar 200/ })).toHaveAttribute('aria-current', 'true');
  });

  it('un problema de un SKU que no está en la matriz no ofrece ir a verlo', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      problemas: [{ severidad: 'aviso', mensaje: 'Producto de otro país.', sku: '999', bloque: 'input1' }],
    }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Para revisar/ }));
    expect(screen.getByText(/Producto de otro país/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ver SKU 999' })).not.toBeInTheDocument();
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
