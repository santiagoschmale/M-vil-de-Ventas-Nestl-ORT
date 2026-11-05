import React, { useEffect, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, Link, List, ListItem, ListItemText, Paper, Radio, RadioGroup, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { alpha } from '@mui/material/styles';
import { useMovil, useSoloLectura } from '../../../stores/useMovil';
import { Estado, RevisionTotales, RevisionUnidad, Unidad } from '../../../stores/useMovil/useMovil.type';
import { conUnidad, enMenores, formatear, nombreMes, UNIDADES } from './formato';
import { AVENA, CIERRA, NO_CIERRA, numeros } from './estilo';
import { Alerta, Principal, Resolver } from './Alerta';
import { Subir } from './Subir';
import { Ayuda } from './Ayuda';
import { AYUDA } from './ayudas';
import { Foco, Repetido } from '../../../stores/useMovil/useMovil.type';
import { Matriz } from './Matriz';
import { Reglas } from './Reglas';
import { CanalesDialog } from './CanalesDialog';
import { CategoriasDialog } from './CategoriasDialog';
import { MotivoDialog } from './MotivoDialog';
import { Historial } from './Historial';

const ACCIONES: Record<string, string> = {
  agregar_regla: 'Agregó una regla', editar_regla: 'Editó una regla', eliminar_regla: 'Eliminó una regla',
  cargar_input1: 'Cargó el objetivo de Contraloría', cargar_input2: 'Cargó los totales por canal',
  cargar_base: 'Cargó el mes anterior',
  apagar_sku: 'Apagó un SKU', prender_sku: 'Prendió un SKU',
  apagar_entidad: 'Apagó un distribuidor o vendedor', prender_entidad: 'Prendió un distribuidor o vendedor',
  fijar: 'Fijó una celda', desfijar: 'Volvió una celda a calculada',
  deshacer: 'Deshizo el último cambio',
  aprobar: 'Aprobó el móvil', reabrir: 'Volvió el móvil a borrador', revisar_etapa: 'Revisó una etapa',
  elegir_fila: 'Eligió qué fila vale de un SKU repetido',
  elegir_canales: 'Eligió dónde se vende un SKU', quitar_canales: 'Volvió un SKU a sus canales del mes anterior',
  porcentaje: 'Cambió la base de cálculo', quitar_input2: 'Sacó los totales por canal',
  asignar_categorias: 'Asignó categorías', heredar: 'Arrancó desde el mes anterior aprobado',
  agregar_entidad: 'Agregó un distribuidor o vendedor', eliminar_entidad: 'Eliminó un distribuidor o vendedor',
  proponer_pesos: 'Propuso los pesos por canal según los kilos',
  abrir_canal: 'Abrió un canal entre distribuidores o vendedores', cerrar_canal: 'Dejó un canal sin abrir debajo', repartir_diferencia: 'Repartió la diferencia entre los canales',
};

const Dato = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{children}</Typography>
);

const Tarjeta = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Typography fontWeight={700}>{titulo}</Typography>
    {children}
  </Paper>
);

type Totales = NonNullable<Estado['entradas']['input2']>;
type Objetivo = Estado['entradas']['input1'];
type Sugerencia = NonNullable<Estado['entradas']['base']>['canales'];
type Fila = { id: string; canal: string; kilos: string; plata: string; nueva: boolean };
type Campo = 'kilos' | 'plata';

const fila = (f: Partial<Fila>): Fila => ({ id: crypto.randomUUID(), canal: '', kilos: '', plata: '', nueva: false, ...f });
const aTexto = (m: string | null) => (m == null ? '' : formatear(m));
const PAUSA_MS = 250;
const sinSigno = (m: string) => m.replace(/^-/, '');

/**
 * Una unidad de los totales que se están armando, contra lo que pide Contraloría, en vivo: cierra, es un
 * redondeo que se reparte solo, o falta/sobra, con las acciones para corregirlo.
 */
