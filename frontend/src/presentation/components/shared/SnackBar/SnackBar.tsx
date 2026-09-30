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
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ top: { xs: 80, sm: 80 } }} // debajo del encabezado fijo, para no tapar Exportar ni el estado de cierre
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
