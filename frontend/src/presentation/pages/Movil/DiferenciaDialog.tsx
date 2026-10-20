import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { useMovil } from '../../../stores/useMovil';
import { Diferencia, Unidad } from '../../../stores/useMovil/useMovil.type';
import { conUnidad, distintos, enMenores, formatear, UNIDADES } from './formato';
import { CIERRA, NO_CIERRA, numeros } from './estilo';

type Props = { unidad: Unidad; onCerrar: () => void };

// Mientras el planner escribe, se le pregunta al backend cuánto falta: el front no suma (Decimal, no float).
const PAUSA_MS = 250;

const sinSigno = (m: string) => m.replace(/^-/, '');

/** Un monto con los caracteres que cambian respecto de `otro` resaltados. */
const Resaltado = ({ monto, otro }: { monto: string; otro: string }) => (
  <>
    {[...monto].map((c, i) => (distintos(monto, otro)[i]
      ? <Box key={i} component="mark" sx={{ bgcolor: alpha('#E0A800', 0.3), color: 'inherit', borderRadius: 0.5, px: '1px' }}>{c}</Box>
      : c))}
  </>
);

/**
 * Lo que pide Contraloría y lo que suman los canales, uno debajo del otro con los dígitos que cambian
 * resaltados, y la diferencia: con dos totales casi iguales, cuesta encontrarla a simple vista.
 */
const Comparacion = ({ d, unidad }: { d: Diferencia; unidad: Unidad }) => {
  const [pide, suman] = [formatear(d.pide), formatear(d.suman)];
  const sobra = d.diferencia.startsWith('-');
  const fila = (etiqueta: string, valor: React.ReactNode, sx = {}) => (
    <>
      <Typography variant="body2" color="text.secondary">{etiqueta}</Typography>
      <Typography variant="body2" sx={{ ...numeros, ...sx }}>{valor}</Typography>
    </>
  );
  // Igual que conUnidad: "1.234,500 kg" y "$ 1.234,50".
  const con = (texto: React.ReactNode) => (unidad === 'kilos' ? <>{texto}{'\u00A0'}kg</> : <>${'\u00A0'}{texto}</>);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'start', columnGap: 3, rowGap: 0.5 }}>
      {fila('Contraloría pide', con(<Resaltado monto={pide} otro={suman} />))}
      {fila('Los canales suman', con(<Resaltado monto={suman} otro={pide} />))}
      {fila(sobra ? 'Sobran' : 'Faltan',
        `${conUnidad(sinSigno(d.diferencia), unidad)}${enMenores(d.diferencia, unidad)}`,
        { fontWeight: 600 })}
    </Box>
  );
};
const conSigno = (m: string) => (m.startsWith('-') ? `−${formatear(sinSigno(m))}` : /[1-9]/.test(m) ? `+${formatear(m)}` : formatear(m));

/**
 * Cuando los totales por canal no suman lo que pide Contraloría: cada canal se lleva una parte de
 * la diferencia según su peso. El planner lo revisa, cambia lo que quiera y lo aplica solo si cierra.
 */
