import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider,
  FormControlLabel, IconButton, Radio, RadioGroup, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useMovil, useSoloLectura } from '../../../stores/useMovil';
import { Apertura, Celda } from '../../../stores/useMovil/useMovil.type';
import { formatear, UNIDADES } from './formato';
import { APAGADO, TINTA, numeros } from './estilo';
import { MotivoDialog } from './MotivoDialog';
import { Ayuda } from './Ayuda';
import { AYUDA } from './ayudas';

type Props = { sku: string; descripcion: string; canal: string; celda: Celda; onCerrar: () => void };

/** Base de cálculo de una entidad en el canal: por histórico o con un % manual (MUST). */
const BaseDialog = ({ canal, entidad, porcentaje, nueva, onCerrar }: {
  canal: string; entidad: string; porcentaje: string | null; nueva: boolean; onCerrar: () => void;
}) => {
  const { asignarPorcentaje, ocupado, estado } = useMovil();
  const soloLectura = useSoloLectura();
  const asignado = estado?.porcentaje_asignado[canal];  // lo suma el backend: el front no calcula
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
          Vale para todos los SKUs de {canal}, en kilos y en pesos. Con % manual se lleva ese % de lo que hay para
          repartir en cada celda (lo fijado a mano queda aparte) y el resto se reparte por histórico entre los demás.
          {asignado && ` Hoy en ${canal} hay ${formatear(asignado)}% asignado a mano; no puede pasar de 100.`}
        </DialogContentText>
        {nueva ? (
          <DialogContentText sx={{ mb: 1 }}>Es nueva y no tiene historia: siempre va con %.</DialogContentText>
        ) : (
          <RadioGroup value={manual ? 'manual' : 'historico'} onChange={e => setManual(e.target.value === 'manual')}>
            <FormControlLabel value="historico" control={<Radio />} label="Por histórico (lo que vendió el mes anterior)" />
            <FormControlLabel value="manual" control={<Radio />} label="% manual" />
          </RadioGroup>
        )}
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
        <Button type="submit" variant="contained" disabled={!motivo.trim() || (manual && !valor.trim()) || ocupado || soloLectura}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Alta de un distribuidor o vendedor nuevo: sin historia, entra con un % (MUST). */
const AltaDialog = ({ canal, onCerrar }: { canal: string; onCerrar: () => void }) => {
  const { agregarEntidad, ocupado } = useMovil();
  const [nombre, setNombre] = useState('');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // el submit sube por el portal hasta el diálogo de la celda
    const falla = await agregarEntidad(canal, nombre.trim(), valor.trim(), motivo.trim());
    if (falla) setError(falla);
    else onCerrar();
  };
  return (
    <Dialog open onClose={onCerrar} maxWidth="xs" fullWidth aria-labelledby="titulo-alta"
      PaperProps={{ component: 'form', onSubmit: enviar }}>
      <DialogTitle id="titulo-alta">Agregar a {canal}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Un distribuidor o vendedor que no estaba el mes anterior. Como no tiene historia, entra con un % fijo:
          recibe ese % de cada celda de {canal} que se abre entre distribuidores o vendedores, en kilos y en pesos, y
          los demás se reparten el resto. Después se puede cambiar el %, apagarlo o eliminarlo.
        </DialogContentText>
        <TextField fullWidth autoFocus label="Nombre" value={nombre} onChange={e => { setNombre(e.target.value); setError(null); }} />
        <TextField label="%" value={valor} onChange={e => { setValor(e.target.value); setError(null); }}
          inputProps={{ inputMode: 'decimal', style: numeros }} sx={{ width: 120, mt: 2 }} />
        <TextField fullWidth required label="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)}
          sx={{ mt: 2 }} helperText="Queda en el historial, con tu nombre y la hora." />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!nombre.trim() || !valor.trim() || !motivo.trim() || ocupado}>
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const CeldaDialog = ({ sku, descripcion, canal, celda, onCerrar }: Props) => {
  const { unidad, estado, fijar, desfijar, cambiarEntidad, eliminarEntidad, apertura: traerApertura, ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  const [monto, setMonto] = useState(formatear(celda.monto));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [apertura, setApertura] = useState<Apertura | null>(null);
  const [entidad, setEntidad] = useState<{ nombre: string; activo: boolean }>();
  const [base, setBase] = useState<{ nombre: string; porcentaje: string | null; nueva: boolean }>();
  const [alta, setAlta] = useState(false);
  const [eliminar, setEliminar] = useState<string>();
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
                        size="small" checked={e.activo} disabled={ocupado || soloLectura}
                        inputProps={{ 'aria-label': `${e.activo ? 'Apagar' : 'Prender'} ${e.nombre}` }}
                        onChange={() => setEntidad(e)}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'inherit' }}>
                      {e.nombre}
                      {e.nueva && (
                        <>
                          <Chip size="small" label="Nueva" variant="outlined" sx={{ ml: 1 }} />
                          <IconButton size="small" aria-label={`Eliminar ${e.nombre}`} disabled={ocupado || soloLectura}
                            onClick={() => setEliminar(e.nombre)}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="small" color="inherit" disabled={ocupado || soloLectura} onClick={() => setBase(e)}
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
            <Button size="small" startIcon={<AddRoundedIcon />} sx={{ mt: 1 }} disabled={ocupado || soloLectura} onClick={() => setAlta(true)}>
              Agregar distribuidor o vendedor
            </Button>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {celda.fijada && (
          <Button onClick={alDesfijar} disabled={!motivo.trim() || ocupado || soloLectura} sx={{ mr: 'auto' }}>
            Volver a calculado
          </Button>
        )}
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!motivo.trim() || !monto.trim() || ocupado || soloLectura}>
          Fijar
        </Button>
      </DialogActions>

      {alta && <AltaDialog canal={canal} onCerrar={() => setAlta(false)} />}
      {eliminar && (
        <MotivoDialog
          titulo={`Eliminar ${eliminar}`}
          descripcion={`Sale de ${canal}: su parte vuelve a repartirse entre los demás. El historial lo conserva.`}
          confirmar="Eliminar"
          onConfirmar={m => eliminarEntidad(canal, eliminar, m)}
          onCerrar={() => setEliminar(undefined)}
        />
      )}
      {base && <BaseDialog canal={canal} entidad={base.nombre} porcentaje={base.porcentaje} nueva={base.nueva} onCerrar={() => setBase(undefined)} />}
      {entidad && (
        <MotivoDialog
          titulo={`${entidad.activo ? 'Apagar' : 'Prender'} ${entidad.nombre}`}
          descripcion={entidad.activo
            ? 'Deja de recibir en todos los SKUs y canales. Lo suyo pasa a los que siguen prendidos, según lo que vendió cada uno el mes anterior.'
            : 'Vuelve a recibir su parte: por histórico o con su %, según su base.'}
          confirmar={entidad.activo ? 'Apagar' : 'Prender'}
          onConfirmar={m => cambiarEntidad(entidad.nombre, !entidad.activo, m)}
          onCerrar={() => setEntidad(undefined)}
        />
      )}
    </Dialog>
  );
};
