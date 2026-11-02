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
      {/* Tarjeta blanca con una línea fina del color del aviso, el texto en negrita y la cruz para cerrar. */}
      <Alert
        onClose={handlerClose}
        severity={snackbarProps?.severity}
        icon={false}
        sx={{
          width: '100%', alignItems: 'center', position: 'relative', pl: 3, pr: 1, py: 1,
          bgcolor: 'background.paper', color: 'text.primary', fontWeight: 600,
          border: 1, borderColor: 'divider', borderRadius: 2, boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
          '&::before': {
            content: '""', position: 'absolute', left: 12, top: 12, bottom: 12, width: 3, borderRadius: 2,
            // Las confirmaciones salen como "info": en verde, como lo que cierra.
            bgcolor: snackbarProps?.severity === 'error' ? 'error.main'
              : snackbarProps?.severity === 'warning' ? 'warning.main' : 'success.main',
          },
          '& .MuiAlert-message': { pl: 0.5 },
          '& .MuiAlert-action': { pt: 0, alignItems: 'center' },
        }}>
        {snackbarProps?.message}
      </Alert>
    </Snackbar>

  );
};

export default SnackbarGlobal;