const EstadoTotal = ({ r, unidad, acciones, nota }: {
  r: RevisionUnidad; unidad: Unidad; acciones: React.ReactNode;
  nota?: string; // reemplaza la explicación del ajuste (p. ej. por qué un botón está deshabilitado)
}) => {
  if (r.falta === null) return null;
  const nombre = UNIDADES[unidad].nombre;
  const sobra = r.falta.startsWith('-');
  const diferencia = `${conUnidad(sinSigno(r.falta), unidad)}${enMenores(r.falta, unidad)}`;
  return r.cierra
    ? <Alerta tono="listo" titulo={`${nombre}: cierran con Contraloría`}>{conUnidad(r.pide, unidad)}</Alerta>
    : r.se_reparte_solo
    ? <Alerta tono="listo" titulo={`${nombre}: ${sobra ? 'sobran' : 'faltan'} ${diferencia}`}>Es un redondeo: se reparte solo al guardar.</Alerta>
    : <Alerta tono="frena" titulo={`${nombre}: ${sobra ? 'sobran' : 'faltan'} ${diferencia}`} acciones={acciones}>
        Contraloría pide {conUnidad(r.pide, unidad)}.{' '}
        {nota ?? `«Ajustar a Contraloría» ${sobra ? 'le saca' : 'le suma'} a cada canal su parte, según su tamaño.`}
      </Alerta>;
};
// La misma regla que `normalizar` del backend: sin tildes, mayúsculas ni espacios de más.
const claveDeCanal = (canal: string) =>
  canal.normalize('NFKD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Los totales por canal, en la pantalla: editar los cargados (una fila por canal) o
 * armarlos sin Excel, arrancando de los kilos del mes anterior si ya se cargó.
 */
const TotalesDialog = ({ totales, sugerencia, objetivo, aviso, onCerrar }: {
  totales: Totales | null; sugerencia?: Sugerencia; objetivo: Objetivo; onCerrar: () => void;
  aviso?: string; // por qué se abrió desde Para revisar, si los totales cierran pero algo no
}) => {
  const { editarTotales, pesosSugeridos, revisarTotales, ocupado } = useMovil();
  const [iniciales] = useState<Fila[]>(() => {
    // Pesos vacíos: los del mes anterior, si su archivo los trae.
    const pesosAnteriores = new Map((sugerencia ?? []).map(t => [claveDeCanal(t.canal), aTexto(t.plata)]));
    if (totales) {
      return totales.detalle.map(t => fila({
        canal: t.canal, kilos: aTexto(t.kilos), plata: aTexto(t.plata) || (pesosAnteriores.get(claveDeCanal(t.canal)) ?? ''),
      }));
    }
    if (sugerencia?.length) return sugerencia.map(t => fila({ canal: t.canal, kilos: aTexto(t.kilos), plata: aTexto(t.plata) }));
    return [fila({ nueva: true })];
  });
  // Lo cargado, por fila, para mostrar "antes: …" y qué canales se sacan (se compara texto: el front no calcula).
  const [originales] = useState(() => new Map(totales ? iniciales.map(f => [f.id, f]) : []));
  const [filas, setFilas] = useState(iniciales);
  const [error, setError] = useState<string | null>(null);
  const cambiar = (id: string, campo: 'canal' | Campo, valor: string) => {
    setFilas(fs => fs.map(f => (f.id === id ? { ...f, [campo]: valor } : f)));
    setError(null);
  };
  // Mientras se escriben los totales, el backend dice cuánto falta para Contraloría en kilos y en pesos;
  // el último pedido gana.
  const [revision, setRevision] = useState<RevisionTotales>();
  const pedido = useRef(0);
  const escritos = filas.map(f => `${f.canal.trim()}\t${f.kilos.trim()}\t${f.plata.trim()}`).join('\n');
  const columna = (campo: Campo) =>
    Object.fromEntries(filas.filter(f => f.canal.trim()).map(f => [f.canal.trim(), f[campo].trim()]));
  useEffect(() => {
    if (!objetivo) return;
    const id = ++pedido.current;
    const t = setTimeout(() => {
      revisarTotales(columna('kilos'), columna('plata'))
        .then(r => { if (id === pedido.current) setRevision(r); })
        // Sin revisión no se sabe si cierran: no se muestra "cierran" ni se habilitan los pesos con una vieja.
        .catch(() => { if (id === pedido.current) { setRevision(undefined); setError('No se pudo revisar los totales. Probá de nuevo.'); } });
    }, PAUSA_MS);
    return () => clearTimeout(t);
  }, [escritos]);
  const ajustar = (campo: Campo, r?: RevisionUnidad | null) => {
    const ajustados = r?.ajustados ?? {};
    setFilas(fs => fs.map(f => (ajustados[f.canal.trim()] ? { ...f, [campo]: aTexto(ajustados[f.canal.trim()]) } : f)));
  };
  // Los pesos salen de los kilos: se sugieren cuando los kilos ya cierran, a pedido del planner.
  const kilosListos = !objetivo || !!revision?.kilos.cierra || !!revision?.kilos.se_reparte_solo;
  const pesosListos = !objetivo || !!revision?.plata?.cierra || !!revision?.plata?.se_reparte_solo;
  const conPesos = /[1-9]/.test(objetivo?.nns ?? '');  // un monto no pasa por número de JavaScript
  const [sugiriendo, setSugiriendo] = useState(false);
  // Completar llena solo los vacíos; recalcular reemplaza todos los pesos por los sugeridos.
  // El aviso de Para revisar ("los pesos no van con sus kilos") deja de valer una vez que se recalculan.
  const [recalculado, setRecalculado] = useState(false);
  const avisoVigente = !!aviso && !recalculado;
  const sugerirPesos = (todos: boolean) => {
    setSugiriendo(true);
    if (todos) setRecalculado(true);
    pesosSugeridos(columna('kilos'))
      .then(pesos => setFilas(fs => fs.map(f => (f.plata.trim() && !todos ? f : { ...f, plata: aTexto(pesos[f.canal.trim()] ?? null) }))))
      .catch(() => setError('No se pudieron sugerir los pesos. Completalos a mano o probá de nuevo.'))
      .finally(() => setSugiriendo(false));
  };
  const recalcular = (
    <Principal onClick={() => sugerirPesos(true)} disabled={sugiriendo || !kilosListos}>Recalcular según los kilos</Principal>
  );
  // Corregir totales ya cargados es un ajuste: queda en el historial con su motivo.
  const [motivo, setMotivo] = useState('');
  const antes = (f: Fila, campo: Campo) => {
    const original = originales.get(f.id);
    return original && f[campo].trim() !== original[campo] ? `antes: ${original[campo] || 'vacío'}` : undefined;
  };
  const nombre = (f: Fila, i: number) => f.canal.trim() || `canal ${i + 1}`;

  // Avisos de lo que va a pasar al guardar; la regla la aplica el backend.
  const conCanal = filas.filter(f => f.canal.trim());
  const cuantas = new Map<string, number>();
  conCanal.forEach(f => cuantas.set(claveDeCanal(f.canal), (cuantas.get(claveDeCanal(f.canal)) ?? 0) + 1));
  const repetido = (f: Fila) => (cuantas.get(claveDeCanal(f.canal)) ?? 0) > 1;
  const sinNombre = (f: Fila) => !f.canal.trim() && !!(f.kilos.trim() || f.plata.trim());
  const sinPesos = conCanal.filter(f => !f.plata.trim()).length;
  const sacados = [...originales.values()].filter(o => !filas.some(f => f.id === o.id)).map(o => o.canal);
  const puedeGuardar = conCanal.length > 0 && !filas.some(f => repetido(f) || sinNombre(f));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    // La misma tabla que lee el backend, con los números como se escriben acá (1.234,5).
    const texto = ['Canal\tKilos\tPlata', ...conCanal.map(f => `${f.canal.trim()}\t${f.kilos.trim()}\t${f.plata.trim()}`)]
      .join('\n');
    if (totales && !motivo.trim()) {
      setError('Escribí el motivo: queda en el historial.');
      return;
    }
    const falla = await editarTotales(texto, totales ? motivo.trim() : undefined);
    if (falla) setError(falla);
    else onCerrar();
  };

  return (
    <Dialog open onClose={onCerrar} maxWidth="md" fullWidth aria-labelledby="titulo-totales"
      PaperProps={{ component: 'form', onSubmit: guardar }}>
      <DialogTitle id="titulo-totales">{totales ? 'Editar' : 'Armar'} totales por canal</DialogTitle>
      <DialogContent>
        <Box role="status" aria-live="polite" sx={{ display: 'grid', gap: 1, mb: 2 }}>
          {avisoVigente && <Alerta tono="frena" titulo="Pesos no cierra" acciones={conPesos && recalcular}>{aviso}</Alerta>}
          {revision && (
            <EstadoTotal r={revision.kilos} unidad="kilos"
              acciones={<Principal onClick={() => ajustar('kilos', revision.kilos)}>Ajustar a Contraloría</Principal>} />
          )}
          {revision?.plata && sinPesos === 0 && (
            <EstadoTotal r={revision.plata} unidad="plata"
              nota={conPesos && !kilosListos ? 'Primero ajustá los kilos: los pesos se recalculan con ellos.' : undefined}
              acciones={<>
              {conPesos && !avisoVigente && recalcular}
              <Resolver onClick={() => ajustar('plata', revision.plata)}>Ajustar a Contraloría</Resolver>
            </>} />
          )}
        </Box>
        {sinPesos > 0 && (
          <Box sx={{ mb: 2 }}>
            <Alerta tono="aviso" titulo={sinPesos === conCanal.length ? 'Faltan los pesos' : `Falta el peso de ${sinPesos} ${sinPesos === 1 ? 'canal' : 'canales'}`}
              acciones={conPesos && (
                <Principal onClick={() => sugerirPesos(false)} disabled={sugiriendo || !kilosListos}>Completar con los sugeridos</Principal>
              )}>
              {conPesos && !kilosListos
                ? 'Salen de los kilos: primero ajustá los kilos a lo que pide Contraloría.'
                : conPesos
                ? 'Se sugieren según los kilos de cada canal, al precio que tuvo cada SKU en ese canal el mes anterior. Después los podés cambiar.'
                : 'Sin pesos, se reparten solo los kilos hasta que los completes.'}
            </Alerta>
          </Box>
        )}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Canal</TableCell>
              <TableCell sx={numeros}>Kilos (kg)</TableCell>
              <TableCell sx={numeros}>{UNIDADES.plata.nombre} ($)</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((f, i) => (
              <TableRow key={f.id}>
                <TableCell>
                  {f.nueva
                    ? <TextField size="small" value={f.canal} onChange={e => cambiar(f.id, 'canal', e.target.value)}
                        error={repetido(f) || sinNombre(f)}
                        helperText={repetido(f) ? 'Ya está en la tabla' : sinNombre(f) ? 'Falta el nombre' : undefined}
                        inputProps={{ 'aria-label': `Canal ${i + 1}` }} />
                    : f.canal}
                </TableCell>
                {(['kilos', 'plata'] as const).map(campo => {
                  const a = antes(f, campo);
                  return (
                    <TableCell key={campo} align="right">
                      <TextField size="small" value={f[campo]} onChange={e => cambiar(f.id, campo, e.target.value)}
                        helperText={a} color={a ? 'warning' : undefined} focused={!!a || undefined}
                        inputProps={{
                          'aria-label': `${campo === 'kilos' ? 'Kilos' : 'Pesos'} de ${nombre(f, i)}`,
                          inputMode: 'decimal', style: numeros,
                        }} />
                    </TableCell>
                  );
                })}
                <TableCell padding="checkbox">
                  <IconButton size="small" aria-label={`Sacar ${nombre(f, i)}`}
                    onClick={() => setFilas(fs => fs.filter(x => x.id !== f.id))}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button size="small" startIcon={<AddRoundedIcon />} sx={{ mt: 1 }}
          onClick={() => setFilas(fs => [...fs, fila({ nueva: true })])}>
          Agregar canal
        </Button>
        {sacados.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Alerta tono="aviso" titulo={`Vas a sacar ${sacados.join(', ')}`}>
              Al guardar deja de estar en los totales por canal.
            </Alerta>
          </Box>
        )}
        {totales && (
          <TextField label="Motivo" value={motivo} onChange={e => { setMotivo(e.target.value); setError(null); }}
            fullWidth sx={{ mt: 2 }} placeholder="Contraloría ajustó el objetivo del mes"
            helperText="Queda en el historial, con tu nombre y la hora." />
        )}
        {error && <Box sx={{ mt: 2 }}><Alerta tono="frena">{error}</Alerta></Box>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        {revision && !(kilosListos && pesosListos && sinPesos === 0) && (
          <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
            {!kilosListos && (sinPesos > 0 || !pesosListos) ? 'Kilos y pesos no cierran con Contraloría.'
              : !kilosListos ? 'Los kilos no cierran con Contraloría.'
                : sinPesos > 0 ? 'Faltan pesos.' : 'Los pesos no cierran con Contraloría.'}
            {' '}Podés guardar igual: queda en Para revisar.
          </Typography>
        )}
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={ocupado || !puedeGuardar}>Guardar</Button>
      </DialogActions>
    </Dialog>
  );
};

const Entradas = ({ estado }: { estado: Estado }) => {
  const { cargarInput1, cargarInput2, cargarBase, cargarMuestra, ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  const { input1, input2, base } = estado.entradas;
  const [editar, setEditar] = useState(false);

  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
        <Tarjeta titulo="Objetivo de Contraloría">
          <Box><Subir cargado={!!input1} etiqueta="Excel del objetivo de Contraloría" alElegir={cargarInput1} /></Box>
          {input1 && (
            <Box>
              <Dato>{input1.archivo}</Dato>
              <Dato>{input1.skus} SKUs · {conUnidad(input1.kilos, 'kilos')} · {conUnidad(input1.nns, 'plata')}</Dato>
            </Box>
          )}
        </Tarjeta>

        <Tarjeta titulo="Totales por canal">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {/* Editar (o armar en la pantalla) es lo de todos los meses; subir otro Excel, lo raro. */}
            <Button size="small" variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => setEditar(true)}
              disabled={ocupado || soloLectura}
              aria-label={input2 ? 'Editar totales por canal' : 'Armar totales por canal en la pantalla'}>
              {input2 ? 'Editar' : 'Armar en pantalla'}
            </Button>
            <Subir cargado={!!input2} etiqueta="Excel de totales por canal" alElegir={cargarInput2} secundario
              texto={input2 ? 'Subir otro Excel' : 'Subir Excel'} />
          </Box>
          {input2 && (
            <Box>
              <Dato>{input2.archivo ?? 'Editados a mano'}</Dato>
              <Dato>{input2.canales} canales · {conUnidad(input2.kilos, 'kilos')} · {conUnidad(input2.plata, 'plata')}</Dato>
            </Box>
          )}
        </Tarjeta>

        <Tarjeta titulo="Mes anterior">
          <Box><Subir cargado={!!base} etiqueta="Excel del mes anterior" alElegir={cargarBase} /></Box>
          {base && (
            <Box>
              <Dato>{base.archivo}</Dato>
              <Dato>{base.celdas} celdas · {base.aperturas} aperturas</Dato>
            </Box>
          )}
        </Tarjeta>
      </Box>
      {import.meta.env.DEV && (
        <Box sx={{ mt: 1.5 }}>
          <Link component="button" variant="body2" disabled={ocupado || soloLectura} onClick={() => cargarMuestra()}>
            Cargar datos de muestra (solo en desarrollo)
          </Link>
          {' · '}
          <Tooltip describeChild title="Carga el objetivo y el mes anterior, y deja los totales por canal para armarlos en la pantalla">
            <Link component="button" variant="body2" disabled={ocupado || soloLectura} onClick={() => cargarMuestra('sin_totales')}>
              sin totales por canal
            </Link>
          </Tooltip>
          {' · '}
          <Link component="button" variant="body2" disabled={ocupado || soloLectura} onClick={() => cargarMuestra('objetivo')}>
            solo el objetivo de Contraloría
          </Link>
        </Box>
      )}
      {editar && (
        <TotalesDialog totales={input2} sugerencia={base?.canales} objetivo={input1}
          onCerrar={() => setEditar(false)} />
      )}
    </>
  );
};

const conSku = (p: Estado['problemas'][number]) =>
  (p.sku ? `SKU ${p.sku}${p.descripcion ? ` (${p.descripcion})` : ''} · ${p.mensaje}` : p.mensaje);

/** "Ir a R1", "Ir al SKU 900…": de un problema al lugar donde se mira. Solo lleva: por eso va sin borde y con flecha. */
const Ir = ({ destinos }: { destinos: [Foco['tipo'], string][] }) => {
  const { enfocar } = useMovil();
  return (
    <>
      {destinos.map(([tipo, id]) => (
        <Button key={`${tipo}-${id}`} size="small" color="inherit" onClick={() => enfocar(tipo, id)}
          endIcon={<ArrowForwardRoundedIcon fontSize="small" />} sx={{ whiteSpace: 'nowrap', fontWeight: 400, color: 'text.secondary' }}>
          {tipo === 'sku' ? `Ir al SKU ${id}` : `Ir a ${id}`}
        </Button>
      ))}
    </>
  );
};

// El título corto de cada alerta: qué pasa, en dos o tres palabras. El detalle (qué hacer) va abajo.
const TITULO_INCONSISTENCIA: Record<string, string> = {
  totales_distintos: 'No coincide con Contraloría', sku_sin_canal: 'SKU sin historia', canal_sin_sku: 'Canal sin historia',
  canales_sin_volumen: 'Los SKUs no alcanzan', fijado_excede: 'Lo fijado no entra', regla_incumplible: 'Regla que no se cumple',
  reglas_en_conflicto: 'Reglas que chocan', reglas_superpuestas: 'Reglas superpuestas',
};
// ponytail: los problemas del archivo no traen todos un tipo; se reconocen por el texto. Si crecen, que el backend mande el tipo.
const tituloProblema = (p: Estado['problemas'][number]) => {
  if (p.tipo === 'sku_repetido') return 'SKU repetido';
  if (p.tipo === 'sin_categoria') return 'SKUs sin categoría';
  const m = p.mensaje.toLowerCase();
  if (m.includes('objetivo en cero')) return 'Objetivo en cero';
  if (m.includes('otro país')) return 'Producto de otro país';
  if (m.includes('se repartieron entre los canales')) return 'Se ajustó el redondeo';
  if (m.includes('decimales')) return 'Decimales de más';
  if (m.includes('no se puede abrir')) return 'No se abre debajo del canal';
  if (m.includes('negativo')) return 'Valor negativo en el archivo';
  return { input1: 'Objetivo de Contraloría', input2: 'Totales por canal', base: 'Mes anterior', apertura: 'Apertura' }[p.bloque ?? '']
    ?? 'Para revisar';
};


const Grupo = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>{children}</Typography>
);

