import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Switch, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useMovil } from '../../../stores/useMovil';
import { Apertura, Celda } from '../../../stores/useMovil/useMovil.type';
import { formatear } from './formato';
import { APAGADO, TINTA, numeros } from './estilo';
import { MotivoDialog } from './MotivoDialog';

type Props = { sku: string; descripcion: string; canal: string; celda: Celda; onCerrar: () => void };

export const CeldaDialog = ({ sku, descripcion, canal, celda, onCerrar }: Props) => {
  const { unidad, estado, fijar, desfijar, cambiarEntidad, apertura: traerApertura, ocupado } = useMovil();
  const [monto, setMonto] = useState(formatear(celda.monto));
  const [motivo, setMotivo] = useState('');
  const [apertura, setApertura] = useState<Apertura | null>(null);
  const [entidad, setEntidad] = useState<{ nombre: string; activo: boolean }>();
  const fijada = estado?.fijas[unidad].find(f => f.sku === sku && f.canal === canal);

  const cargarApertura = () => traerApertura(sku, canal).then(setApertura);
  useEffect(() => { cargarApertura(); }, [sku, canal, estado]);

  const alFijar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await fijar(sku, canal, monto.trim(), motivo.trim())) onCerrar();
  };
  const alDesfijar = async () => {
    if (await desfijar(sku, canal, motivo.trim())) onCerrar();
  };

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: alFijar }}>
      <DialogTitle>
        {sku} · {canal}
        <Typography variant="body2" color="text.secondary">{descripcion}</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="h4" sx={{ ...numeros, textAlign: 'left', color: celda.fijada ? TINTA : undefined }}>
          {formatear(celda.monto)} <Typography component="span" color="text.secondary">{unidad}</Typography>
        </Typography>
        {fijada && (
          <Typography variant="body2" sx={{ color: TINTA, mt: 0.5 }}>
            Fijado por {fijada.autor}: «{fijada.motivo}». El resto de la fila y la columna absorbe la diferencia.
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <TextField
            label="Nuevo valor" value={monto} onChange={e => setMonto(e.target.value)}
            inputProps={{ inputMode: 'decimal', style: numeros }} sx={{ width: 180 }}
            helperText={unidad === 'kilos' ? 'Hasta 3 decimales' : 'Hasta 2 decimales'}
          />
          <TextField
            label="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)} fullWidth required
            helperText="Queda en el historial del mes."
          />
        </Box>

        {apertura && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" fontWeight={700}>Cómo se abre debajo del canal</Typography>
            {apertura.aviso && <Alert severity="warning" sx={{ my: 1 }}>{apertura.aviso}</Alert>}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Activo</TableCell>
                  <TableCell>Distribuidor o vendedor</TableCell>
                  <TableCell sx={numeros}>Kilos</TableCell>
                  <TableCell sx={numeros}>Plata</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apertura.entidades.map(e => (
                  <TableRow key={e.nombre} sx={{ color: e.activo ? undefined : APAGADO }}>
                    <TableCell padding="checkbox">
                      <Switch
                        size="small" checked={e.activo} disabled={ocupado}
                        inputProps={{ 'aria-label': `${e.activo ? 'Apagar' : 'Prender'} ${e.nombre}` }}
                        onChange={() => setEntidad(e)}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'inherit' }}>{e.nombre}</TableCell>
                    <TableCell sx={{ ...numeros, color: 'inherit' }}>{formatear(e.kilos)}</TableCell>
                    <TableCell sx={{ ...numeros, color: 'inherit' }}>{formatear(e.plata)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {celda.fijada && (
          <Button onClick={alDesfijar} disabled={!motivo.trim() || ocupado} sx={{ mr: 'auto' }}>
            Volver a calculado
          </Button>
        )}
        <Button onClick={onCerrar}>Cerrar</Button>
        <Button type="submit" variant="contained" disabled={!motivo.trim() || !monto.trim() || ocupado}>
          Fijar valor
        </Button>
      </DialogActions>

      {entidad && (
        <MotivoDialog
          titulo={`${entidad.activo ? 'Apagar' : 'Prender'} ${entidad.nombre}`}
          descripcion={entidad.activo
            ? `Deja de recibir en todos los SKUs y canales. Lo suyo se reparte entre los demás.`
            : `Vuelve a recibir según su peso del mes anterior.`}
          confirmar={entidad.activo ? 'Apagar' : 'Prender'}
          onConfirmar={m => cambiarEntidad(entidad.nombre, !entidad.activo, m)}
          onCerrar={() => setEntidad(undefined)}
        />
      )}
    </Dialog>
  );
};
