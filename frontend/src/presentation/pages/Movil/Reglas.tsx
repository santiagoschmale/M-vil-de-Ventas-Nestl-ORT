import React, { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  FormGroup, FormLabel, IconButton, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useMovil } from '../../../stores/useMovil';
import { DatosRegla, Estado, Limite, Regla } from '../../../stores/useMovil/useMovil.type';
import { formatear, UNIDADES } from './formato';
import { ENFOCADA, NO_CIERRA, numeros } from './estilo';
import { MotivoDialog } from './MotivoDialog';

const LIMITES: { valor: Limite; nombre: string; ayuda: string }[] = [
  { valor: 'tope', nombre: 'Tope', ayuda: 'Esas categorías se llevan a lo sumo ese % del canal.' },
  { valor: 'minimo', nombre: 'Mínimo', ayuda: 'Esas categorías se llevan al menos ese % del canal.' },
  { valor: 'fijo', nombre: 'Fijo', ayuda: 'Esas categorías se llevan exactamente ese % del canal.' },
];
const NOMBRE_LIMITE = Object.fromEntries(LIMITES.map(l => [l.valor, l.nombre]));

const porcentaje = (p: string | null) => (p == null ? '—' : `${formatear(p)}%`);
const texto = (p: string) => (p.trim() ? p.trim() : null); // vacío = en esa unidad no aplica

/** Reglas que aparecen en alguna inconsistencia de kilos o de pesos. */
const enConflicto = (estado: Estado) =>
  new Set([...estado.inconsistencias.kilos, ...estado.inconsistencias.plata].flatMap(i => i.reglas));

type Formulario = { regla?: Regla };

