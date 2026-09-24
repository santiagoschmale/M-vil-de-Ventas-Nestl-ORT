import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Instead of trying to mock the component itself, we'll mock the dependencies and test the real component
// Mock Material-UI components
vi.mock('@mui/material', () => ({
  TextField: vi.fn(({ variant, onChange, InputProps }) => (
    <div data-testid="mock-textfield" data-variant={variant}>
      <input 
        data-testid="mock-input" 
        onChange={onChange} 
        placeholder="Search"
      />
      {InputProps?.startAdornment && (
        <div data-testid="input-adornment">
          {InputProps.startAdornment}
        </div>
      )}
    </div>
  )),
  InputAdornment: vi.fn(({ position, children }) => (
    <div data-testid="input-adornment-component" data-position={position}>
      {children}
    </div>
  ))
}));

// Mock the search icon
vi.mock('@mui/icons-material/SearchRounded', () => ({
  default: vi.fn(() => <div data-testid="search-icon">SearchIcon</div>)
}));

// Mock setTimeout and clearTimeout globally
vi.stubGlobal('setTimeout', vi.fn((fn) => {
  // Execute the function immediately in tests
  fn();
  // Return a fake timer ID
  return 123;
}));

vi.stubGlobal('clearTimeout', vi.fn());

// Now import the real component
import FilterTextField from './FilterTextField';

describe('FilterTextField Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders correctly with search icon', () => {
    const mockFilter = vi.fn();
    render(<FilterTextField filter={mockFilter} />);
    
    expect(screen.getByTestId('mock-textfield')).toBeInTheDocument();
    expect(screen.getByTestId('mock-input')).toBeInTheDocument();
    
    // Check if the search icon is displayed in the input adornment
    expect(screen.getByTestId('input-adornment')).toBeInTheDocument();
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });
  
  it('calls filter function when input changes', () => {
    const mockFilter = vi.fn();
    render(<FilterTextField filter={mockFilter} />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'test' } });
    
    // Because we stubbed setTimeout to execute immediately,
    // mockFilter should have been called
    expect(mockFilter).toHaveBeenCalledWith('test');
  });
  
  it('renders with standard variant by default', () => {
    const mockFilter = vi.fn();
    render(<FilterTextField filter={mockFilter} />);
    
    expect(screen.getByTestId('mock-textfield')).toHaveAttribute('data-variant', 'standard');
  });
  
  it('positions the adornment at the start', () => {
    const mockFilter = vi.fn();
    render(<FilterTextField filter={mockFilter} />);
    
    expect(screen.getByTestId('input-adornment-component')).toHaveAttribute('data-position', 'start');
  });
  
  it('cleans up timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const mockFilter = vi.fn();
    const { unmount } = render(<FilterTextField filter={mockFilter} />);
    
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
