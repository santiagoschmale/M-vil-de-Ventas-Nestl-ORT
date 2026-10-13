import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { estadoFactory } from '../../../mocks/movil/fabricas';
import { ReiniciarDialog } from './ReiniciarDialog';

describe('ReiniciarDialog', { timeout: 15000 }, () => {
  it('avisa que borra todo y, al confirmar, pide empezar de cero', async () => {
    let pedido = false;
    server.use(
      http.post('*/api/movil/reiniciar', () => { pedido = true; return HttpResponse.json(estadoFactory.build()); }),
      http.get('*/api/movil/cruce/*', () => HttpResponse.json({ unidad: 'kilos', cierra: true, canales: [], skus: [] })),
      http.get('*/api/movil/meses', () => HttpResponse.json([{ mes: '2026-10', aprobado: false }])),
    );
    const onCerrar = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<ReiniciarDialog onCerrar={onCerrar} />);
    expect(screen.getByText(/No se puede deshacer/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Borrar todo' }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(pedido).toBe(true);
  });
});