const ReglaDialog = ({ regla, estado, onCerrar }: Formulario & { estado: Estado; onCerrar: () => void }) => {
  const { agregarRegla, editarRegla, ocupado } = useMovil();
  const [canal, setCanal] = useState(regla?.canal ?? '');
  const [categorias, setCategorias] = useState<string[]>(regla?.categorias ?? []);
  const [limite, setLimite] = useState<Limite>(regla?.limite ?? 'tope');
  const [kilos, setKilos] = useState(regla?.kilos ?? '');
  const [nns, setNns] = useState(regla?.nns ?? '');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { canales, categorias: disponibles } = estado.opciones;
  // Las categorías de la regla que ya no están en el input 1 se muestran igual, para poder sacarlas.
  const opciones = [...new Set([...disponibles, ...categorias])].sort();

  const alternar = (c: string) =>
    setCategorias(actual => (actual.includes(c) ? actual.filter(x => x !== c) : [...actual, c].sort()));
  const completo = canal.trim() && categorias.length && (kilos.trim() || nns.trim()) && motivo.trim();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const datos: DatosRegla = { canal: canal.trim(), categorias, limite, kilos: texto(kilos), nns: texto(nns) };
    const falla = regla ? await editarRegla(regla.id, datos, motivo.trim()) : await agregarRegla(datos, motivo.trim());
    if (falla) setError(falla);
    else onCerrar();
  };

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: enviar }}>
      <DialogTitle>{regla ? `Editar ${regla.id}` : 'Agregar regla'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {canales.length ? (
          <TextField select label="Canal" value={canal} onChange={e => setCanal(e.target.value)}
            SelectProps={{ native: true }} InputLabelProps={{ shrink: true }} sx={{ mt: 1 }}>
            <option value="" disabled>Elegí un canal</option>
            {[...new Set([...canales, ...(canal ? [canal] : [])])].map(c => <option key={c} value={c}>{c}</option>)}
          </TextField>
        ) : (
          <TextField label="Canal" value={canal} onChange={e => setCanal(e.target.value)} sx={{ mt: 1 }}
            helperText="Como figura en el input 2. Cuando lo cargues, se elige de la lista." />
        )}

        <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
          <FormLabel component="legend">Categorías</FormLabel>
          {opciones.length ? (
            <FormGroup row>
              {opciones.map(c => (
                <FormControlLabel key={c} label={c}
                  control={<Checkbox size="small" checked={categorias.includes(c)} onChange={() => alternar(c)} />} />
              ))}
            </FormGroup>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Las categorías salen del input 1: cargalo para elegirlas.
            </Typography>
          )}
        </Box>

        <Box>
          <FormLabel id="limite">Límite</FormLabel>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 0.5 }}>
            <ToggleButtonGroup size="small" exclusive value={limite} aria-labelledby="limite"
              onChange={(_, v: Limite | null) => v && setLimite(v)}>
              {LIMITES.map(l => <ToggleButton key={l.valor} value={l.valor}>{l.nombre}</ToggleButton>)}
            </ToggleButtonGroup>
            <Typography variant="body2" color="text.secondary">
              {LIMITES.find(l => l.valor === limite)?.ayuda}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField label="% de kilos" value={kilos} onChange={e => { setKilos(e.target.value); setError(null); }}
            inputProps={{ inputMode: 'decimal', style: numeros }} sx={{ width: 160 }}
            helperText="Del total del canal" />
          <TextField label={`% de ${UNIDADES.plata.nombre.toLowerCase()}`} value={nns}
            onChange={e => { setNns(e.target.value); setError(null); }}
            inputProps={{ inputMode: 'decimal', style: numeros }} sx={{ width: 160 }}
            helperText="Vacío: no aplica" />
        </Box>

        <TextField label="Motivo" required value={motivo} onChange={e => setMotivo(e.target.value)}
          helperText="Queda en el historial, con tu nombre y la hora." />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!completo || ocupado}>
          {regla ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const Reglas = ({ estado }: { estado: Estado }) => {
  const { eliminarRegla, foco } = useMovil();
  const [formulario, setFormulario] = useState<Formulario>();
  const [eliminar, setEliminar] = useState<Regla>();
  const chocan = enConflicto(estado);

  return (
    <>
      {estado.reglas.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Todavía no hay reglas. Una regla limita cuánto de un canal se lleva un grupo de categorías, por ejemplo
          Mayoristas · Café · tope 20% de los kilos. El reparto la cumple y el resto se reparte como el mes anterior.
        </Typography>
      ) : (
        <Table size="small" aria-label="Reglas del mes" sx={{ mb: 1.5 }}>
          <TableHead>
            <TableRow>
              <TableCell>Regla</TableCell>
              <TableCell>Canal</TableCell>
              <TableCell>Categorías</TableCell>
              <TableCell>Límite</TableCell>
              <TableCell sx={numeros}>{UNIDADES.kilos.nombre}</TableCell>
              <TableCell sx={numeros}>{UNIDADES.plata.nombre}</TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {estado.reglas.map(r => (
              <TableRow key={r.id} id={`regla-${r.id}`}
                aria-current={foco?.tipo === 'regla' && foco.id === r.id ? true : undefined}
                sx={foco?.tipo === 'regla' && foco.id === r.id ? ENFOCADA : undefined}>
                <TableCell sx={{ fontWeight: 700 }}>{r.id}</TableCell>
                <TableCell>{r.canal}</TableCell>
                <TableCell>{r.categorias.join(' + ')}</TableCell>
                <TableCell>{NOMBRE_LIMITE[r.limite]}</TableCell>
                <TableCell sx={numeros}>{porcentaje(r.kilos)}</TableCell>
                <TableCell sx={numeros}>{porcentaje(r.nns)}</TableCell>
                <TableCell>
                  {chocan.has(r.id) && (
                    <Tooltip title='No se puede cumplir: el detalle está en "Para revisar".'>
                      <Chip size="small" variant="outlined" label="Choca"
                        sx={{ borderColor: NO_CIERRA, color: NO_CIERRA, fontWeight: 700 }} />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <IconButton size="small" aria-label={`Editar ${r.id}`} onClick={() => setFormulario({ regla: r })}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" aria-label={`Eliminar ${r.id}`} onClick={() => setEliminar(r)}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Button size="small" variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setFormulario({})}>
        Agregar regla
      </Button>

      {formulario && <ReglaDialog {...formulario} estado={estado} onCerrar={() => setFormulario(undefined)} />}
      {eliminar && (
        <MotivoDialog
          titulo={`Eliminar ${eliminar.id}`}
          descripcion="El reparto vuelve a calcularse sin esta regla. El historial la conserva."
          confirmar="Eliminar"
          onConfirmar={m => eliminarRegla(eliminar.id, m)}
          onCerrar={() => setEliminar(undefined)}
        />
      )}
    </>
  );
};
