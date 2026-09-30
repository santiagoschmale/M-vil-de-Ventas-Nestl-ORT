import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider,
  FormControlLabel, Radio, RadioGroup, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useMovil } from '../../../stores/useMovil';
import { Apertura, Celda } from '../../../stores/useMovil/useMovil.type';
import { formatear, UNIDADES } from './formato';
import { APAGADO, TINTA, numeros } from './estilo';
import { MotivoDialog } from './MotivoDialog';
import { Ayuda } from './Ayuda';
import { AYUDA } from './ayudas';

type Props = { sku: string; descripcion: string; canal: string; celda: Celda; onCerrar: () => void };

/** Base de cálculo de una entidad en el canal: por histórico o con un % manual (MUST). */
const BaseDialog = ({ canal, entidad, porcentaje, onCerrar }: {
  canal: string; entidad: string; porcentaje: string | null; onCerrar: () => void;
}) => {
  const { asignarPorcentaje, ocupado } = useMovil();
  const [manual, setManual] = useState(porcentaje != null);
  const [valor, setValor] = useState(porcentaje ? formatear(porcentaje) : '');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // el submit sube por el portal hasta el diálogo de la celda
    const falla = await asignarPorcentaje(canal, entidad, manual ? valor.trim() : null, motivo.trim());
    if (falla) setError(falla);
    else onCerrar();
  };
  return (
    <Dialog open onClose={onCerrar} maxWidth="xs" fullWidth aria-labelledby="titulo-base"
      PaperProps={{ component: 'form', onSubmit: enviar }}>
      <DialogTitle id="titulo-base">Base de cálculo de {entidad}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>
          Vale para todos los SKUs de {canal}, en kilos y en pesos. Con % manual se lleva ese % de cada celda y el
          resto se reparte por histórico entre los demás.
        </DialogContentText>
        <RadioGroup value={manual ? 'manual' : 'historico'} onChange={e => setManual(e.target.value === 'manual')}>
          <FormControlLabel value="historico" control={<Radio />} label="Por histórico (lo que vendió el mes anterior)" />
          <FormControlLabel value="manual" control={<Radio />} label="% manual" />
        </RadioGroup>
        {manual && (
          <TextField label="%" value={valor} onChange={e => { setValor(e.target.value); setError(null); }}
            inputProps={{ inputMode: 'decimal', style: numeros }} sx={{ width: 120, mt: 1 }} />
        )}
        <TextField fullWidth required label="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)}
          sx={{ mt: 2 }} helperText="Queda en el historial, con tu nombre y la hora." />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!motivo.trim() || (manual && !valor.trim()) || ocupado}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const CeldaDialog = ({ sku, descripcion, canal, celda, onCerrar }: Props) => {
  const { unidad, estado, fijar, desfijar, cambiarEntidad, apertura: traerApertura, ocupado } = useMovil();
  const [monto, setMonto] = useState(formatear(celda.monto));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [apertura, setApertura] = useState<Apertura | null>(null);
  const [entidad, setEntidad] = useState<{ nombre: string; activo: boolean }>();
  const [base, setBase] = useState<{ nombre: string; porcentaje: string | null }>();
  const fijada = estado?.fijas[unidad].find(f => f.sku === sku && f.canal === canal);
  const { simbolo, decimales } = UNIDADES[unidad];

  useEffect(() => { traerApertura(sku, canal).then(setApertura); }, [sku, canal, estado]);

  const resultado = (falla: string | null) => (falla ? setError(falla) : onCerrar());
  const alFijar = async (e: React.FormEvent) => {
    e.preventDefault();
    resultado(await fijar(sku, canal, monto.trim(), motivo.trim()));
  };
  const alDesfijar = async () => resultado(await desfijar(sku, canal, motivo.trim()));

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: alFijar }}>
      <DialogTitle>
        {sku} · {canal}
        <Typography variant="body2" color="text.secondary">{descripcion}</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="h4" sx={{ ...numeros, textAlign: 'left', color: celda.fijada ? TINTA : undefined }}>
          {unidad === 'plata' && <Typography component="span" variant="h4" color="text.secondary">$ </Typography>}
          {formatear(celda.monto)}
          {unidad === 'kilos' && <Typography component="span" color="text.secondary"> kg</Typography>}
        </Typography>
        {fijada && (
          <Typography variant="body2" sx={{ color: TINTA, mt: 0.5 }}>
            Fijado por {fijada.autor}: «{fijada.motivo}». El resto de la fila y la columna absorbe la diferencia.
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 3 }}>
          <TextField
            label="Nuevo valor" value={monto} onChange={e => { setMonto(e.target.value); setError(null); }}
            inputProps={{ inputMode: 'decimal', style: numeros }} sx={{ width: 180 }}
            helperText={`En ${simbolo}, hasta ${decimales} decimales`}
          />
          <TextField
            label="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)} required
            sx={{ flex: '1 1 220px' }} helperText="Queda en el historial, con tu nombre y la hora."
          />
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        {apertura && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Cómo se abre debajo del canal</Typography>
              <Ayuda ayuda={AYUDA.apertura} />
            </Box>
            {apertura.aviso && <Alert severity="warning" sx={{ my: 1 }}>{apertura.aviso}</Alert>}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Activo</TableCell>
                  <TableCell>Distribuidor o vendedor</TableCell>
                  <TableCell>Base</TableCell>
                  <TableCell sx={numeros}>{UNIDADES.kilos.nombre}</TableCell>
                  <TableCell sx={numeros}>{UNIDADES.plata.nombre}</TableCell>
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
                    <TableCell>
                      <Button size="small" color="inherit" disabled={ocupado} onClick={() => setBase(e)}
                        aria-label={`Base de ${e.nombre}: ${e.porcentaje ? `${formatear(e.porcentaje)}%` : 'histórico'}`}
                        sx={{ fontWeight: e.porcentaje ? 700 : 400, textTransform: 'none', minWidth: 0 }}>
                        {e.porcentaje ? `${formatear(e.porcentaje)}%` : 'Histórico'}
                      </Button>
                    </TableCell>
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
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!motivo.trim() || !monto.trim() || ocupado}>
          Fijar
        </Button>
      </DialogActions>

      {base && <BaseDialog canal={canal} entidad={base.nombre} porcentaje={base.porcentaje} onCerrar={() => setBase(undefined)} />}
      {entidad && (
        <MotivoDialog
          titulo={`${entidad.activo ? 'Apagar' : 'Prender'} ${entidad.nombre}`}
          descripcion={entidad.activo
            ? 'Deja de recibir en todos los SKUs y canales. Lo suyo pasa a los que siguen prendidos, según lo que vendió cada uno el mes anterior.'
            : 'Vuelve a recibir según su peso del mes anterior.'}
          confirmar={entidad.activo ? 'Apagar' : 'Prender'}
          onConfirmar={m => cambiarEntidad(entidad.nombre, !entidad.activo, m)}
          onCerrar={() => setEntidad(undefined)}
        />
      )}
    </Dialog>
  );
};