export const DiferenciaDialog = ({ unidad, onCerrar }: Props) => {
  const { diferencia, repartirDiferencia, ocupado } = useMovil();
  const [sugerencia, setSugerencia] = useState<Diferencia>();
  const [vivo, setVivo] = useState<Diferencia>();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [revisando, setRevisando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pedido = useRef(0);
  const nombre = UNIDADES[unidad].nombre.toLowerCase();

  useEffect(() => {
    diferencia(unidad)
      .then(d => {
        setSugerencia(d);
        setVivo(d);
        setValores(Object.fromEntries(d.canales.map(c => [c.canal, formatear(c.sugerido)])));
      })
      .catch(() => setError('No se pudo calcular la sugerencia. Cerrá y probá de nuevo.'));
  }, [unidad]);

  // El último pedido gana: si el planner sigue escribiendo, las respuestas viejas se descartan.
  useEffect(() => {
    if (!sugerencia) return;
    const id = ++pedido.current;
    setRevisando(true);
    const t = setTimeout(() => {
      diferencia(unidad, valores)
        .then(d => { if (id === pedido.current) setVivo(d); })
        .catch(() => { if (id === pedido.current) setError('No se pudo revisar lo que escribiste. Probá de nuevo.'); })
        .finally(() => { if (id === pedido.current) setRevisando(false); });
    }, PAUSA_MS);
    return () => clearTimeout(t);
  }, [valores]);

  const volver = () => {
    if (!sugerencia) return;
    setValores(Object.fromEntries(sugerencia.canales.map(c => [c.canal, formatear(c.sugerido)])));
    setError(null);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      setError('Escribí el motivo: queda en el historial.');
      return;
    }
    const falla = await repartirDiferencia(unidad, valores, motivo.trim());
    if (falla) setError(falla);
    else onCerrar();
  };

  const falta = vivo?.falta ?? null;
  const sobra = !!falta && falta.startsWith('-');
  const estado = !vivo ? null : falta === null ? 'invalido' : vivo.cierra ? 'cierra' : sobra ? 'sobra' : 'falta';
  const tono = { cierra: CIERRA, falta: '#8A5A00', sobra: NO_CIERRA, invalido: NO_CIERRA }[estado ?? 'falta'];
  const porQueNo = !vivo || vivo.cierra ? null
    : falta === null ? 'Corregí el valor marcado para aplicar.'
      : sobra ? `Para aplicar, sacá los ${conUnidad(sinSigno(falta), unidad)} que sobran.`
        : `Para aplicar, repartí los ${conUnidad(falta, unidad)} que faltan.`;

  return (
    <Dialog open onClose={onCerrar} maxWidth="md" fullWidth aria-labelledby="titulo-diferencia"
      PaperProps={{ component: 'form', onSubmit: enviar }}>
      <DialogTitle id="titulo-diferencia">Repartir la diferencia en {nombre}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {!sugerencia && !error && <LinearProgress aria-label="Calculando la sugerencia" />}
        {sugerencia && (
          <>
            <Comparacion d={sugerencia} unidad={unidad} />
            <Typography variant="body2" color="text.secondary">
              Cada canal se lleva una parte según su peso: el que tiene más, recibe más. Podés cambiar cualquier valor.
            </Typography>
            {/* Fijo arriba mientras se baja por los canales: es lo que hay que mirar al escribir. */}
            <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', pb: 0.5 }}>
            <Box role="status" aria-live="polite" sx={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, px: 2, py: 1.5,
              borderRadius: 1, color: tono, bgcolor: alpha(tono, 0.1), transition: 'background-color 160ms ease-out',
            }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'inherit' }}>
                {estado === 'cierra' && <TaskAltRoundedIcon fontSize="small" />}
                {estado === 'cierra' ? 'Repartido: cierra con Contraloría'
                  : estado === 'sobra' ? 'Te pasaste: sobran'
                    : estado === 'invalido' ? 'Hay un valor que no es un monto válido' : 'Falta repartir'}
              </Typography>
              {falta !== null && (
                <Typography variant="h6" component="span" sx={{ ...numeros, color: 'inherit', fontWeight: 600 }}>
                  {estado === 'cierra' ? conUnidad(sugerencia.pide, unidad)
                    : `${conUnidad(sinSigno(falta), unidad)}${enMenores(falta, unidad)}`}
                </Typography>
              )}
            </Box>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label={`Totales por canal en ${nombre}`}>
                <TableHead>
                  <TableRow>
                    <TableCell>Canal</TableCell>
                    <TableCell sx={numeros}>Hoy</TableCell>
                    <TableCell sx={numeros}>Peso</TableCell>
                    <TableCell sx={numeros}>Cambio</TableCell>
                    <TableCell sx={numeros}>Queda</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sugerencia.canales.map(s => {
                    const fila = vivo?.canales.find(c => c.canal === s.canal);
                    const cambio = fila?.cambio ?? null;
                    const tocado = (valores[s.canal] ?? '').trim() !== formatear(s.sugerido);
                    return (
                      <TableRow key={s.canal}>
                        <TableCell>{s.canal}</TableCell>
                        <TableCell sx={numeros}>{formatear(s.hoy)}</TableCell>
                        <TableCell sx={{ ...numeros, color: 'text.secondary' }}>{s.peso.replace('.', ',')} %</TableCell>
                        <TableCell sx={{
                          ...numeros,
                          color: cambio === null ? NO_CIERRA : cambio.startsWith('-') ? NO_CIERRA
                            : /[1-9]/.test(cambio) ? CIERRA : 'text.disabled',
                        }}>
                          {cambio === null ? '—' : conSigno(cambio)}
                        </TableCell>
                        <TableCell sx={{ ...numeros, width: 170 }}>
                          <TextField size="small" value={valores[s.canal] ?? ''}
                            onChange={e => { setValores(v => ({ ...v, [s.canal]: e.target.value })); setError(null); }}
                            error={!!fila?.error} color={tocado ? 'warning' : undefined} focused={tocado || undefined}
                            helperText={fila?.error ? `Este valor ${fila.error}` : tocado ? `sugerido: ${formatear(s.sugerido)}` : undefined}
                            FormHelperTextProps={{ sx: { mx: 0, textAlign: 'right' } }}
                            inputProps={{ 'aria-label': `Queda en ${s.canal}`, inputMode: 'decimal', style: numeros }} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            <Box>
              <Button size="small" color="inherit" startIcon={<UndoRoundedIcon />} onClick={volver}>
                Volver a la sugerencia
              </Button>
            </Box>
            <TextField label="Motivo" value={motivo} onChange={e => { setMotivo(e.target.value); setError(null); }}
              placeholder="Contraloría ajustó el objetivo del mes" helperText="Queda en el historial, con tu nombre y la hora." />
          </>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        {porQueNo && <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>{porQueNo}</Typography>}
        <Button onClick={onCerrar} color="inherit">Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!vivo?.cierra || revisando || ocupado}>
          Aplicar a los totales
        </Button>
      </DialogActions>
    </Dialog>
  );
};
