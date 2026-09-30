import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter as Router } from 'react-router-dom';
import { Logo } from './Logo';

describe('Logo testing', () => {
  it('Must render Nestlé Logo with a img and a link for Home', () => {
    render(
      <Router>
        <Logo />
      </Router>,
    );
    const link = screen.getByTestId('logo_nestle');
    expect(link).toHaveAttribute('href', '/');
    const logo = screen.getByRole('img');
    expect(logo).toHaveAttribute('src', '/images/logo/logo_nestle.svg');
  });
});
