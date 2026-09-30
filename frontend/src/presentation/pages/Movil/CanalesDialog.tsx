import React, { useState } from 'react';
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormGroup,
  TextField, Typography,
} from '@mui/material';
import { useMovil, useSoloLectura } from '../../../stores/useMovil';
import { Estado } from '../../../stores/useMovil/useMovil.type';

type Props = { sku: string; estado: Estado; onCerrar: () => void };

/**
 * "Dónde se vende": para un SKU sin historia (o para limitar uno que ya tenía). Se reparte
 * en proporción al total de cada canal elegido (supuesto A4, a confirmar con el cliente).
 */
export const CanalesDialog = ({ sku, estado, onCerrar }: Props) => {
  const { elegirCanales, ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  const actuales = estado.canales_sku.find(c => c.sku === sku)?.canales ?? [];
  const [canales, setCanales] = useState<string[]>(actuales);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const alternar = (c: string) => setCanales(cs => (cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const falla = await elegirCanales(sku, canales, motivo.trim());
    if (falla) setError(falla);
    else onCerrar();
  };

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: enviar }}>
      <DialogTitle>¿Dónde se vende el SKU {sku}?</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Su objetivo se reparte entre los canales que elijas, en proporción al total de cada uno. Si el canal se
          abre en vendedores o distribuidores, llega a ellos como se repartió el canal el mes anterior.
        </Typography>
        <FormGroup>
          {estado.opciones.canales.map(c => (
            <FormControlLabel key={c} label={c}
              control={<Checkbox size="small" checked={canales.includes(c)} onChange={() => alternar(c)} />} />
          ))}
        </FormGroup>
        <TextField label="Motivo" required value={motivo} onChange={e => setMotivo(e.target.value)}
          helperText="Queda en el historial, con tu nombre y la hora." />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!canales.length || !motivo.trim() || ocupado || soloLectura}>Guardar</Button>
      </DialogActions>
    </Dialog>
  );
};
