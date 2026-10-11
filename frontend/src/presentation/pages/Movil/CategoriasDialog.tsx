import React, { useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Table, TableBody, TableCell,
  TableHead, TableRow, TextField,
} from '@mui/material';
import { useMovil, useSoloLectura } from '../../../stores/useMovil';
import { Estado } from '../../../stores/useMovil/useMovil.type';
import { Subir } from './Movil';

/**
 * Categoría de los SKUs que no la traen en el objetivo del mes. Se sube un Excel (SKU y
 * Categoría) o se completa a mano. Queda guardada para los meses siguientes.
 */
export const CategoriasDialog = ({ estado, onCerrar }: { estado: Estado; onCerrar: () => void }) => {
  const { asignarCategorias, cargarCategorias, ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const completas = Object.fromEntries(Object.entries(elegidas).filter(([, c]) => c.trim()).map(([s, c]) => [s, c.trim()]));

  const resultado = (falla: string | null) => (falla ? setError(falla) : onCerrar());
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    resultado(await asignarCategorias(completas, motivo.trim()));
  };
  const subir = async (archivo: File) => resultado(await cargarCategorias(archivo));

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth aria-labelledby="titulo-categorias"
      PaperProps={{ component: 'form', onSubmit: guardar }}>
      <DialogTitle id="titulo-categorias">Categorías de los SKUs</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Las reglas se arman por categoría (por ejemplo, «en Mayoristas, el café no pasa del 20%»). Estos SKUs no la
          traen en el objetivo del mes. Lo que asignes queda guardado: el mes que viene solo vas a completar los nuevos.
        </DialogContentText>
        <Subir cargado={false} etiqueta="Excel con SKU y Categoría" texto="Subir Excel con SKU y Categoría" alElegir={subir} />
        <datalist id="categorias-existentes">
          {estado.opciones.categorias.map(c => <option key={c} value={c} />)}
        </datalist>
        <Table size="small" sx={{ mt: 2 }}>
          <TableHead>
            <TableRow><TableCell>SKU</TableCell><TableCell>Descripción</TableCell><TableCell>Categoría</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {estado.sin_categoria.map(({ sku, descripcion }) => (
              <TableRow key={sku}>
                <TableCell>{sku}</TableCell>
                <TableCell>{descripcion}</TableCell>
                <TableCell>
                  <TextField size="small" value={elegidas[sku] ?? ''} placeholder="Elegí o escribí"
                    inputProps={{ list: 'categorias-existentes', 'aria-label': `Categoría de ${sku}`, role: 'combobox' }}
                    onChange={e => { setElegidas(x => ({ ...x, [sku]: e.target.value })); setError(null); }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TextField fullWidth required label="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)} sx={{ mt: 2 }}
          helperText="Queda en el historial, con tu nombre y la hora." />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained"
          disabled={!Object.keys(completas).length || !motivo.trim() || ocupado || soloLectura}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
};
