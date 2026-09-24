// First, we define all mocks BEFORE any imports that need them
// All vi.mock calls are hoisted to the top of the file

// Mock dependencies - all mock factories define their mocks *inside* the factory
vi.mock('../../../../stores/useSnackbarProps', () => ({
  useSnackbarProps: () => ({
    setSnackbarProps: vi.fn(),
  }),
}));

// Mock ActionButton - define the mock function directly inside the factory
vi.mock('../ActionButton/ActionButton', () => ({
  default: vi.fn(({ children, loading, progress, component, ...rest }) => (
    <label {...rest} data-testid="mock-action-button" data-loading={loading} data-progress={progress} data-component={component}>
      {children}
    </label>
  )),
}));

// Mock infra/http
vi.mock('../../../../infra/http', () => ({
  api: {
    upload: vi.fn(),
  },
}));

// Now import React and testing libraries
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import the component under test and mocked dependencies AFTER all vi.mock calls
import { UploadFileComponent, UploadFileProps } from './UploadFileComponent';
import { useSnackbarProps } from '../../../../stores/useSnackbarProps';
import { api } from '../../../../infra/http';
import ActionButton from '../ActionButton/ActionButton';

// Get references to all the mocks we need to work with in the tests
const MockActionButton = ActionButton as vi.MockedFunction<typeof ActionButton>;
const mockApiUpload = api.upload as vi.MockedFunction<typeof api.upload>;
const mockSetSnackbarProps = (useSnackbarProps() as ReturnType<typeof useSnackbarProps>).setSnackbarProps as vi.MockedFunction<typeof useSnackbarProps>["setSnackbarProps"];

describe('UploadFileComponent', () => {
  const defaultProps: UploadFileProps = {
    fileType: '.csv',
    fileName: 'test-file.csv',
    url: '/upload-url',
    label: 'Upload CSV',
    successMessage: 'File uploaded successfully!',
    errorMessage: 'Upload failed!',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with initial props', () => {
    render(<UploadFileComponent {...defaultProps} />);

    // Check ActionButton
    expect(screen.getByTestId('mock-action-button')).toBeInTheDocument();
    expect(screen.getByText(defaultProps.label)).toBeInTheDocument();

    // Check VisuallyHiddenInput
    const fileInput = screen.getByTestId('uploadInput');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', defaultProps.fileType);
    expect(fileInput).toHaveAttribute('hidden');
  });

  it('handles file selection, upload, progress, and success', async () => {
    // Create a promise we can control for the upload
    let resolveUpload: () => void;
    const uploadPromise = new Promise<void>(resolve => {
      resolveUpload = resolve;
    });
    
    // Setup progress callback capture
    let progressCallback: ((percent: number) => void) | null = null;
    mockApiUpload.mockImplementation((url, data, onUploadProgress) => {
      progressCallback = onUploadProgress;
      return uploadPromise;
    });

    render(<UploadFileComponent {...defaultProps} />);
    
    const fileInput = screen.getByTestId('uploadInput');
    const testFile = new File(['test content'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Check initial loading state via the rendered attributes
    await waitFor(() => {
      const buttonElement = screen.getByTestId('mock-action-button');
      expect(buttonElement).toHaveAttribute('data-loading', 'true');
      expect(buttonElement).toHaveAttribute('data-progress', '0');
    });

    // Verify the upload was called correctly
    expect(mockApiUpload).toHaveBeenCalledTimes(1);
    expect(mockApiUpload).toHaveBeenCalledWith(
      defaultProps.url,
      expect.any(FormData),
      expect.any(Function)
    );

    // Simulate progress update and verify UI updates
    expect(progressCallback).not.toBeNull();
    if (progressCallback) {
      act(() => {
        progressCallback(50);
      });
      
      // Check the data attribute on the rendered element
      await waitFor(() => {
        const buttonElement = screen.getByTestId('mock-action-button');
        expect(buttonElement).toHaveAttribute('data-loading', 'true');
        expect(buttonElement).toHaveAttribute('data-progress', '50');
      });
    }

    // Resolve the upload promise to complete the process
    act(() => {
      resolveUpload();
    });

    // Wait for completion state
    await waitFor(() => {
      const buttonElement = screen.getByTestId('mock-action-button');
      expect(buttonElement).toHaveAttribute('data-loading', 'false');
      expect(buttonElement).toHaveAttribute('data-progress', '0');
    });
  });

  it('handles file upload failure', async () => {
    // Create a promise we can control for the upload
    let rejectUpload: (error: Error) => void;
    const uploadPromise = new Promise<void>((resolve, reject) => {
      rejectUpload = reject;
    });
    
    mockApiUpload.mockImplementation(() => {
      return uploadPromise;
    });

    render(<UploadFileComponent {...defaultProps} />);
    
    const fileInput = screen.getByTestId('uploadInput');
    const testFile = new File(['test content'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Check initial loading state
    await waitFor(() => {
      const buttonElement = screen.getByTestId('mock-action-button');
      expect(buttonElement).toHaveAttribute('data-loading', 'true');
    });

    // Reject the upload promise to trigger error handling
    act(() => {
      rejectUpload(new Error('Upload error'));
    });

    // Wait for error state
    await waitFor(() => {
      const buttonElement = screen.getByTestId('mock-action-button');
      expect(buttonElement).toHaveAttribute('data-loading', 'false');
      expect(buttonElement).toHaveAttribute('data-progress', '0');
    });
  });
});
