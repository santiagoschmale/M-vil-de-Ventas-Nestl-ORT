import React, { useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField,
} from '@mui/material';

type Props = {
  titulo: string;
  descripcion: string;
  confirmar: string;
  onConfirmar: (motivo: string) => Promise<string | null>;
  onCerrar: () => void;
};

/** Todo ajuste del planner pide un motivo: queda en el historial con quién y cuándo. */
export const MotivoDialog = ({ titulo, descripcion, confirmar, onConfirmar, onCerrar }: Props) => {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // en React el submit sube por el portal hasta el diálogo de afuera
    setEnviando(true);
    const falla = await onConfirmar(motivo.trim());
    setEnviando(false);
    if (falla) setError(falla);
    else onCerrar();
  };

  return (
    <Dialog open onClose={onCerrar} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: enviar }}>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{descripcion}</DialogContentText>
        <TextField
          autoFocus fullWidth required label="Motivo" value={motivo}
          onChange={e => setMotivo(e.target.value)}
          helperText="Queda en el historial, con tu nombre y la hora."
        />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!motivo.trim() || enviando}>{confirmar}</Button>
      </DialogActions>
    </Dialog>
  );
};
