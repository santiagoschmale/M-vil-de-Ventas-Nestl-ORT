// Mock dependencies before imports
vi.mock('../../../stores/useTokens', () => ({
  useTokens: vi.fn()
}));

vi.mock('../../../stores/useSnackbarProps', () => ({
  useSnackbarProps: vi.fn()
}));

vi.mock('../../components/shared/Base', () => ({
  Base: vi.fn(({ content, actions }) => (
    <div data-testid="mock-base">
      <div data-testid="base-content">{content}</div>
      <div data-testid="base-actions">{actions}</div>
    </div>
  ))
}));

vi.mock('../../components/shared/StripedDataGrid/StripedDataGrid', () => ({
  default: vi.fn(({ rows, columns }) => (
    <div data-testid="mock-datagrid">
      <span data-testid="row-count">{rows.length}</span>
      <span data-testid="column-count">{columns.length}</span>
      <table>
        <thead>
          <tr>
            {columns.map((column: any, index: number) => (
              <th key={index}>{column.headerName || column.field}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, rowIndex: number) => (
            <tr key={rowIndex} data-testid={`row-${rowIndex}`}>
              {columns.map((column: any, colIndex: number) => (
                <td key={colIndex}>
                  {column.renderCell ? (
                    <div data-testid={`cell-action-${rowIndex}`}>
                      {column.renderCell({ row })}
                    </div>
                  ) : (
                    row[column.field]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ))
}));

vi.mock('../../components/shared/FormDialog', () => ({
  FormDialog: vi.fn(({ children, open, onClose, process, afterSubmitHandler, title }) => (
    open ? (
      <div data-testid="mock-form-dialog" data-title={title}>
        <form 
          data-testid="form"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const formJson = Object.fromEntries(formData.entries());
            process(formJson).then(() => afterSubmitHandler());
          }}
        >
          {children}
          <button type="submit" data-testid="submit-button">Submit</button>
          <button type="button" data-testid="cancel-button" onClick={onClose}>
            Cancel
          </button>
        </form>
      </div>
    ) : null
  ))
}));

vi.mock('../../components/shared/SMFields', () => ({
  SMFields: vi.fn(({ afterLoadFunction, catalogs, roles }) => {
    React.useEffect(() => {
      afterLoadFunction();
    }, []);
    
    return (
      <div data-testid="mock-sm-fields">
        <input 
          name="roles" 
          data-testid="roles-input" 
          defaultValue={roles?.join(',')} 
        />
        <input 
          name="catalogs" 
          data-testid="catalogs-input" 
          defaultValue={catalogs?.join(',')} 
        />
      </div>
    );
  })
}));

vi.mock('../../components/shared/AlertDialog', () => ({
  AlertDialog: vi.fn(({ open, label, onClose, onConfirm }) => (
    open ? (
      <div data-testid="mock-alert-dialog" data-label={label}>
        <div data-testid="alert-dialog-content">
          Are you sure you want to delete {label} ?
        </div>
        <button data-testid="confirm-button" onClick={onConfirm}>Confirm</button>
        <button data-testid="cancel-button" onClick={onClose}>Cancel</button>
      </div>
    ) : null
  ))
}));

vi.mock('../../components/shared/Fallback', () => ({
  Fallback: vi.fn(({ children, condition, testId }) => (
    <div data-testid={testId || "mock-fallback"} data-condition={condition.toString()}>
      {!condition && children}
    </div>
  ))
}));

vi.mock('../../components/shared/ConditionalRendering/ConditionalRendering', () => ({
  ConditionalRendering: vi.fn(({ children, condition }) => (
    condition ? <div data-testid="conditional-content">{children}</div> : null
  ))
}));

vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TextField: vi.fn(({ 
      id, 
      name, 
      label, 
      value, 
      disabled,
      required,
      fullWidth,
      hidden,
      style,
      "data-testid": testId 
    }) => (
      <div style={style || {}}>
        <label htmlFor={id}>{label}</label>
        <input 
          type="text"
          id={id}
          name={name}
          defaultValue={value}
          data-testid={testId}
          disabled={disabled}
          hidden={hidden}
          required={required || false}
        />
      </div>
    )),
    IconButton: vi.fn(({ onClick, children }) => (
      <button onClick={onClick} data-testid="icon-button">
        {children}
      </button>
    ))
  };
});

// Now import React and testing libraries
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';

// Import components under test after all mocks
import { TokensPage } from './Tokens';
import { TokenPage } from './Token';
import { useTokens } from '../../../stores/useTokens';
import { useSnackbarProps } from '../../../stores/useSnackbarProps';

// Mock data
const mockTokens = [
  { 
    id: '1', 
    key: 'token1',
    secret: 'secret1', 
    createdAt: '2023-01-01', 
    roles: ['admin'],
    custom: { catalogs: ['catalog1'] }
  },
  { 
    id: '2', 
    key: 'token2',
    secret: 'secret2', 
    createdAt: '2023-01-02', 
    roles: ['user'],
    custom: { catalogs: ['catalog2'] }
  }
];

const mockToken = {
  id: '1',
  key: 'token1',
  secret: 'secret1',
  createdAt: '2023-01-01',
  roles: ['admin'],
  custom: { catalogs: ['catalog1', 'catalog2'] }
};

describe('Tokens Page', () => {
  const mockFetchTokens = vi.fn();
  const mockFetchToken = vi.fn();
  const mockResetToken = vi.fn();
  const mockUpdateToken = vi.fn();
  const mockNewToken = vi.fn();
  const mockDeleteToken = vi.fn();
  const mockUpdateSecret = vi.fn();
  const mockSetSnackbarProps = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useTokens as vi.Mock).mockReturnValue({
      tokens: mockTokens,
      token: null,
      fetchTokens: mockFetchTokens,
      fetchToken: mockFetchToken,
      resetToken: mockResetToken,
      updateToken: mockUpdateToken,
      newToken: mockNewToken,
      deleteToken: mockDeleteToken,
      updateSecret: mockUpdateSecret
    });
    
    (useSnackbarProps as vi.Mock).mockReturnValue({
      setSnackbarProps: mockSetSnackbarProps
    });
  });

  describe('Tokens List', () => {
    it('renders the tokens page and fetches tokens on mount', async () => {
      render(<TokensPage />);
      
      // Check if the DataGrid is rendered with tokens
      expect(screen.getByTestId('mock-datagrid')).toBeInTheDocument();
      expect(screen.getByTestId('row-count')).toHaveTextContent('2');
      
      // Verify fetchTokens was called on mount
      expect(mockFetchTokens).toHaveBeenCalledTimes(1);
    });

    it('opens edit modal when clicking edit button', async () => {
      render(<TokensPage />);
      
      // Find all buttons in the action cell of the first row
      const actionCell = screen.getByTestId('cell-action-0');
      const buttons = actionCell.querySelectorAll('[data-testid="icon-button"]');
      
      // The edit button should be the second button
      const editButton = buttons[1] as HTMLButtonElement;
      
      await act(async () => {
        fireEvent.click(editButton);
      });
      
      // Verify fetchToken was called with correct ID
      expect(mockFetchToken).toHaveBeenCalledWith('1');
    });

    it('opens delete dialog when clicking delete button', async () => {
      // Mock token in the store for deletion
      (useTokens as vi.Mock).mockReturnValue({
        tokens: mockTokens,
        token: mockToken,
        fetchTokens: mockFetchTokens,
        fetchToken: mockFetchToken,
        resetToken: mockResetToken,
        deleteToken: mockDeleteToken,
        updateSecret: mockUpdateSecret
      });

      render(<TokensPage />);
      
      const actionCell = screen.getByTestId('cell-action-0');
      const buttons = actionCell.querySelectorAll('[data-testid="icon-button"]');
      
      // The delete button should be the third button
      const deleteButton = buttons[2] as HTMLButtonElement;
      
      await act(async () => {
        fireEvent.click(deleteButton);
      });
      
      // Verify fetchToken was called with correct ID
      expect(mockFetchToken).toHaveBeenCalledWith('1');
      
      // Check if AlertDialog is in the document with the correct props
      expect(screen.getByTestId('mock-alert-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('mock-alert-dialog')).toHaveAttribute('data-label', '1');
    });

    it('opens new secret dialog when clicking reset secret button', async () => {
      // Mock token in the store
      (useTokens as vi.Mock).mockReturnValue({
        tokens: mockTokens,
        token: mockToken,
        fetchTokens: mockFetchTokens,
        fetchToken: mockFetchToken,
        resetToken: mockResetToken,
        deleteToken: mockDeleteToken,
        updateSecret: mockUpdateSecret
      });

      render(<TokensPage />);
      
      const actionCell = screen.getByTestId('cell-action-0');
      const buttons = actionCell.querySelectorAll('[data-testid="icon-button"]');
      
      // The reset secret button should be the first button
      const resetButton = buttons[0] as HTMLButtonElement;
      
      await act(async () => {
        fireEvent.click(resetButton);
      });
      
      // Verify fetchToken was called with correct ID
      expect(mockFetchToken).toHaveBeenCalledWith('1');
      
      // Check if AlertDialog is in the document with reset secret message
      expect(screen.getByTestId('mock-alert-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('mock-alert-dialog')).toHaveAttribute(
        'data-label', 
        'Are you sure you want to reset the secret?'
      );
    });

    it('opens new token form when clicking New Token button', async () => {
      render(<TokensPage />);
      
      // Find "New Token" button in the actions area
      const newTokenButton = screen.getByText('New Token');
      
      await act(async () => {
        fireEvent.click(newTokenButton);
      });
      
      // Verify resetToken was called
      expect(mockResetToken).toHaveBeenCalledTimes(1);
      
      // FormDialog will be opened, which we test separately
      expect(screen.getByTestId('mock-form-dialog')).toBeInTheDocument();
    });
  });

  describe('Token Form', () => {
    it('renders in new token mode', () => {
      // Ensure token is null for new token mode
      (useTokens as vi.Mock).mockReturnValue({
        token: null,
        updateToken: mockUpdateToken,
        newToken: mockNewToken
      });

      render(<TokenPage open={true} onClose={() => {}} />);
      
      // Check title shows "New Token"
      expect(screen.getByTestId('mock-form-dialog')).toHaveAttribute('data-title', 'New Token');
      
      // Key field should not be visible in new token mode
      expect(screen.queryByTestId('conditional-content')).not.toBeInTheDocument();
      
      // Verify SMFields was rendered
      expect(screen.getByTestId('mock-sm-fields')).toBeInTheDocument();
    });

    it('renders in edit token mode with token data', () => {
      // Mock token for edit mode
      (useTokens as vi.Mock).mockReturnValue({
        token: mockToken,
        updateToken: mockUpdateToken,
        newToken: mockNewToken
      });

      render(<TokenPage open={true} onClose={() => {}} />);
      
      // Check title shows "Token edit"
      expect(screen.getByTestId('mock-form-dialog')).toHaveAttribute('data-title', 'Token edit');
      
      // Key field should be visible in edit mode
      expect(screen.getByTestId('conditional-content')).toBeInTheDocument();
      expect(screen.getByTestId('token-fallback')).toHaveAttribute('data-condition', 'false');
      expect(screen.getByTestId('key')).toBeInTheDocument();
      
      // Ensure token data is passed to SMFields
      expect(screen.getByTestId('roles-input')).toHaveValue('admin');
      expect(screen.getByTestId('catalogs-input')).toHaveValue('catalog1,catalog2');
    });

    it('submits form to create new token', async () => {
      const mockOnClose = vi.fn();
      
      // Ensure token is null for new token mode
      (useTokens as vi.Mock).mockReturnValue({
        token: null,
        updateToken: mockUpdateToken,
        newToken: mockNewToken
      });
      
      mockNewToken.mockResolvedValue({});
      
      render(<TokenPage open={true} onClose={mockOnClose} />);
      
      // Set role and catalogs
      const rolesInput = screen.getByTestId('roles-input');
      const catalogsInput = screen.getByTestId('catalogs-input');
      
      fireEvent.change(rolesInput, { target: { value: 'user,editor' } });
      fireEvent.change(catalogsInput, { target: { value: 'catalog3,catalog4' } });
      
      // Submit the form
      const submitButton = screen.getByTestId('submit-button');
      await act(async () => {
        fireEvent.click(submitButton);
      });
      
      // Verify newToken was called with correct data
      expect(mockNewToken).toHaveBeenCalledWith({
        roles: ['user', 'editor'],
        custom: {
          catalogs: ['catalog3', 'catalog4'],
        },
      });
      
      // Verify success notification and close
      await waitFor(() => {
        expect(mockSetSnackbarProps).toHaveBeenCalledWith({ message: "Token saved successfully" });
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('submits form to edit existing token', async () => {
      const mockOnClose = vi.fn();
      
      // Mock token for edit mode
      (useTokens as vi.Mock).mockReturnValue({
        token: mockToken,
        updateToken: mockUpdateToken,
        newToken: mockNewToken
      });
      
      mockUpdateToken.mockResolvedValue({});
      
      render(<TokenPage open={true} onClose={mockOnClose} />);
      
      // Update roles and catalogs
      const rolesInput = screen.getByTestId('roles-input');
      const catalogsInput = screen.getByTestId('catalogs-input');
      
      fireEvent.change(rolesInput, { target: { value: 'user,admin' } });
      fireEvent.change(catalogsInput, { target: { value: 'catalog1,catalog3' } });
      
      // Submit the form
      const submitButton = screen.getByTestId('submit-button');
      await act(async () => {
        fireEvent.click(submitButton);
      });
      
      // Verify updateToken was called with correct data
      expect(mockUpdateToken).toHaveBeenCalledWith('1', {
        roles: ['user', 'admin'],
        custom: {
          catalogs: ['catalog1', 'catalog3'],
        },
      });
      
      // Verify success notification and close
      await waitFor(() => {
        expect(mockSetSnackbarProps).toHaveBeenCalledWith({ message: "Token saved successfully" });
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('closes the form when cancel is clicked', () => {
      const mockOnClose = vi.fn();
      
      render(<TokenPage open={true} onClose={mockOnClose} />);
      
      const cancelButton = screen.getByTestId('cancel-button');
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Token Actions', () => {
    it('deletes a token when confirmed', async () => {
      // Mock token in the store for deletion
      (useTokens as vi.Mock).mockReturnValue({
        tokens: mockTokens,
        token: mockToken,
        fetchTokens: mockFetchTokens,
        fetchToken: mockFetchToken,
        resetToken: mockResetToken,
        deleteToken: mockDeleteToken,
        updateSecret: mockUpdateSecret
      });
      
      mockDeleteToken.mockResolvedValue({});
      
      render(<TokensPage />);
      
      // Open delete dialog
      const actionCell = screen.getByTestId('cell-action-0');
      const buttons = actionCell.querySelectorAll('[data-testid="icon-button"]');
      const deleteButton = buttons[2] as HTMLButtonElement;
      
      await act(async () => {
        fireEvent.click(deleteButton);
      });
      
      // Find and click confirm button
      const confirmButton = screen.getByTestId('confirm-button');
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      
      // Verify deleteToken was called with correct ID
      expect(mockDeleteToken).toHaveBeenCalledWith('1');
      
      // Verify snackbar message after successful deletion
      await waitFor(() => {
        expect(mockSetSnackbarProps).toHaveBeenCalledWith({ message: 'Token deleted successfully' });
        expect(mockResetToken).toHaveBeenCalled();
      });
    });

    it('updates a token secret when confirmed', async () => {
      // Mock token in the store
      (useTokens as vi.Mock).mockReturnValue({
        tokens: mockTokens,
        token: mockToken,
        fetchTokens: mockFetchTokens,
        fetchToken: mockFetchToken,
        resetToken: mockResetToken,
        deleteToken: mockDeleteToken,
        updateSecret: mockUpdateSecret
      });
      
      mockUpdateSecret.mockResolvedValue({});
      
      render(<TokensPage />);
      
      // Open reset secret dialog
      const actionCell = screen.getByTestId('cell-action-0');
      const buttons = actionCell.querySelectorAll('[data-testid="icon-button"]');
      const resetButton = buttons[0] as HTMLButtonElement;
      
      await act(async () => {
        fireEvent.click(resetButton);
      });
      
      // Find and click confirm button
      const confirmButton = screen.getByTestId('confirm-button');
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      
      // Verify updateSecret was called with correct ID
      expect(mockUpdateSecret).toHaveBeenCalledWith('1');
      
      // Verify resetToken was called after successful update
      await waitFor(() => {
        expect(mockResetToken).toHaveBeenCalled();
      });
    });
  });
});
