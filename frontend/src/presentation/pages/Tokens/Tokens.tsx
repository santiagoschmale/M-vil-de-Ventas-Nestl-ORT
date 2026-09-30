import * as React from 'react';
import { IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { Base } from '../../components/shared/Base';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import StripedDataGrid from '../../components/shared/StripedDataGrid/StripedDataGrid';
import { useSnackbarProps } from '../../../stores/useSnackbarProps';
import { useTokens } from '../../../stores/useTokens';
import { TokenPage } from './Token';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import ActionButton from '../../components/shared/ActionButton/ActionButton';
import { AlertDialog } from '../../components/shared/AlertDialog';

export const TokensPage = () => {
  const { token, tokens, fetchTokens, fetchToken, resetToken, updateSecret, deleteToken } = useTokens();
  const [dialogOpen, setDialogOpen] = useState(false);  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);  
  const [newSecretDialogOpen, setNewSecretDialogOpen] = useState(false);   
  const { setSnackbarProps } = useSnackbarProps();

  useEffect(() => {
    fetchTokens();
  }, []);

  return (
    <Base 
        content={
            <>
                <StripedDataGrid
                    data-testid="tokens-datagrid"
                    rows={tokens || []}
                    columns={[
                        { field: 'key', headerName: 'key', flex: 3, sortable: false},
                        { field: 'secret', headerName: 'secret', flex: 3, sortable: false},
                        { field: 'createdAt', headerName: 'created at', flex: 2, sortable: false},
                        { field: 'roles', headerName: 'roles', flex: 2, sortable: false},
                        {
                        field: 'action',
                        type: 'actions',
                        flex: 1,
                        sortable: false,
                        renderCell: (params) =>  
                            <>
                                <IconButton 
                                    onClick={ async () => {
                                        await fetchToken(params.row.id);
                                        setNewSecretDialogOpen(true);
                                    }}> 
                                    <LockResetRoundedIcon /> 
                                </IconButton>
                                <IconButton 
                                    onClick={ async () => {
                                        await fetchToken(params.row.id);
                                        setDialogOpen(true);
                                    }}> 
                                    <EditRoundedIcon /> 
                                </IconButton>
                                <IconButton 
                                    onClick={ async () => {
                                        await fetchToken(params.row.id);
                                        setDeleteDialogOpen(true);
                                    }}> 
                                    <DeleteRoundedIcon /> 
                                </IconButton>
                            </> 
                        }
                    ]} 
                />

                <TokenPage
                    open={dialogOpen}
                    onClose={() => {
                        setDialogOpen(false);
                        resetToken();
                    }}
                />

                <AlertDialog
                    label={`${token?.id}`}
                    onClose={() => {
                        setDeleteDialogOpen(false);
                        resetToken();
                    }}
                    onConfirm={() => { 
                        deleteToken(token?.id || '').then(() =>  {
                            setDeleteDialogOpen(false);
                            resetToken();
                            setSnackbarProps({ message: 'Token deleted successfully' });
                        }) 
                    }}
                    open={deleteDialogOpen}
                />

                <AlertDialog
                    open={newSecretDialogOpen}
                    label='Are you sure you want to reset the secret?'
                    onClose={() => {
                        setNewSecretDialogOpen(false);
                        resetToken();
                    }}
                    onConfirm={() => { 
                        updateSecret(token?.id || '').then(() =>  {
                            setNewSecretDialogOpen(false)
                            resetToken();
                        }) 
                    }}
                />  
            </>
        }
        actions={
            <ActionButton
                children="New Token" 
                onClick={() =>{
                    resetToken();
                    setDialogOpen(true);
                }}
            />
        }
    />
    )
};