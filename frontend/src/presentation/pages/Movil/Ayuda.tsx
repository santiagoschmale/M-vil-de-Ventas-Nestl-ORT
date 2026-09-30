import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

type Props = { ayuda: { titulo: string; texto: React.ReactNode } };

/** El ⓘ: abre un modal que explica el concepto. Va al lado de un título, nunca dentro de otro botón. */
export const Ayuda = ({ ayuda }: Props) => {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Tooltip title={ayuda.titulo}>
        <IconButton size="small" aria-label={ayuda.titulo} onClick={() => setAbierta(true)}
          sx={{ color: 'text.secondary' }}>
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={abierta} onClose={() => setAbierta(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{ayuda.titulo}</DialogTitle>
        <DialogContent>{ayuda.texto}</DialogContent>
        <DialogActions>
          <Button onClick={() => setAbierta(false)} autoFocus>Entendido</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
