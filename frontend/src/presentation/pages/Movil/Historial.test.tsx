import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Historial } from './Historial';

const ajuste = (accion: string, cuando: string, motivo: string | null = null) =>
  ({ accion, detalle: 'algo', autor: 'planner-local', cuando, motivo });

describe('Historial', () => {
  it('agrupa por día, lo más nuevo arriba, con la clase de cambio, la hora y el motivo', () => {
    const hoy = new Date('2026-11-02T15:00:00');
    render(<Historial hoy={hoy} acciones={{ cargar_input1: 'Cargó el objetivo', fijar: 'Fijó una celda', aprobar: 'Aprobó' }}
      historial={[
        ajuste('cargar_input1', '2026-10-31T09:00:00'),
        ajuste('fijar', '2026-11-01T10:30:00', 'acuerdo comercial'),
        ajuste('aprobar', '2026-11-02T11:05:00'),
      ]} />);
    const dias = screen.getAllByRole('region');
    expect(dias.map(d => d.getAttribute('aria-label'))).toEqual(['Hoy', 'Ayer', 'Sábado, 31 de octubre']);
    expect(within(dias[0]).getByText('Revisión')).toBeInTheDocument();
    expect(within(dias[1]).getByText('Ajuste')).toBeInTheDocument();
    expect(within(dias[1]).getByText(/«acuerdo comercial»/)).toBeInTheDocument();
    expect(within(dias[2]).getByText('Carga')).toBeInTheDocument();
    expect(within(dias[0]).getByText(/^11:05/)).toBeInTheDocument();
  });
});
