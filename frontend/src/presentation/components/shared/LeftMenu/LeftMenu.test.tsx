import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LeftMenu from './LeftMenu';
import { useProfile } from '../../../../stores/useProfile';

// Mock the dependencies
vi.mock('react-router-dom', () => ({
  Link: vi.fn(({ to, children, ...props }) => (
    <a href={to} data-testid="mock-link" data-to={to} {...props}>
      {children}
    </a>
  )),
  To: vi.fn(),
}));

vi.mock('../../../../stores/useProfile', () => ({
  useProfile: vi.fn(),
}));

vi.mock('../../shared/IconMenu', () => ({
  IconMenu: vi.fn(({ links, icon, anchorOrigin, transformOrigin }) => (
    <div data-testid="mock-icon-menu">
      <div data-testid="icon-menu-icon">{icon}</div>
      <div data-testid="icon-menu-links">
        {links.map((link, index) => (
          <div key={index} data-testid={`icon-menu-link-${index}`} data-name={link.name} data-location={link.location}>
            {link.name}
          </div>
        ))}
      </div>
    </div>
  )),
}));

vi.mock('../../shared/Profile', () => ({
  Profile: vi.fn(() => <div data-testid="mock-profile">Profile Component</div>),
}));

vi.mock('../../shared/Logo', () => ({
  Logo: vi.fn(() => <div data-testid="mock-logo">Logo Component</div>),
}));

vi.mock('@mui/material', () => ({
  List: vi.fn(({ children, ...props }) => <ul data-testid="mock-list" {...props}>{children}</ul>),
  ListItem: vi.fn(({ children, ...props }) => <li data-testid="mock-list-item" {...props}>{children}</li>),
  ListItemButton: vi.fn(({ children, to, component, ...props }) => (
    <div data-testid="mock-list-item-button" data-to={to} data-component={component?.name} {...props}>
      {children}
    </div>
  )),
  ListItemIcon: vi.fn(({ children, ...props }) => <div data-testid="mock-list-item-icon" {...props}>{children}</div>),
  ListItemText: vi.fn(({ primary, ...props }) => <div data-testid="mock-list-item-text" {...props}>{primary}</div>),
  Divider: vi.fn(() => <hr data-testid="mock-divider" />),
}));

vi.mock('@mui/icons-material/ExpandMoreRounded', () => ({
  default: () => <div data-testid="mock-expand-more-icon">ExpandMoreIcon</div>,
}));

vi.mock('@mui/icons-material', () => ({
  GroupRounded: () => <div data-testid="mock-group-icon">GroupIcon</div>,
  GridView: () => <div data-testid="mock-grid-icon">GridIcon</div>,
}));

vi.mock('@mui/icons-material/TableChartRounded', () => ({
  default: () => <div data-testid="mock-table-icon">TableIcon</div>,
}));

vi.mock('@mui/icons-material/KeyRounded', () => ({
  default: () => <div data-testid="mock-key-icon">KeyIcon</div>,
}));

