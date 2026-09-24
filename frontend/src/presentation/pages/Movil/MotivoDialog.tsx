import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';

type Props = {
  titulo: string;
  descripcion: string;
  confirmar: string;
  onConfirmar: (motivo: string) => Promise<boolean>;
  onCerrar: () => void;
};

/** Todo ajuste del planner pide un motivo: queda en el historial con quién y cuándo. */
export const MotivoDialog = ({ titulo, descripcion, confirmar, onConfirmar, onCerrar }: Props) => {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // en React el submit sube por el portal hasta el diálogo de afuera
    setEnviando(true);
    const ok = await onConfirmar(motivo.trim());
    setEnviando(false);
    if (ok) onCerrar();
  };

  return (
    <Dialog open onClose={onCerrar} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: enviar }}>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{descripcion}</DialogContentText>
        <TextField
          autoFocus fullWidth required label="Motivo" value={motivo}
          onChange={e => setMotivo(e.target.value)}
          helperText="Queda en el historial del mes."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!motivo.trim() || enviando}>{confirmar}</Button>
      </DialogActions>
    </Dialog>
  );
};