/** Un SKU repetido en el objetivo de Contraloría: el planner elige cuál fila vale, sin tocar el Excel. */
const FilaDialog = ({ repetido, onCerrar }: { repetido: Repetido; onCerrar: () => void }) => {
  const { elegirFila, ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  const [fila, setFila] = useState(repetido.elegida);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const falla = await elegirFila(repetido.sku, fila, motivo.trim());
    if (falla) setError(falla);
    else onCerrar();
  };
  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: enviar }}>
      <DialogTitle>SKU {repetido.sku}: ¿cuál fila vale?</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          El código aparece {repetido.filas.length} veces en el Excel del objetivo de Contraloría. Elegí la fila
          correcta; las demás no se usan.
        </Typography>
        <RadioGroup value={String(fila)} onChange={e => setFila(Number(e.target.value))}>
          {repetido.filas.map(f => (
            <FormControlLabel key={f.fila} value={String(f.fila)} control={<Radio size="small" />}
              label={`Fila ${f.fila} · ${f.descripcion} · ${conUnidad(f.kilos, 'kilos')} · ${conUnidad(f.nns, 'plata')}`} />
          ))}
        </RadioGroup>
        <TextField label="Motivo" required value={motivo} onChange={e => setMotivo(e.target.value)}
          helperText="Queda en el historial, con tu nombre y la hora." />
        {error && <Alerta tono="frena">{error}</Alerta>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={!motivo.trim() || ocupado || soloLectura}>Usar esta fila</Button>
      </DialogActions>
    </Dialog>
  );
};