describe('LeftMenu Component', () => {
  const mockFetchProfile = vi.fn();
  const mockIsAdmin = vi.fn();
  const mockProfile = { name: 'Test User', email: 'test@example.com' };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation
    mockIsAdmin.mockReturnValue(false);
    (useProfile as vi.Mock).mockReturnValue({
      isAdmin: mockIsAdmin,
      profile: mockProfile,
      fetchProfile: mockFetchProfile,
    });
  });
  
  it('renders the basic structure with Logo, Profile and IconMenu', () => {
    render(<LeftMenu />);
    
    expect(screen.getByTestId('mock-logo')).toBeInTheDocument();
    expect(screen.getByTestId('mock-profile')).toBeInTheDocument();
    expect(screen.getByTestId('mock-icon-menu')).toBeInTheDocument();
    expect(screen.getByTestId('mock-divider')).toBeInTheDocument();
  });
  
  it('fetches profile data on mount', () => {
    render(<LeftMenu />);
    
    expect(mockFetchProfile).toHaveBeenCalledTimes(1);
  });
  
  it('regular users only see the móvil', () => {
    mockIsAdmin.mockReturnValue(false);
    
    render(<LeftMenu />);
    
    expect(screen.queryAllByTestId('sidebar-link')).toHaveLength(1);
  });
  
  it('renders navigation items for admin users', async () => {
    mockIsAdmin.mockReturnValue(true);
    
    render(<LeftMenu />);
    
    // Wait for useEffect to update items after profile check
    await waitFor(() => {
      expect(screen.getAllByTestId('sidebar-link')).toHaveLength(3);
    });
    
    const listItemButtons = screen.getAllByTestId('mock-list-item-button');
    const listItemTexts = screen.getAllByTestId('mock-list-item-text');
    
    // Check Users navigation item
    expect(listItemButtons[1]).toHaveAttribute('data-to', '/users');
    expect(listItemTexts[1]).toHaveTextContent('Users');
    
    // Check Tokens navigation item
    expect(listItemButtons[2]).toHaveAttribute('data-to', '/tokens');
    expect(listItemTexts[2]).toHaveTextContent('Tokens');
  });
  
  it('has correct logout link in IconMenu', () => {
    render(<LeftMenu />);
    
    const logoutLink = screen.getByTestId('icon-menu-link-0');
    expect(logoutLink).toHaveAttribute('data-name', 'Logout');
    expect(logoutLink).toHaveAttribute('data-location', '/signout');
  });
  
  it('updates navigation items when profile changes', async () => {
    // Initially not an admin
    mockIsAdmin.mockReturnValue(false);
    const { rerender } = render(<LeftMenu />);
    
    expect(screen.queryAllByTestId('sidebar-link')).toHaveLength(1);
    
    // Update to admin status
    mockIsAdmin.mockReturnValue(true);
    
    // Trigger a re-render by changing profile
    (useProfile as vi.Mock).mockReturnValue({
      isAdmin: mockIsAdmin,
      profile: { ...mockProfile, isAdmin: true },
      fetchProfile: mockFetchProfile,
    });
    
    rerender(<LeftMenu />);
    
    // Wait for useEffect to update items after profile change
    await waitFor(() => {
      expect(screen.getAllByTestId('sidebar-link')).toHaveLength(3);
    });
  });
  
  it('has correct styles and layout structure', () => {
    render(<LeftMenu />);
    
    // Test would ideally check for specific styles, but that's challenging
    // In a real test with getComputedStyle or similar, we'd validate:
    // 1. Logo is centered at the top
    // 2. Navigation list takes full width
    // 3. Profile and IconMenu are at the bottom in a flex layout
    
    // For now, we're just verifying the structure is rendered
    expect(screen.getByTestId('mock-logo')).toBeInTheDocument();
    expect(screen.getByTestId('mock-list')).toBeInTheDocument();
    expect(screen.getByTestId('mock-profile')).toBeInTheDocument();
    expect(screen.getByTestId('mock-icon-menu')).toBeInTheDocument();
  });
  
  it('uses the correct icons for each navigation item', async () => {
    mockIsAdmin.mockReturnValue(true);
    
    render(<LeftMenu />);
    
    // Wait for useEffect to update items after profile check
    await waitFor(() => {
      expect(screen.getAllByTestId('sidebar-link')).toHaveLength(3);
    });
    
    const icons = screen.getAllByTestId('mock-list-item-icon');
    
    expect(icons[0]).toContainElement(screen.getByTestId('mock-table-icon'));

    // Users item should have GroupRounded icon
    expect(icons[1]).toContainElement(screen.getByTestId('mock-group-icon'));
    
    // Tokens item should have KeyRounded icon
    expect(icons[2]).toContainElement(screen.getByTestId('mock-key-icon'));
  });
});
