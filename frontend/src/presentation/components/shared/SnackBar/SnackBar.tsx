import { Alert, Snackbar } from '@mui/material';
import React from 'react';
import { useSnackbarProps } from '../../../../stores/useSnackbarProps';

const SnackbarGlobal = () => {

  const { snackbarProps, setSnackbarProps } = useSnackbarProps();  
  
  const handlerClose = (event?: React.SyntheticEvent | Event, reason?: string) => { 
    if (reason === 'clickaway') { 
      return; 
    } 
    setSnackbarProps(undefined) 
  }

  return (
    <Snackbar 
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} // arriba tapaba las acciones de la página 
      open={undefined !== snackbarProps} 
      autoHideDuration={5000} 
      onClose={handlerClose}> 
      <Alert 
        onClose={handlerClose} 
        severity={snackbarProps?.severity} 
        sx={{ width: '100%' }}> 
        {snackbarProps?.message} 
      </Alert> 
    </Snackbar>

  );
};

export default SnackbarGlobal;