const Pendientes = ({ estado, unidad, enMatriz }: { estado: Estado; unidad: Unidad; enMatriz: Set<string> }) => {
  // Solo a los SKUs que tienen fila en la matriz; si son muchos, el mensaje ya los nombra.
  const skus = (xs: (string | null)[]) => {
    const hay = xs.filter((x): x is string => !!x && enMatriz.has(x));
    return hay.length <= 3 ? hay.map((x): [Foco['tipo'], string] => ['sku', x]) : [];
  };
  const [eligiendo, setEligiendo] = useState<Repetido>();
  const [canalesDe, setCanalesDe] = useState<string>();
  const [categorias, setCategorias] = useState(false);
  // Los totales se corrigen en un solo lugar: el diálogo de Totales por canal. `aviso`: por qué se abrió.
  const [corrigiendo, setCorrigiendo] = useState<{ aviso?: string }>();
  const soloLectura = useSoloLectura();
  const repetido = (sku: string | null) => estado.repetidos.find(r => r.sku === sku);
  const { enfocar, elegirUnidad } = useMovil();
  const acciones = (p: Estado['problemas'][number]) => {
    const r = p.tipo === 'sku_repetido' ? repetido(p.sku) : undefined;
    const celda = p.bloque === 'apertura' && p.sku && p.canal && enMatriz.has(p.sku) ? `${p.sku} · ${p.canal}` : null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0.5 }}>
        {celda && (
          <Resolver aria-label={`Ver celda ${celda}`} onClick={() => enfocar('celda', `${p.sku}|${p.canal}`)}>
            Ver celda
          </Resolver>
        )}
        {p.tipo === 'sin_categoria' && <Resolver onClick={() => setCategorias(true)}>Asignar categorías</Resolver>}
        {r && (
          <Resolver onClick={() => setEligiendo(r)} aria-label={`Elegir fila de SKU ${r.sku}`}>Elegir fila</Resolver>
        )}
        <Ir destinos={skus([p.sku])} />
      </Box>
    );
  };
  const inconsistencias = estado.inconsistencias[unidad];
  const errores = estado.problemas.filter(p => p.severidad === 'error');
  const avisos = estado.problemas.filter(p => p.severidad !== 'error');
  // Lo de esta lista es de la unidad elegida en "Ver en": si la otra no cierra, se avisa acá para que no pase de largo.
  const otra: Unidad = unidad === 'kilos' ? 'plata' : 'kilos';
  const sinPesos = otra === 'plata' && !!estado.entradas.input2?.detalle.some(t => t.plata == null);
  // Un mismo problema (un SKU sin historia, p. ej.) suele estar en las dos unidades: el de la otra se cuenta
  // solo si no está ya en esta lista, que se resuelve con el mismo botón.
  const clave = (i: Estado['inconsistencias']['kilos'][number]) => `${i.tipo}|${(i.skus ?? []).join()}|${(i.canales ?? []).join()}`;
  const yaVistas = new Set(estado.inconsistencias[unidad].map(clave));
  const cuantasOtra = estado.inconsistencias[otra].filter(i => !yaVistas.has(clave(i))).length;
  const mismoProblema = !sinPesos && estado.inconsistencias[otra].length > 0 && cuantasOtra === 0;
  // Kilos cerrados y pesos no: se corrigen en Totales por canal, donde se recalculan según los kilos.
  const proponer = estado.cierra.kilos && !estado.cierra.plata && !estado.faltan.length && !soloLectura;
  const noVan = 'Los pesos de cada canal no van con sus kilos. Recalculalos según los kilos, al precio que tuvo cada SKU en ese canal el mes anterior.';
  const avisoPesos = proponer && (
    <Alerta tono="frena" titulo="Pesos no cierra" acciones={<>
      <Principal onClick={() => setCorrigiendo(sinPesos ? {} : { aviso: noVan })}>Corregir en Totales por canal</Principal>
      {unidad === 'kilos' && !sinPesos && <Resolver onClick={() => elegirUnidad('plata')}>Ver en pesos</Resolver>}
    </>}>
      {sinPesos ? 'Faltan los pesos de algún canal: se completan según los kilos.' : noVan}
    </Alerta>
  );
  const avisoOtra = proponer ? (unidad === 'kilos' && avisoPesos) : !estado.cierra[otra] && !estado.faltan.length && !mismoProblema && (
    <Alerta tono="frena" titulo={`${UNIDADES[otra].nombre} no cierra`} acciones={!sinPesos && (
      <Principal onClick={() => elegirUnidad(otra)}>Ver en {UNIDADES[otra].nombre.toLowerCase()}</Principal>
    )}>
      {sinPesos ? 'Faltan los pesos de algún canal en Totales por canal.'
        : cuantasOtra ? `Hay ${cuantasOtra} ${cuantasOtra === 1 ? 'cosa' : 'cosas'} para resolver en ${UNIDADES[otra].nombre.toLowerCase()}.`
          : `Mirala en ${UNIDADES[otra].nombre.toLowerCase()}.`}
    </Alerta>
  );
  const dialogoPesos = corrigiendo && (
    <TotalesDialog totales={estado.entradas.input2} sugerencia={estado.entradas.base?.canales}
      objetivo={estado.entradas.input1} aviso={corrigiendo.aviso} onCerrar={() => setCorrigiendo(undefined)} />
  );
  if (!inconsistencias.length && !estado.problemas.length && !estado.avisos[unidad].length) {
    return <>{avisoOtra || <Typography color={CIERRA}>Nada para revisar en {UNIDADES[unidad].nombre.toLowerCase()}.</Typography>}{dialogoPesos}</>;
  }
  const frenan = !!avisoOtra || (unidad === 'plata' && !!avisoPesos) || inconsistencias.length > 0;
  const hayAvisos = errores.length + avisos.length + estado.avisos[unidad].length > 0;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {dialogoPesos}
      {frenan && <Grupo>Frenan: hay que resolverlos para aprobar</Grupo>}
      {avisoOtra}
      {unidad === 'plata' && avisoPesos}
      {inconsistencias.map((i, n) => (
        <Alerta key={`i${n}`} tono="frena" titulo={TITULO_INCONSISTENCIA[i.tipo] ?? `${UNIDADES[unidad].nombre} no cierra`}
          acciones={<>
            {i.tipo === 'totales_distintos' && !soloLectura && (
              <Principal onClick={() => setCorrigiendo({})}>Corregir en Totales por canal</Principal>
            )}
            {i.tipo === 'sku_sin_canal' && i.skus[0] && (
              <Principal aria-label={`Elegir canales de SKU ${i.skus[0]}`} onClick={() => setCanalesDe(i.skus[0])}>
                Elegir canales
              </Principal>
            )}
            <Ir destinos={[...i.reglas.map((r): [Foco['tipo'], string] => ['regla', r]), ...skus(i.skus)]} />
          </>}>
          {i.mensaje}
        </Alerta>
      ))}
      {/* Lo del archivo o la apertura no bloquea: aviso, lo más grave primero. */}
      {hayAvisos && <Grupo>Avisos: no frenan, pero conviene mirarlos</Grupo>}
      {errores.map((p, n) => (
        <Alerta key={`e${n}`} tono="aviso" titulo={tituloProblema(p)} sku={p.sku} descripcion={p.descripcion}
          acciones={acciones(p)}>{p.mensaje}</Alerta>
      ))}
      {estado.avisos[unidad].map((a, n) => <Alerta key={`a${n}`} tono="aviso" titulo="Para tener en cuenta">{a}</Alerta>)}
      {avisos.map((p, n) => (
        <Alerta key={`p${n}`} tono="aviso" titulo={tituloProblema(p)} sku={p.sku} descripcion={p.descripcion}
          acciones={acciones(p)}>{p.mensaje}</Alerta>
      ))}
      {eligiendo && <FilaDialog repetido={eligiendo} onCerrar={() => setEligiendo(undefined)} />}
      {canalesDe && <CanalesDialog sku={canalesDe} estado={estado} onCerrar={() => setCanalesDe(undefined)} />}
      {categorias && <CategoriasDialog estado={estado} onCerrar={() => setCategorias(false)} />}
    </Box>
  );
};

