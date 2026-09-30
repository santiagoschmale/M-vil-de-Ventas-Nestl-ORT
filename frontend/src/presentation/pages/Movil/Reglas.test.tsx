import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { estadoFactory, inconsistenciaFactory, reglaFactory } from '../../../mocks/movil/fabricas';
import { Reglas } from './Reglas';

const pedidos: { metodo: string; url: string; cuerpo: unknown }[] = [];

beforeEach(() => {
  pedidos.length = 0;
  reglaFactory.rewindSequence();
  const anotar = async ({ request }: { request: Request }) => {
    pedidos.push({ metodo: request.method, url: new URL(request.url).pathname, cuerpo: await request.json() });
    return HttpResponse.json(estadoFactory.build());
  };
  server.use(
    http.post('*/api/movil/reglas', anotar),
    http.put('*/api/movil/reglas/*', anotar),
    http.delete('*/api/movil/reglas/*', anotar),
    http.get('*/api/movil/cruce/*', () => HttpResponse.json({ unidad: 'kilos', cierra: true, canales: [], skus: [] })),
  );
});

// Formularios de MUI enteros: con toda la suite en paralelo, 5 s no siempre alcanzan.
describe('Reglas', { timeout: 15000 }, () => {
  it('sin reglas explica qué es una y cómo empezar', () => {
    render(<Reglas estado={estadoFactory.build()} />);
    expect(screen.getByText(/Todavía no hay reglas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar regla' })).toBeInTheDocument();
  });

  it('lista cada regla con sus porcentajes y marca las que chocan', () => {
    const estado = estadoFactory.build({
      reglas: [reglaFactory.build(), reglaFactory.build({ limite: 'minimo', kilos: '15', nns: null }),
               reglaFactory.build({ canal: 'Directa (BA)', categorias: ['Café', 'Lácteos'], kilos: null, nns: '12.5' })],
      inconsistencias: { kilos: [inconsistenciaFactory.build({ reglas: ['R1', 'R2'] })], plata: [] },
    });
    render(<Reglas estado={estado} />);
    const fila = (id: string) => screen.getByRole('row', { name: new RegExp(`^${id} `) });
    expect(within(fila('R1')).getByText('20%')).toBeInTheDocument();
    expect(within(fila('R1')).getByText('25%')).toBeInTheDocument();
    expect(within(fila('R1')).getByText('Choca')).toBeInTheDocument();
    expect(within(fila('R2')).getByText('Mínimo')).toBeInTheDocument();
    expect(within(fila('R2')).getByText('—')).toBeInTheDocument(); // no aplica en pesos
    expect(within(fila('R3')).getByText('12,5%')).toBeInTheDocument();
    expect(within(fila('R3')).queryByText('Choca')).not.toBeInTheDocument();
  });

  it('agregar manda los porcentajes como texto, null donde no aplica, y el motivo', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Reglas estado={estadoFactory.build()} />);
    await user.click(screen.getByRole('button', { name: 'Agregar regla' }));
    const dialogo = screen.getByRole('dialog');
    await user.selectOptions(within(dialogo).getByLabelText('Canal'), 'Catering');
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Café' }));
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Chocolatería' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Mínimo' }));
    await user.type(within(dialogo).getByLabelText('% de kilos'), '30');
    const agregar = within(dialogo).getByRole('button', { name: 'Agregar' });
    expect(agregar).toBeDisabled(); // sin motivo
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'pedido comercial');
    await user.click(agregar);

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual({
      metodo: 'POST', url: '/api/movil/reglas',
      cuerpo: { canal: 'Catering', categorias: ['Café', 'Chocolatería'], limite: 'minimo', kilos: '30', nns: null,
                motivo: 'pedido comercial' },
    });
  });

  it('si el backend rechaza la regla, el motivo se ve en el diálogo y no se cierra', async () => {
    const detalle = 'El % de kilos tiene que estar entre 0 y 100.';
    server.use(http.post('*/api/movil/reglas', () => HttpResponse.json({ detail: detalle }, { status: 422 })));
    const user = userEvent.setup({ delay: null });
    render(<Reglas estado={estadoFactory.build()} />);
    await user.click(screen.getByRole('button', { name: 'Agregar regla' }));
    const dialogo = screen.getByRole('dialog');
    await user.selectOptions(within(dialogo).getByLabelText('Canal'), 'Catering');
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Café' }));
    await user.type(within(dialogo).getByLabelText('% de kilos'), '150');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'x');
    await user.click(within(dialogo).getByRole('button', { name: 'Agregar' }));
    expect(await within(dialogo).findByText(detalle)).toBeInTheDocument();
  });

  it('editar arranca con los datos de la regla y guarda sobre su id', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Reglas estado={estadoFactory.build({ reglas: [reglaFactory.build()] })} />);
    await user.click(screen.getByRole('button', { name: 'Editar R1' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByLabelText('% de kilos')).toHaveValue('20');
    expect(within(dialogo).getByRole('checkbox', { name: 'Café' })).toBeChecked();
    await user.clear(within(dialogo).getByLabelText('% de pesos'));
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'solo kilos');
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toMatchObject({ metodo: 'PUT', url: '/api/movil/reglas/R1', cuerpo: { kilos: '20', nns: null } });
  });

  it('eliminar pide motivo', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Reglas estado={estadoFactory.build({ reglas: [reglaFactory.build()] })} />);
    await user.click(screen.getByRole('button', { name: 'Eliminar R1' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'se cayó el acuerdo');
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual({ metodo: 'DELETE', url: '/api/movil/reglas/R1', cuerpo: { motivo: 'se cayó el acuerdo' } });
  });
});
