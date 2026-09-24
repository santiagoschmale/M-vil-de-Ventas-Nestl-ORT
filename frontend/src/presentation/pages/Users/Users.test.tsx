// Mock dependencies before imports
vi.mock('../../../stores/useUsers', () => ({
  useUsers: vi.fn()
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

vi.mock('../../components/shared/Fallback', () => ({
  Fallback: vi.fn(({ children, condition, testId }) => (
    <div data-testid={testId || "mock-fallback"} data-condition={condition.toString()}>
      {!condition && children}
    </div>
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
      "data-testid": testId 
    }) => (
      <div>
        <label htmlFor={id}>{label}</label>
        <input 
          type="text"
          id={id}
          name={name}
          defaultValue={value}
          data-testid={testId}
          disabled={disabled}
          required={required || false}
        />
      </div>
    ))
  };
});

// Now import React and testing libraries
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';

// Import components under test after all mocks
import { UsersPage } from './Users';
import { UserPage } from './User';
import { useUsers } from '../../../stores/useUsers';
import { useSnackbarProps } from '../../../stores/useSnackbarProps';

// Mock data
const mockUsers = [
  { id: '1', username: 'user1@example.com', lastLogin: '2023-01-01', roles: ['admin'] },
  { id: '2', username: 'user2@example.com', lastLogin: '2023-01-02', roles: ['user'] }
];

const mockUser = {
  id: '1',
  username: 'user1@example.com',
  roles: ['admin'],
  status: 'ACTIVE',
  custom: { catalogs: ['catalog1', 'catalog2'] }
};

describe('Users Page', () => {
  const mockFetchUsers = vi.fn();
  const mockFetchUser = vi.fn();
  const mockDeleteUser = vi.fn();
  const mockResetUser = vi.fn();
  const mockEditUser = vi.fn();
  const mockSaveUser = vi.fn();
  const mockSetSnackbarProps = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useUsers as vi.Mock).mockReturnValue({
      users: mockUsers,
      user: null,
      fetchUsers: mockFetchUsers,
      fetchUser: mockFetchUser,
      deleteUser: mockDeleteUser,
      resetUser: mockResetUser,
      editUser: mockEditUser,
      saveUser: mockSaveUser
    });
    
    (useSnackbarProps as vi.Mock).mockReturnValue({
      setSnackbarProps: mockSetSnackbarProps
    });
  });

  describe('Users List', () => {
    it('renders the users page and fetches users on mount', async () => {
      render(<UsersPage />);
      
      // Check if the DataGrid is rendered with users
      expect(screen.getByTestId('mock-datagrid')).toBeInTheDocument();
      expect(screen.getByTestId('row-count')).toHaveTextContent('2');
      
      // Verify fetchUsers was called on mount
      expect(mockFetchUsers).toHaveBeenCalledTimes(1);
    });

    it('opens edit modal when clicking edit button', async () => {
      render(<UsersPage />);
      
      // Find and click edit button on first user
      const actionCell = screen.getByTestId('cell-action-0');
      const editButton = actionCell.querySelector('button:first-child') as HTMLButtonElement;
      
      await act(async () => {
        fireEvent.click(editButton);
      });
      
      // Verify fetchUser was called with correct ID
      expect(mockFetchUser).toHaveBeenCalledWith('1');
      
      // The edit modal would be opened now
      // This is tested separately in the User component tests
    });

    it('opens delete dialog when clicking delete button', async () => {
      // Mock user in the store for deletion
      (useUsers as vi.Mock).mockReturnValue({
        users: mockUsers,
        user: mockUser,
        fetchUsers: mockFetchUsers,
        fetchUser: mockFetchUser,
        deleteUser: mockDeleteUser,
        resetUser: mockResetUser
      });

      render(<UsersPage />);
      
      const actionCell = screen.getByTestId('cell-action-0');
      const deleteButton = actionCell.querySelector('button:last-child') as HTMLButtonElement;
      
      await act(async () => {
        fireEvent.click(deleteButton);
      });
      
      // Verify fetchUser was called with correct ID
      expect(mockFetchUser).toHaveBeenCalledWith('1');
      
      // Check if AlertDialog is in the document with the correct props
      // Since AlertDialog is rendered conditionally, we can check its presence
      // by looking for specific elements it contains
      const alertDialogEl = screen.getByText(/Are you sure you want to delete/);
      expect(alertDialogEl).toBeInTheDocument();
    });

    it('opens new user form when clicking New User button', async () => {
      render(<UsersPage />);
      
      // Find "New User" button in the actions area
      const newUserButton = screen.getByText('New User');
      
      await act(async () => {
        fireEvent.click(newUserButton);
      });
      
      // Verify resetUser was called
      expect(mockResetUser).toHaveBeenCalledTimes(1);
      
      // UserPage will be opened, which we test separately
    });
  });

  describe('User Form', () => {
    it('renders in new user mode', () => {
      // Ensure user is null for new user mode
      (useUsers as vi.Mock).mockReturnValue({
        user: null,
        editUser: mockEditUser,
        saveUser: mockSaveUser
      });

      render(<UserPage open={true} onClose={() => {}} />);
      
      // Check title shows "New user"
      expect(screen.getByTestId('mock-form-dialog')).toHaveAttribute('data-title', 'New user');
      
      // Verify the fallback shows "false" because SMFields has already triggered the afterLoadFunction in our mock
      // Use the correct testId that matches what's in the User.tsx component
      const fallback = screen.getByTestId('username-fallback');
      expect(fallback).toHaveAttribute('data-condition', 'false'); // Should be false since SMFields calls afterLoadFunction immediately
      
      // Verify SMFields was rendered
      expect(screen.getByTestId('mock-sm-fields')).toBeInTheDocument();
      
      // Since the fallback shows children when condition is false, we should see the username field
      expect(screen.getByTestId('username')).toBeInTheDocument();
    });

    it('renders in edit user mode with user data', () => {
      // Mock user for edit mode
      (useUsers as vi.Mock).mockReturnValue({
        user: mockUser,
        editUser: mockEditUser,
        saveUser: mockSaveUser
      });

      render(<UserPage open={true} onClose={() => {}} />);
      
      // Check title shows "User edit"
      expect(screen.getByTestId('mock-form-dialog')).toHaveAttribute('data-title', 'User edit');
      
      // Ensure user data is passed to SMFields
      expect(screen.getByTestId('roles-input')).toHaveValue('admin');
      expect(screen.getByTestId('catalogs-input')).toHaveValue('catalog1,catalog2');
    });

    it('submits form to create new user', async () => {
      const mockOnClose = vi.fn();
      
      // Ensure user is null for new user mode
      (useUsers as vi.Mock).mockReturnValue({
        user: null,
        editUser: mockEditUser,
        saveUser: mockSaveUser
      });
      
      mockSaveUser.mockResolvedValue({});
      
      render(<UserPage open={true} onClose={mockOnClose} />);
      
      // Fill the form - no need to wait since our mock immediately shows the fields
      const emailInput = screen.getByTestId('username');
      // Use a different approach to set the input value
      fireEvent.input(emailInput, { target: { value: 'newuser@example.com' } });
      
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
      
      // Verify saveUser was called with correct data
      expect(mockSaveUser).toHaveBeenCalledWith({
        username: 'newuser@example.com',
        roles: ['user', 'editor'],
        status: 'ACTIVE',
        custom: {
          catalogs: ['catalog3', 'catalog4'],
        },
      });
      
      // Verify success notification and close
      await waitFor(() => {
        expect(mockSetSnackbarProps).toHaveBeenCalledWith({ message: "User saved successfully" });
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('submits form to edit existing user', async () => {
      const mockOnClose = vi.fn();
      
      // Mock user for edit mode
      (useUsers as vi.Mock).mockReturnValue({
        user: mockUser,
        editUser: mockEditUser,
        saveUser: mockSaveUser
      });
      
      mockEditUser.mockResolvedValue({});
      
      render(<UserPage open={true} onClose={mockOnClose} />);
      
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
      
      // Verify editUser was called with correct data
      expect(mockEditUser).toHaveBeenCalledWith('1', {
        roles: ['user', 'admin'],
        status: 'ACTIVE',
        custom: {
          catalogs: ['catalog1', 'catalog3'],
        },
      });
      
      // Verify success notification and close
      await waitFor(() => {
        expect(mockSetSnackbarProps).toHaveBeenCalledWith({ message: "User saved successfully" });
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('closes the form when cancel is clicked', () => {
      const mockOnClose = vi.fn();
      
      render(<UserPage open={true} onClose={mockOnClose} />);
      
      const cancelButton = screen.getByTestId('cancel-button');
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Deletion', () => {
    it('deletes a user when confirmed', async () => {
      // Mock user in the store for deletion
      (useUsers as vi.Mock).mockReturnValue({
        users: mockUsers,
        user: mockUser,
        fetchUsers: mockFetchUsers,
        fetchUser: mockFetchUser,
        deleteUser: mockDeleteUser,
        resetUser: mockResetUser
      });
      
      mockDeleteUser.mockResolvedValue({});
      
      render(<UsersPage />);
      
      // Open delete dialog
      const actionCell = screen.getByTestId('cell-action-0');
      const deleteButton = actionCell.querySelector('button:last-child') as HTMLButtonElement;
      
      await act(async () => {
        fireEvent.click(deleteButton);
      });
      
      // Find and click confirm button
      const confirmButton = screen.getByText(/confirm/i);
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      
      // Verify deleteUser was called with correct ID
      expect(mockDeleteUser).toHaveBeenCalledWith('1');
      
      // After successful deletion, dialog should close
      await waitFor(() => {
        // Verify snackbar message (handled by AlertDialog)
        // Verify resetUser was called
        expect(mockResetUser).toHaveBeenCalled();
      });
    });
  });
});