const Seccion = ({ titulo, resumen, abierta = false, pedido, ayuda, children }: {
  titulo: string; resumen?: React.ReactNode; abierta?: boolean; pedido?: number;
  ayuda?: { titulo: string; texto: React.ReactNode }; children: React.ReactNode;
}) => {
  // Se abre sola cuando algo pide atención (faltan entradas, una regla choca, el planner
  // fue a ver algo de acá: `pedido` cambia) y nunca se cierra sola.
  const [expandida, setExpandida] = useState(abierta);
  useEffect(() => { if (abierta) setExpandida(true); }, [abierta, pedido]);
  return (
    // El ⓘ va al lado del título clickeable, no adentro (un botón dentro de otro no anda con teclado),
    // y fuera del Accordion: MUI toma a su primer hijo como título y el resto como contenido.
    <Box sx={{ position: 'relative' }}>
      <Accordion expanded={expandida} onChange={(_, v) => setExpandida(v)} disableGutters variant="outlined"
        sx={{ '&:before': { display: 'none' } }}>
        {/* Lugar para el ⓘ entre el título y la flecha (un padding en el Summary correría la flecha). */}
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}
          sx={ayuda ? { '& .MuiAccordionSummary-content': { mr: 5 } } : undefined}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 2 }}>
            <Typography fontWeight={700}>{titulo}</Typography>
            {resumen}
          </Box>
        </AccordionSummary>
        <AccordionDetails>{children}</AccordionDetails>
      </Accordion>
      {ayuda && <Box sx={{ position: 'absolute', top: 8, right: 44 }}><Ayuda ayuda={ayuda} /></Box>}
    </Box>
  );
};

const NOMBRE_ETAPA = { canal: 'por canal', apertura: 'debajo del canal' } as const;

