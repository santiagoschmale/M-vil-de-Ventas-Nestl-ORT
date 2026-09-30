import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // Import waitFor
import '@testing-library/jest-dom';
import AlertDialog, { DeleteModalProps } from './AlertDialog';
import { useSnackbarProps } from '../../../../stores/useSnackbarProps';

// Mock the useSnackbarProps store
vi.mock('../../../../stores/useSnackbarProps', () => ({
  useSnackbarProps: vi.fn(),
}));

const mockSetSnackbarProps = vi.fn();

describe('AlertDialog', () => {
  const defaultProps: DeleteModalProps = {
    open: true,
    label: 'Test Item',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    message: 'Item deleted successfully',
  };

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Setup the mock return value for useSnackbarProps
    (useSnackbarProps as vi.Mock).mockReturnValue({
      setSnackbarProps: mockSetSnackbarProps,
    });
  });

  it('does not render when open is false', () => {
    render(<AlertDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when open is true', () => {
    render(<AlertDialog {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(`Are you sure you want to delete ${defaultProps.label} ?`)).toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', async () => {
    render(<AlertDialog {...defaultProps} />);
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onConfirm and onClose when Confirm button is clicked', async () => {
    render(<AlertDialog {...defaultProps} />);
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('calls setSnackbarProps with message when Confirm button is clicked and message is provided', async () => {
    render(<AlertDialog {...defaultProps} />);
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockSetSnackbarProps).toHaveBeenCalledTimes(1);
    });
    expect(mockSetSnackbarProps).toHaveBeenCalledWith({ message: defaultProps.message });
  });

  it('does not call setSnackbarProps when Confirm button is clicked and message is not provided', async () => {
    const propsWithoutMessage: DeleteModalProps = {
      ...defaultProps,
      message: undefined,
    };
    render(<AlertDialog {...propsWithoutMessage} />);
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(propsWithoutMessage.onConfirm).toHaveBeenCalledTimes(1);
    });
    expect(mockSetSnackbarProps).not.toHaveBeenCalled();
  });

  it('displays the correct label in the title', () => {
    const customLabel = "My Special Item";
    render(<AlertDialog {...defaultProps} label={customLabel} />);
    expect(screen.getByText(`Are you sure you want to delete ${customLabel} ?`)).toBeInTheDocument();
  });
});
