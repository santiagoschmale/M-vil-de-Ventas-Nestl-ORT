import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FormDialog from './FormDialog';

// Mock console.error to suppress expected errors
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Mock the Material-UI components to simplify testing
vi.mock('@mui/material', () => ({
  AppBar: vi.fn(({ children, ...props }) => <div data-testid="app-bar" {...props}>{children}</div>),
  Box: vi.fn(({ children, ...props }) => <div data-testid="box" {...props}>{children}</div>),
  Button: vi.fn(({ children, onClick, type, ...props }) => (
    <button 
      data-testid={`button-${children?.toString().toLowerCase()}`} 
      type={type} 
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )),
  Dialog: vi.fn(({ children, open, onClose, PaperProps, ...props }) => {
    // Create a safer version of onSubmit that won't cause unhandled rejections
    const safeOnSubmit = PaperProps?.onSubmit 
      ? async (e) => {
          e.preventDefault();
          try {
            await PaperProps.onSubmit(e);
          } catch (error) {
            // Silence the error in tests
          }
        }
      : undefined;
    
    return open ? (
      <div 
        data-testid="dialog" 
        role="dialog"
        {...props}
      >
        <form 
          onSubmit={safeOnSubmit}
          data-component={PaperProps?.component}
          data-testid="dialog-form"
        >
          {children}
        </form>
      </div>
    ) : null;
  }),
  DialogActions: vi.fn(({ children, ...props }) => <div data-testid="dialog-actions" {...props}>{children}</div>),
  DialogContent: vi.fn(({ children, ...props }) => <div data-testid="dialog-content" {...props}>{children}</div>),
  IconButton: vi.fn(({ children, onClick, 'aria-label': ariaLabel, ...props }) => (
    <button 
      data-testid={`icon-button-${ariaLabel}`} 
      onClick={onClick}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  )),
  Modal: vi.fn(({ children, ...props }) => <div data-testid="modal" {...props}>{children}</div>),
  Toolbar: vi.fn(({ children, ...props }) => <div data-testid="toolbar" {...props}>{children}</div>),
  Typography: vi.fn(({ children, ...props }) => <div data-testid="typography" {...props}>{children}</div>),
  CircularProgress: vi.fn(() => <div data-testid="circular-progress" />),
}));

// Mock CloseIcon
vi.mock('@mui/icons-material/Close', () => ({
  default: vi.fn(() => <div data-testid="close-icon">CloseIcon</div>),
}));

describe('FormDialog Component', () => {
  const defaultProps = {
    open: true,
    title: 'Test Dialog',
    onClose: vi.fn(),
    process: vi.fn().mockResolvedValue(undefined),
    afterSubmitHandler: vi.fn(),
    children: <input name="testField" defaultValue="testValue" data-testid="test-input" />,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(<FormDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when open is true', () => {
    render(<FormDialog {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('typography')).toHaveTextContent('Test Dialog');
  });

  it('renders the children (form fields)', () => {
    render(<FormDialog {...defaultProps} />);
    expect(screen.getByTestId('test-input')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<FormDialog {...defaultProps} />);
    const closeButton = screen.getByTestId('icon-button-close');
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls process and afterSubmitHandler when form is submitted', async () => {
    const mockProcess = vi.fn().mockResolvedValue(undefined);
    const mockAfterSubmitHandler = vi.fn();

    render(
      <FormDialog 
        {...defaultProps} 
        process={mockProcess}
        afterSubmitHandler={mockAfterSubmitHandler}
      />
    );
    
    const form = screen.getByTestId('dialog-form');
    fireEvent.submit(form);
    
    // Check that process was called with form data
    await waitFor(() => {
      expect(mockProcess).toHaveBeenCalledTimes(1);
    });
    
    // The form data object should contain our test field
    const formData = mockProcess.mock.calls[0][0];
    expect(formData).toHaveProperty('testField', 'testValue');
    
    // Check that afterSubmitHandler was called
    await waitFor(() => {
      expect(mockAfterSubmitHandler).toHaveBeenCalledTimes(1);
    });
  });

  it('handles error in process without calling afterSubmitHandler', async () => {
    // Create a simple rejection that won't cause issues
    const mockProcess = vi.fn().mockRejectedValue('error');
    const mockAfterSubmitHandler = vi.fn();
    
    render(
      <FormDialog 
        {...defaultProps} 
        process={mockProcess}
        afterSubmitHandler={mockAfterSubmitHandler}
      />
    );
    
    const form = screen.getByTestId('dialog-form');
    fireEvent.submit(form);
    
    // Let the promise rejection settle
    await new Promise(resolve => setTimeout(resolve, 0));
    
    await waitFor(() => {
      expect(mockProcess).toHaveBeenCalledTimes(1);
    });
    
    // afterSubmitHandler should not be called when process fails
    expect(mockAfterSubmitHandler).not.toHaveBeenCalled();
  });

  it('renders save button in dialog actions', () => {
    render(<FormDialog {...defaultProps} />);
    
    const saveButton = screen.getByTestId('button-save');
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toHaveAttribute('type', 'submit');
  });

  it('configures the dialog with correct props', () => {
    render(<FormDialog {...defaultProps} />);
    
    const dialog = screen.getByTestId('dialog');
    const form = screen.getByTestId('dialog-form');
    
    // Check that dialog is using form component for its Paper
    expect(form).toHaveAttribute('data-component', 'form');
  });
});
