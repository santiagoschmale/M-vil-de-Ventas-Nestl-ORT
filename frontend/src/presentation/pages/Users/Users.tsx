import * as React from 'react';
import { IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { useUsers } from '../../../stores/useUsers';
import { Base } from '../../components/shared/Base';
import { UserPage } from './User';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import StripedDataGrid from '../../components/shared/StripedDataGrid/StripedDataGrid';
import { useSnackbarProps } from '../../../stores/useSnackbarProps';
import ActionButton from '../../components/shared/ActionButton/ActionButton';
import { AlertDialog } from '../../components/shared/AlertDialog';

export const UsersPage = () => {
  const { user, users, fetchUsers, deleteUser, fetchUser, resetUser } = useUsers();
  const { setSnackbarProps } = useSnackbarProps();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <Base 
      content={
        <>
          <StripedDataGrid
            data-testid="users-datagrid"
          rows={users || []}
          columns={[
            { field: 'username', headerName: 'email', flex: 3, sortable: false},
            { field: 'lastLogin', headerName: 'last login', flex: 2, sortable: false},
            { field: 'roles', headerName: 'roles', flex: 2, sortable: false},
            {
              field: 'action',
              type: 'actions',
              sortable: false,
              renderCell: (params) =>  
                <>
                  <IconButton 
                    onClick={async() => {
                      await fetchUser(params.row.id);
                      setEditModalOpen(true);
                    }}> 
                    <EditRoundedIcon /> 
                  </IconButton>
                  <IconButton onClick={async () => {
                      await fetchUser(params.row.id);
                      setDeleteDialogOpen(true);
                    }}> 
                    <DeleteRoundedIcon /> 
                  </IconButton>
                </> 
            }
          ]} />
          
          <UserPage
            open={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              resetUser();
            }} />
          
          <AlertDialog
            open={deleteDialogOpen}
            label={user?.username || ""}
            message="User deleted successfully"
            onClose={() => {
              setDeleteDialogOpen(false);
              resetUser();
            }}
            onConfirm={async () => deleteUser(user?.id || '')}
          />
        </>
      }
      actions={
        <ActionButton 
          onClick={() =>{
            resetUser()
            setEditModalOpen(true)
          }}
          children="New User"
        />
      }
    />
   
  );
};