/** En el encabezado, cuántas etapas están revisadas; al tocarlo lleva a donde se marcan, arriba de la tabla. */
const ResumenEtapas = ({ estado }: { estado: Estado }) => {
  const { enfocar } = useMovil();
  const revisadas = estado.etapas.filter(e => e.revisada).length;
  const todas = revisadas === estado.etapas.length;
  const texto = todas ? 'Etapas revisadas' : `Etapas: ${revisadas} de ${estado.etapas.length} revisadas`;
  return (
    <Tooltip describeChild title="Ir a la revisión por etapa, arriba de la tabla SKU × canal">
      <Chip size="small" variant="outlined" label={texto} onClick={() => enfocar('etapas', 'revision')}
        sx={todas ? { borderColor: CIERRA, color: CIERRA, fontWeight: 700 } : undefined} />
    </Tooltip>
  );
};

/** Un estado del móvil en el encabezado, con el mismo estilo que "Kilos: cierra". */
const ChipEstado = ({ texto }: { texto: string }) => (
  <Chip size="small" variant="outlined" label={texto} sx={{ borderColor: CIERRA, color: CIERRA, fontWeight: 700 }} />
);

const FILA_BARRA = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 2, rowGap: 1 } as const;

const mesSolo = (mes: string) => nombreMes(mes).split(' ')[0];

/** Qué hace el planner ahora, armado con lo que ya trae el estado: cada botón deshabilitado se explica acá. */
export const siguientePaso = (estado: Estado) => {
  if (!estado.es_ultimo) return 'Mes anterior, solo lectura: no se puede cambiar.';
  if (estado.aprobado) return `Aprobado. Siguiente: empezar ${mesSolo(estado.siguiente)}.`;
  if (estado.faltan.length) return `Siguiente: en Entradas, cargá lo que falta (${estado.faltan.join(', ')}).`;
  const noCierran = (['kilos', 'plata'] as const).filter(u => !estado.cierra[u]).map(u => UNIDADES[u].nombre.toLowerCase());
  if (noCierran.length) {
    return `Siguiente: resolvé lo que está en rojo en Para revisar (${noCierran.join(' y ')} no ${noCierran.length > 1 ? 'cierran' : 'cierra'}).`;
  }
  const pendiente = estado.etapas.find(e => !e.revisada);
  if (pendiente?.etapa === 'canal') return 'Siguiente: revisá la tabla SKU × canal y marcá la etapa 1 como revisada.';
  if (pendiente) return 'Siguiente: revisá cómo se abre cada canal (etapa 2) y marcala como revisada.';
  return 'Listo para aprobar.';
};

const QUE_SE_REVISA = {
  canal: 'Por canal: esta tabla, SKU por canal.',
  apertura: 'Debajo del canal: tocá una celda de un canal que se abre para ver cómo se reparte entre distribuidores o vendedores.',
} as const;

