import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Router from './Router';

vi.mock('./pages/Movil', () => ({
  MovilPage: () => <div data-testid="mock-movil-page">Móvil</div>
}));

describe('Router', () => {
  const renderEn = (ruta: string) => render(
    <MemoryRouter initialEntries={[ruta]}><Router /></MemoryRouter>
  );

  it('la raíz muestra la pantalla del móvil', () => {
    renderEn('/');
    expect(screen.getByTestId('mock-movil-page')).toBeInTheDocument();
  });

  it('una ruta que no existe no muestra nada', () => {
    renderEn('/no-existe');
    expect(screen.queryByTestId('mock-movil-page')).not.toBeInTheDocument();
  });
});