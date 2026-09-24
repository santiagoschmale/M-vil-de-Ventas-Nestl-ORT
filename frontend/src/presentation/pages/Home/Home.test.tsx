import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Home } from './Home';

// Mock the dependencies
vi.mock('../../components/shared/LeftMenu/LeftMenu', () => ({
  default: () => <div data-testid="mock-left-menu">Mock Left Menu</div>
}));

vi.mock('../../components/shared/SnackBar', () => ({
  SnackbarGlobal: () => <div data-testid="mock-snackbar-global">Mock Snackbar Global</div>
}));

vi.mock('../../Router', () => ({
  default: () => <div data-testid="mock-router">Mock Router</div>
}));

describe('Home Component', () => {
  it('renders all child components correctly', () => {
    render(<Home />);
    
    // Check if SnackbarGlobal component is rendered
    expect(screen.getByTestId('mock-snackbar-global')).toBeInTheDocument();
    
    // Check if LeftMenu component is rendered
    expect(screen.getByTestId('mock-left-menu')).toBeInTheDocument();
    
    // Check if Router component is rendered
    expect(screen.getByTestId('mock-router')).toBeInTheDocument();
  });

  it('has the expected layout structure', () => {
    const { container } = render(<Home />);
    
    // Check that the component has the expected structure
    // First div (containing LeftMenu) should have the expected styles
    const divElements = container.querySelectorAll('div');
    expect(divElements.length).toBeGreaterThanOrEqual(3);
    
    // First div should contain LeftMenu and have expected styles
    const leftMenuContainer = screen.getByTestId('mock-left-menu').parentElement;
    expect(leftMenuContainer).toHaveStyle({
      minWidth: '250px',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#E7E4E1'
    });
    
    // Second div should contain Router and have expected styles
    const routerContainer = screen.getByTestId('mock-router').parentElement;
    expect(routerContainer).toHaveStyle({
      flexGrow: 1,
      overflow: 'auto'
    });
  });
});
