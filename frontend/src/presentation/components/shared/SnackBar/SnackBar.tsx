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
      // Abajo: arriba tapaba Exportar y Aprobar, y el alto del encabezado fijo cambia según el ancho.
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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
