import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Router from './Router';

// Mock the page components
vi.mock('./pages/Users', () => ({
  UsersPage: () => <div data-testid="mock-users-page">Users Page</div>
}));

vi.mock('./pages/Tokens', () => ({
  TokensPage: () => <div data-testid="mock-tokens-page">Tokens Page</div>
}));

describe('Router Component', () => {
  const renderWithRouter = (route: string) => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <Router />
      </MemoryRouter>
    );
  };

  it('renders UsersPage when path is /users', () => {
    renderWithRouter('/users');
    expect(screen.getByTestId('mock-users-page')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-tokens-page')).not.toBeInTheDocument();
  });

  it('renders TokensPage when path is /tokens', () => {
    renderWithRouter('/tokens');
    expect(screen.getByTestId('mock-tokens-page')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-users-page')).not.toBeInTheDocument();
  });

  it('renders nothing when no route matches', () => {
    renderWithRouter('/non-existent-path');
    expect(screen.queryByTestId('mock-users-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-tokens-page')).not.toBeInTheDocument();
  });

  it('handles nested paths correctly', () => {
    // Test that /users/123 still routes to UsersPage
    renderWithRouter('/users/123');
    expect(screen.queryByTestId('mock-users-page')).not.toBeInTheDocument();
    
    // Test that /tokens/abc still routes to TokensPage
    renderWithRouter('/tokens/abc');
    expect(screen.queryByTestId('mock-tokens-page')).not.toBeInTheDocument();
  });

  it('correctly matches exact paths', () => {
    // Test that /usersextra doesn't match /users
    renderWithRouter('/usersextra');
    expect(screen.queryByTestId('mock-users-page')).not.toBeInTheDocument();
    
    // Test that /tokensplus doesn't match /tokens
    renderWithRouter('/tokensplus');
    expect(screen.queryByTestId('mock-tokens-page')).not.toBeInTheDocument();
  });

  it('renders correctly with query parameters', () => {
    renderWithRouter('/users?filter=active');
    expect(screen.getByTestId('mock-users-page')).toBeInTheDocument();
    
    renderWithRouter('/tokens?sort=name');
    expect(screen.getByTestId('mock-tokens-page')).toBeInTheDocument();
  });
});
