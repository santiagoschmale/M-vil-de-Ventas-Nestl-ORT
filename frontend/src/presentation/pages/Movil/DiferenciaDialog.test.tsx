import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { estadoFactory } from '../../../mocks/movil/fabricas';
import { Diferencia } from '../../../stores/useMovil/useMovil.type';
import { DiferenciaDialog } from './DiferenciaDialog';

const canal = (nombre: string, hoy: string, peso: string, sugerido: string, cambio: string) =>
  ({ canal: nombre, hoy, peso, sugerido, cambio, error: null });

const sugerencia: Diferencia = {
  unidad: 'kilos', pide: '1000.000', suman: '999.900', diferencia: '0.100', falta: '0.000', cierra: true,
  canales: [canal('Catering', '600.000', '66.7', '666.667', '66.667'), canal('Vending', '300.000', '33.3', '333.333', '33.333')],
};

describe('DiferenciaDialog', { timeout: 15000 }, () => {
  let revisados: Record<string, string>[];
  let aplicado: { valores: Record<string, string>; motivo: string } | undefined;

  beforeEach(() => {
    revisados = [];
    aplicado = undefined;
    server.use(
      http.get('*/api/movil/diferencia/kilos', () => HttpResponse.json(sugerencia)),
      // El backend calcula: acá se simula con los dos casos que usa el test.
      http.post('*/api/movil/diferencia/kilos/revisar', async ({ request }) => {
        const { valores } = await request.json() as { valores: Record<string, string> };
        revisados.push(valores);
        if (valores.Catering === '546,667') {
          return HttpResponse.json({ ...sugerencia, falta: '120.000', cierra: false,
            canales: [{ ...sugerencia.canales[0], cambio: '-53.333' }, sugerencia.canales[1]] });
        }
        if (valores.Catering === '700') {
          return HttpResponse.json({ ...sugerencia, falta: '-33.333', cierra: false,
            canales: [{ ...sugerencia.canales[0], cambio: '100.000' }, sugerencia.canales[1]] });
        }
        if (valores.Catering === 'mucho') {
          return HttpResponse.json({ ...sugerencia, falta: null, cierra: false,
            canales: [{ ...sugerencia.canales[0], cambio: null, error: 'no es un número' }, sugerencia.canales[1]] });
        }
        return HttpResponse.json(sugerencia);
      }),
      http.put('*/api/movil/diferencia/kilos', async ({ request }) => {
        aplicado = await request.json() as typeof aplicado;
        return HttpResponse.json(estadoFactory.build());
      }),
      http.get('*/api/movil/cruce/*', () => HttpResponse.json({ unidad: 'kilos', cierra: true, canales: [], skus: [] })),
      http.get('*/api/movil/meses', () => HttpResponse.json([{ mes: '2026-10', aprobado: false }])),
    );
  });

  const cambiar = async (user: ReturnType<typeof userEvent.setup>, valor: string) => {
    const campo = screen.getByRole('textbox', { name: 'Queda en Catering' });
    await user.clear(campo);
    await user.type(campo, valor);
  };

  it('arranca con la sugerencia, que cierra, y con el peso y el cambio de cada canal', async () => {
    render(<DiferenciaDialog unidad="kilos" onCerrar={vi.fn()} />);
    expect(await screen.findByText('Repartido: cierra con Contraloría')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Queda en Catering' })).toHaveValue('666,667');
    expect(screen.getByText('66,7 %')).toBeInTheDocument();
    // La diferencia, en gramos porque es chica, y los dígitos que cambian resaltados.
    expect(screen.getByText('Faltan')).toBeInTheDocument();
    expect(screen.getByText(/^0,100.kg \(100 gramos\)$/)).toBeInTheDocument();
    expect(document.querySelectorAll('mark').length).toBeGreaterThan(0);
    expect(screen.getByText('+66,667')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aplicar a los totales' })).toBeEnabled());
  });

  it('mientras escribís dice cuánto falta o sobra, y no deja aplicar hasta que cierre', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DiferenciaDialog unidad="kilos" onCerrar={vi.fn()} />);
    await screen.findByText('Repartido: cierra con Contraloría');

    await cambiar(user, '546,667');
    expect(await screen.findByText('Falta repartir')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('120,000');
    expect(screen.getByText('−53,333')).toBeInTheDocument();
    expect(screen.getByText('sugerido: 666,667')).toBeInTheDocument();
    expect(screen.getByText('Para aplicar, repartí los 120,000 kg que faltan.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar a los totales' })).toBeDisabled();

    await cambiar(user, '700');
    expect(await screen.findByText('Te pasaste: sobran')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('33,333');
    expect(screen.getByText('Para aplicar, sacá los 33,333 kg que sobran.')).toBeInTheDocument();

    await cambiar(user, 'mucho');
    expect(await screen.findByText('Este valor no es un número')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Volver a la sugerencia' }));
    expect(await screen.findByText('Repartido: cierra con Contraloría')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Queda en Catering' })).toHaveValue('666,667');
  });

  it('aplica con motivo los valores revisados', async () => {
    const user = userEvent.setup({ delay: null });
    const onCerrar = vi.fn();
    render(<DiferenciaDialog unidad="kilos" onCerrar={onCerrar} />);
    await screen.findByText('Repartido: cierra con Contraloría');
    const aplicar = screen.getByRole('button', { name: 'Aplicar a los totales' });
    await waitFor(() => expect(aplicar).toBeEnabled());
    await user.click(aplicar);
    expect(await screen.findByText('Escribí el motivo: queda en el historial.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /Motivo/ }), 'Contraloría ajustó');
    await user.click(aplicar);
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(aplicado).toEqual({ valores: { Catering: '666,667', Vending: '333,333' }, motivo: 'Contraloría ajustó' });
  });
});
