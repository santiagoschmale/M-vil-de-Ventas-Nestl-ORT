import React, { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useMovil } from '../../../stores/useMovil';

/** Empezar de cero: borra todos los meses guardados. Solo en la instalación local, para practicar. */
export const ReiniciarDialog = ({ onCerrar }: { onCerrar: () => void }) => {
  const { reiniciar, ocupado } = useMovil();
  const [error, setError] = useState<string | null>(null);
  const confirmar = async () => {
    const falla = await reiniciar();
    if (falla) setError(falla);
    else onCerrar();
  };
  return (
    <Dialog open onClose={onCerrar} maxWidth="xs" fullWidth aria-labelledby="titulo-reiniciar">
      <DialogTitle id="titulo-reiniciar">Empezar de cero</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Se borran todos los meses guardados, con sus archivos, ajustes, aprobaciones e historial, y arranca el mes
          actual vacío. No se puede deshacer.
        </DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>
          Existe solo en la instalación local, para practicar.
        </DialogContentText>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" color="error" onClick={confirmar} disabled={ocupado}>Borrar todo</Button>
      </DialogActions>
    </Dialog>
  );
};
