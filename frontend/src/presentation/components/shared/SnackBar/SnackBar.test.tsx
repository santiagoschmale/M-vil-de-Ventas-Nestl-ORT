import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SnackbarGlobal from './SnackBar';
import { useSnackbarProps } from '../../../../stores/useSnackbarProps';

// Mock the useSnackbarProps hook
vi.mock('../../../../stores/useSnackbarProps', () => ({
  useSnackbarProps: vi.fn()
}));

// Mock Material-UI components to avoid testing library issues
vi.mock('@mui/material', () => {
  return {
    Alert: vi.fn(({ children, severity, onClose }) => (
      <div 
        data-testid="mui-alert" 
        data-severity={severity}
      >
        {children}
        <button 
          data-testid="alert-close-button" 
          onClick={onClose}
        >
          Close
        </button>
      </div>
    )),
    Snackbar: vi.fn(({ open, onClose, autoHideDuration, anchorOrigin, children }) => (
      open ? (
        <div 
          data-testid="mui-snackbar"
          data-anchor-vertical={anchorOrigin?.vertical}
          data-anchor-horizontal={anchorOrigin?.horizontal}
          data-auto-hide-duration={autoHideDuration}
        >
          {children}
          <div data-testid="snackbar-lifecycle">
            <button 
              data-testid="trigger-auto-hide" 
              onClick={() => onClose({} as Event, 'timeout')}
            >
              Trigger auto-hide
            </button>
            <button 
              data-testid="trigger-clickaway" 
              onClick={() => onClose({} as Event, 'clickaway')}
            >
              Trigger clickaway
            </button>
          </div>
        </div>
      ) : null
    ))
  };
});

describe('SnackbarGlobal', () => {
  const mockSetSnackbarProps = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('does not render when snackbarProps is undefined', () => {
    (useSnackbarProps as vi.Mock).mockReturnValue({
      snackbarProps: undefined,
      setSnackbarProps: mockSetSnackbarProps
    });
    
    render(<SnackbarGlobal />);
    
    expect(screen.queryByTestId('mui-snackbar')).not.toBeInTheDocument();
  });
  
  it('renders with correct message and severity when snackbarProps is set', () => {
    (useSnackbarProps as vi.Mock).mockReturnValue({
      snackbarProps: { 
        message: 'Test message', 
        severity: 'success' 
      },
      setSnackbarProps: mockSetSnackbarProps
    });
    
    render(<SnackbarGlobal />);
    
    const snackbar = screen.getByTestId('mui-snackbar');
    const alert = screen.getByTestId('mui-alert');
    
    expect(snackbar).toBeInTheDocument();
    expect(alert).toHaveTextContent('Test message');
    expect(alert).toHaveAttribute('data-severity', 'success');
  });
  
  it('renders with different severity types', () => {
    (useSnackbarProps as vi.Mock).mockReturnValue({
      snackbarProps: { 
        message: 'Error occurred', 
        severity: 'error' 
      },
      setSnackbarProps: mockSetSnackbarProps
    });
    
    render(<SnackbarGlobal />);
    
    expect(screen.getByTestId('mui-alert')).toHaveAttribute('data-severity', 'error');
  });
  
  it('is anchored at the top-right position', () => {
    (useSnackbarProps as vi.Mock).mockReturnValue({
      snackbarProps: { message: 'Test message' },
      setSnackbarProps: mockSetSnackbarProps
    });
    
    render(<SnackbarGlobal />);
    
    const snackbar = screen.getByTestId('mui-snackbar');
    expect(snackbar).toHaveAttribute('data-anchor-vertical', 'top');
    expect(snackbar).toHaveAttribute('data-anchor-horizontal', 'right');
  });
  
  it('has 5000ms auto-hide duration', () => {
    (useSnackbarProps as vi.Mock).mockReturnValue({
      snackbarProps: { message: 'Test message' },
      setSnackbarProps: mockSetSnackbarProps
    });
    
    render(<SnackbarGlobal />);
    
    const snackbar = screen.getByTestId('mui-snackbar');
    expect(snackbar).toHaveAttribute('data-auto-hide-duration', '5000');
  });
  
  it('calls setSnackbarProps(undefined) when closed via Alert close button', () => {
    (useSnackbarProps as vi.Mock).mockReturnValue({
      snackbarProps: { message: 'Test message' },
      setSnackbarProps: mockSetSnackbarProps
    });
    
    render(<SnackbarGlobal />);
    
    const closeButton = screen.getByTestId('alert-close-button');
    fireEvent.click(closeButton);
    
    expect(mockSetSnackbarProps).toHaveBeenCalledWith(undefined);
  });
  
  it('calls setSnackbarProps(undefined) when auto-hide timeout occurs', () => {
    (useSnackbarProps as vi.Mock).mockReturnValue({
      snackbarProps: { message: 'Test message' },
      setSnackbarProps: mockSetSnackbarProps
    });
    
    render(<SnackbarGlobal />);
    
    const autoHideButton = screen.getByTestId('trigger-auto-hide');
    fireEvent.click(autoHideButton);
    
    expect(mockSetSnackbarProps).toHaveBeenCalledWith(undefined);
  });
  
  it('does not close when reason is clickaway', () => {
    (useSnackbarProps as vi.Mock).mockReturnValue({
      snackbarProps: { message: 'Test message' },
      setSnackbarProps: mockSetSnackbarProps
    });
    
    render(<SnackbarGlobal />);
    
    const clickAwayButton = screen.getByTestId('trigger-clickaway');
    fireEvent.click(clickAwayButton);
    
    expect(mockSetSnackbarProps).not.toHaveBeenCalled();
  });
});