/** Las etapas en orden, arriba de la tabla, como un paso a paso: qué se revisa, el botón y por qué no se puede todavía. */
const Etapas = ({ estado, cierra, valoresOcultos }: { estado: Estado; cierra: boolean; valoresOcultos: boolean }) => {
  const { revisarEtapa, ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  return (
    <Paper variant="outlined" id="etapas-revision" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>Revisión por etapa</Typography>
        <Ayuda ayuda={AYUDA.etapas} />
      </Box>
      {estado.etapas.map(({ etapa, revisada }, n) => {
        const anteriorOk = estado.etapas.slice(0, n).every(e => e.revisada);
        const nombre = NOMBRE_ETAPA[etapa];
        const porQueNo = !cierra ? 'Se habilita cuando kilos y pesos cierran.'
          : !anteriorOk ? `Se habilita al marcar la etapa ${n}.` : null;
        return (
          <Box key={etapa} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
            <Typography variant="body2" sx={{ flex: '1 1 320px' }}>{n + 1}. {QUE_SE_REVISA[etapa]}</Typography>
            {revisada ? (
              <Chip size="small" icon={<TaskAltRoundedIcon />} variant="outlined"
                label={`Revisada por ${revisada.autor}`} sx={{ borderColor: CIERRA, color: CIERRA }} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {porQueNo && <Typography variant="caption" color="text.secondary">{porQueNo}</Typography>}
                <Button size="small" variant={porQueNo ? 'outlined' : 'contained'}
                  disabled={!!porQueNo || ocupado || soloLectura}
                  aria-label={`Marcar revisada la etapa ${nombre}`} onClick={() => revisarEtapa(etapa)}>
                  Marcar revisada
                </Button>
              </Box>
            )}
          </Box>
        );
      })}
      {valoresOcultos && (
        <Typography variant="body2" color="text.secondary">
          Los valores de la tabla aparecen cuando el cruce cierra. Mientras tanto podés apagar SKUs desde acá.
        </Typography>
      )}
    </Paper>
  );
};

/** Aprobar es una decisión de una persona: se confirma, y lo que quede para revisar se ve antes. */
const AprobarDialog = ({ estado, onCerrar }: { estado: Estado; onCerrar: () => void }) => {
  const { aprobar, ocupado } = useMovil();
  const [error, setError] = useState<string | null>(null);
  const confirmar = async () => {
    const falla = await aprobar();
    if (falla) return setError(falla);
    onCerrar();
    // Se aprueba desde la barra, casi siempre mirando la tabla: subir para que se vea el aviso y lo que sigue.
    setTimeout(() => document.getElementById('movil-arriba')?.scrollIntoView?.({ block: 'start' }));
  };
  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Aprobar el móvil</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Al aprobarlo, nadie puede cambiarlo hasta que alguien lo reabra, con motivo. Queda en el historial quién lo
          aprobó y cuándo. Después vas a poder empezar {mesSolo(estado.siguiente)} a partir de este reparto.
        </Typography>
        {estado.problemas.length > 0 && (
          <>
            <Typography variant="body2" fontWeight={700}>
              {estado.problemas.length} {estado.problemas.length === 1 ? 'cosa sigue' : 'cosas siguen'} para revisar:
            </Typography>
            <List dense>
              {estado.problemas.map((p, n) => (
                <ListItem key={n} disableGutters><ListItemText primary={conSku(p)} /></ListItem>
              ))}
            </List>
          </>
        )}
        {error && <Box sx={{ mt: 1 }}><Alerta tono="frena">{error}</Alerta></Box>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" onClick={confirmar} disabled={ocupado}>Aprobar {mesSolo(estado.mes)}</Button>
      </DialogActions>
    </Dialog>
  );
};

export const MovilPage = () => {
  const { estado, cruce, unidad, refrescar, elegirUnidad, exportar, ocupado, errorDeCarga, foco, deshacer, reabrir, meses, verMes,
    empezarSiguiente } = useMovil();
  const ultimo = meses[meses.length - 1]?.mes;
  const [confirmarExportar, setConfirmarExportar] = useState(false);
  const [confirmarAprobar, setConfirmarAprobar] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);
  const [arranco, setArranco] = useState<{ mes: string; de: string }>();
  useEffect(() => { refrescar(); }, []);
  // Llevar a la fila que se fue a ver, cuando la sección terminó de abrirse.
  useEffect(() => {
    if (!foco) return;
    const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => document.getElementById(`${foco.tipo}-${foco.id}`)
      ?.scrollIntoView?.({ block: 'center', behavior: suave ? 'smooth' : 'auto' }), 350);
    return () => clearTimeout(t);
  }, [foco]);

  if (!estado) {
    return (
      <Box sx={{ p: 3 }}>
        {errorDeCarga
          ? <Alerta tono="frena" titulo="No se pudo cargar el móvil"
              acciones={<Resolver onClick={() => refrescar()}>Reintentar</Resolver>}>
              {errorDeCarga}
            </Alerta>
          : <Dato>Cargando el móvil…</Dato>}
      </Box>
    );
  }

  const bloquean = estado.inconsistencias[unidad].length;
  const otraUnidad: Unidad = unidad === 'kilos' ? 'plata' : 'kilos';
  const otraNoCierra = !estado.cierra[otraUnidad] && !estado.faltan.length;
  const paraRevisar = estado.problemas.length + estado.avisos[unidad].length;
  // Se abre sola si algo bloquea o si hay un aviso que pide una decisión (no solo mirar).
  const decidir = !estado.aprobado && estado.es_ultimo
    && estado.problemas.some(p => p.tipo === 'sku_repetido' || p.tipo === 'sin_categoria');
  const resumen = !bloquean && !paraRevisar && !otraNoCierra ? <Dato>Nada</Dato> : (
    <>
      {bloquean > 0 && <Typography variant="body2" sx={{ color: NO_CIERRA }}>{UNIDADES[unidad].nombre} no cierra</Typography>}
      {otraNoCierra && <Typography variant="body2" sx={{ color: NO_CIERRA }}>{UNIDADES[otraUnidad].nombre} no cierra</Typography>}
      {paraRevisar > 0 && (
        <Chip size="small" color="warning" variant="outlined" label={`${paraRevisar} ${paraRevisar === 1 ? 'aviso' : 'avisos'}`} />
      )}
    </>
  );
  const cierraTodo = estado.cierra.kilos && estado.cierra.plata;
  const cargado = estado.faltan.length === 0;
  const anterior = !estado.es_ultimo;
  const puedeAprobar = cierraTodo && estado.etapas.every(e => e.revisada);
  const empezar = async () => {
    const { mes, siguiente } = estado;
    if (!(await empezarSiguiente())) setArranco({ mes: siguiente, de: mes });
  };
  const queDeshace = estado.deshacer
    && `Deshacer: ${ACCIONES[estado.deshacer.accion] ?? estado.deshacer.accion} · ${estado.deshacer.detalle}`;
  const chocan = new Set([...estado.inconsistencias.kilos, ...estado.inconsistencias.plata].flatMap(i => i.reglas)).size;
  // Lo de "Dónde se vende" y los canales cerrados también es parte de Reglas: si no se cuenta, parece que no quedó.
  const conCanales = estado.canales_sku.length;
  const cerrados = estado.aperturas_canal.filter(a => !a.abre).length;
  const resumenReglas = [
    estado.reglas.length ? `${estado.reglas.length} ${estado.reglas.length === 1 ? 'regla' : 'reglas'}` : 'Ninguna regla',
    chocan && `${chocan} ${chocan === 1 ? 'choca' : 'chocan'}`,
    conCanales && `${conCanales} ${conCanales === 1 ? 'SKU' : 'SKUs'} con canales elegidos`,
    cerrados && `${cerrados} ${cerrados === 1 ? 'canal' : 'canales'} sin abrir debajo`,
  ].filter(Boolean).join(' · ');

  return (
    <Box id="movil-arriba" sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Fijo arriba, en dos filas: qué estoy viendo · cómo está; y el paso siguiente · qué hago. */}
        <Box component="header" sx={{
          position: 'sticky', top: 0, zIndex: 5, bgcolor: '#fff', mx: -3, px: 3, py: 1.5,
          borderBottom: `1px solid ${AVENA}`, display: 'flex', flexDirection: 'column', gap: 1,
        }}>
          {ocupado && <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} aria-label="Recalculando" />}
          <Box sx={FILA_BARRA}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
              <Typography variant="h5" fontWeight={700}>Móvil</Typography>
              {/* Los demás meses se eligen en el sidebar, agrupados por año. */}
              <Typography variant="h5" color="text.secondary" sx={{ ml: 1 }}>{nombreMes(estado.mes)}</Typography>
              {/* Sin entradas no hay tabla: la unidad recién importa cuando hay algo para ver. */}
              {cargado && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1.5, mr: 0.5, whiteSpace: 'nowrap' }}>Ver en</Typography>
                  <ToggleButtonGroup
                    size="small" exclusive value={unidad} aria-label="Unidad de la matriz"
                    onChange={(_, u: Unidad | null) => u && elegirUnidad(u)}
                  >
                    {/* Cada unidad dice si cierra: así se ve cuál mirar sin tener que entrar a las dos. */}
                    {(['kilos', 'plata'] as const).map(u => (
                      <ToggleButton key={u} value={u} aria-label={`${UNIDADES[u].nombre}: ${estado.cierra[u] ? 'cierra' : 'no cierra'}`}
                        sx={{ gap: 0.75, px: 1.5, fontWeight: 600, color: estado.cierra[u] ? CIERRA : NO_CIERRA,
                          '&.Mui-selected': { color: estado.cierra[u] ? CIERRA : NO_CIERRA,
                            bgcolor: alpha(estado.cierra[u] ? CIERRA : NO_CIERRA, 0.1) } }}>
                        {estado.cierra[u] ? <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> : <ErrorRoundedIcon sx={{ fontSize: 16 }} />}
                        {UNIDADES[u].nombre}{estado.cierra[u] ? '' : ': no cierra'}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </>
              )}
            </Box>
            {cargado && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }} role="group" aria-label="Cómo está el móvil">
                {anterior ? <ChipEstado texto="Solo lectura" />
                  : estado.aprobado ? <ChipEstado texto="Aprobado" />
                    : (
                      <>
                        <ResumenEtapas estado={estado} />
                      </>
                    )}
              </Box>
            )}
          </Box>
          <Box sx={FILA_BARRA}>
            <Typography variant="body2" color="text.secondary">{siguientePaso(estado)}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', ml: 'auto' }}>
              {/* Una sola vuelta atrás: después se deshabilita hasta el próximo cambio. */}
              <Tooltip title={queDeshace ?? 'No hay un cambio para deshacer'}>
                <span>
                  <Button size="small" color="inherit" startIcon={<UndoRoundedIcon />} disabled={!queDeshace || ocupado}
                    aria-label={queDeshace ?? 'Deshacer'} onClick={() => deshacer()}>
                    Deshacer
                  </Button>
                </span>
              </Tooltip>
              {cargado && (
                <Tooltip title={cierraTodo ? 'Descarga el Excel con kilos, pesos, apertura y problemas' : 'Se puede exportar cuando kilos y pesos cierran'}>
                  <span>
                    {estado.problemas.length ? (
                      // Cierra, pero hay algo sin resolver: se exporta igual solo si una persona lo decide.
                      <Button variant="outlined" startIcon={<FileDownloadRoundedIcon />} disabled={!cierraTodo}
                        onClick={() => setConfirmarExportar(true)}>
                        Exportar
                      </Button>
                    ) : (
                      <Button variant="outlined" startIcon={<FileDownloadRoundedIcon />} onClick={() => exportar()} disabled={!cierraTodo}>
                        Exportar
                      </Button>
                    )}
                  </span>
                </Tooltip>
              )}
              {/* El botón lleno es siempre el paso siguiente: aprobar y, aprobado, empezar el mes que sigue. */}
              {anterior ? null : estado.aprobado ? (
                <>
                  <Button color="inherit" onClick={() => setReabriendo(true)} disabled={ocupado}>Reabrir</Button>
                  <Button variant="contained" endIcon={<ArrowForwardRoundedIcon />} disabled={ocupado} onClick={empezar}
                    sx={{ whiteSpace: 'nowrap' }}>
                    Empezar {mesSolo(estado.siguiente)}
                  </Button>
                </>
              ) : cargado && (
                <Tooltip title={puedeAprobar ? 'Da por bueno el móvil del mes. Después no se puede cambiar sin reabrirlo' : ''}>
                  <span>
                    <Button variant={puedeAprobar ? 'contained' : 'outlined'} startIcon={<TaskAltRoundedIcon />}
                      disabled={!puedeAprobar || ocupado} onClick={() => setConfirmarAprobar(true)}>
                      Aprobar
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>
        {anterior ? (
          <Alerta tono="info" titulo={`Estás viendo ${nombreMes(estado.mes)}`} acciones={
            <Resolver startIcon={<ArrowBackRoundedIcon />} onClick={() => verMes(undefined)}>
              Volver a {ultimo ? nombreMes(ultimo) : 'el último mes'}
            </Resolver>
          }>
            Es un mes anterior, de solo lectura.
          </Alerta>
        ) : estado.aprobado && (
          <Alerta tono="listo" titulo="Aprobado" acciones={
            <Principal endIcon={<ArrowForwardRoundedIcon />} disabled={ocupado} onClick={empezar}>
              Empezar {mesSolo(estado.siguiente)}
            </Principal>
          }>
            Aprobado por {estado.aprobado.autor} el {new Date(estado.aprobado.cuando).toLocaleString('es-AR')}. Es de
            solo lectura: para cambiarlo, reabrilo. El móvil de {nombreMes(estado.siguiente)} arranca de este reparto.
          </Alerta>
        )}
        {arranco && arranco.mes === estado.mes && (
          <Alerta tono="listo" titulo={`Arrancaste ${mesSolo(estado.mes)}`} acciones={
            <IconButton size="small" aria-label="Cerrar" onClick={() => setArranco(undefined)}><CloseRoundedIcon fontSize="small" /></IconButton>
          }>
            Arrancaste {mesSolo(estado.mes)} desde {mesSolo(arranco.de)} aprobado: se heredaron el reparto, los totales
            por canal y las reglas.{estado.faltan.length ? ` Falta: ${estado.faltan.join(', ')}.` : ''}
          </Alerta>
        )}
        {confirmarAprobar && <AprobarDialog estado={estado} onCerrar={() => setConfirmarAprobar(false)} />}
        {reabriendo && (
          <MotivoDialog
            titulo="Reabrir el móvil"
            descripcion="Vuelve a borrador y se puede cambiar de nuevo. Para que valga, hay que aprobarlo otra vez."
            confirmar="Reabrir"
            onConfirmar={reabrir}
            onCerrar={() => setReabriendo(false)}
          />
        )}
        {confirmarExportar && (
          <Dialog open onClose={() => setConfirmarExportar(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Exportar con {estado.problemas.length} {estado.problemas.length === 1 ? 'cosa' : 'cosas'} para revisar</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Kilos y pesos cierran, pero esto sigue sin resolver. En el Excel queda en la hoja Problemas.
              </Typography>
              <List dense>
                {estado.problemas.map((p, n) => (
                  <ListItem key={n} disableGutters><ListItemText primary={conSku(p)} /></ListItem>
                ))}
              </List>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirmarExportar(false)}>Cancelar</Button>
              <Button variant="contained" onClick={() => { setConfirmarExportar(false); exportar(); }}>
                Exportar igual
              </Button>
            </DialogActions>
          </Dialog>
        )}

        <Seccion key={`entradas-${estado.mes}`}
          titulo="Entradas" abierta={estado.faltan.length > 0} ayuda={AYUDA.entradas}
          resumen={<Dato>{estado.faltan.length ? `Falta: ${estado.faltan.join(', ')}` : 'Las tres cargadas'}</Dato>}
        >
          <Entradas estado={estado} />
        </Seccion>

        <Seccion titulo="Reglas" abierta={chocan > 0 || foco?.tipo === 'regla'} ayuda={AYUDA.reglas}
          pedido={foco?.tipo === 'regla' ? foco.vez : undefined} resumen={<Dato>{resumenReglas}</Dato>}>
          <Reglas estado={estado} />
        </Seccion>

        {estado.faltan.length === 0 && (
          <Seccion titulo="Para revisar" abierta={bloquean > 0 || otraNoCierra || decidir} ayuda={AYUDA.revisar} resumen={resumen}>
            <Pendientes estado={estado} unidad={unidad} enMatriz={new Set(cruce?.skus.map(x => x.codigo))} />
          </Seccion>
        )}

        {cruce && (
          <Seccion titulo={`SKU × canal en ${UNIDADES[unidad].nombre.toLowerCase()} (${UNIDADES[unidad].simbolo})`}
            abierta ayuda={AYUDA.matriz}
            pedido={foco?.tipo === 'sku' || foco?.tipo === 'celda' || foco?.tipo === 'etapas' ? foco.vez : undefined}>
            <Box sx={{ mb: 2 }}><Etapas estado={estado} cierra={cierraTodo} valoresOcultos={!cruce.cierra} /></Box>
            <Matriz cruce={cruce} />
          </Seccion>
        )}

        <Seccion titulo="Historial" ayuda={AYUDA.historial} resumen={<Dato>{estado.historial.length} {estado.historial.length === 1 ? 'cambio' : 'cambios'}</Dato>}>
          {estado.historial.length === 0
            ? <Dato>Todavía no hay cambios. Cada carga y cada ajuste aparece acá con quién, cuándo y por qué.</Dato>
            : <Historial historial={estado.historial} acciones={ACCIONES} />}
        </Seccion>
    </Box>
  );
};
