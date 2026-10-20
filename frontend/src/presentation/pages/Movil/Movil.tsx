import React, { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, IconButton, LinearProgress, Link, List, ListItem, ListItemText, Paper, Radio, RadioGroup, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useMovil, useSoloLectura } from '../../../stores/useMovil';
import { Estado, Unidad } from '../../../stores/useMovil/useMovil.type';
import { conUnidad, formatear, nombreMes, UNIDADES } from './formato';
import { AVENA, CIERRA, NO_CIERRA, numeros } from './estilo';
import { Ayuda } from './Ayuda';
import { AYUDA } from './ayudas';
import { Foco, Repetido } from '../../../stores/useMovil/useMovil.type';
import { Matriz } from './Matriz';
import { Reglas } from './Reglas';
import { CanalesDialog } from './CanalesDialog';
import { CategoriasDialog } from './CategoriasDialog';
import { MotivoDialog } from './MotivoDialog';
import { DiferenciaDialog } from './DiferenciaDialog';

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
  abrir_canal: 'Abrió un canal entre distribuidores o vendedores', cerrar_canal: 'Dejó un canal sin abrir debajo', repartir_diferencia: 'Repartió la diferencia entre los canales',
};

export const Subir = ({ cargado, etiqueta, alElegir, texto }: {
  cargado: boolean; etiqueta: string; alElegir: (f: File) => void; texto?: string;
}) => {
  const { ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  return (
    <Button component="label" variant="outlined" size="small" startIcon={<UploadFileRoundedIcon />} disabled={ocupado || soloLectura}>
      {texto ?? (cargado ? 'Reemplazar' : 'Subir Excel')}
      <input
        hidden type="file" accept=".xlsx" aria-label={etiqueta}
        onChange={e => { const f = e.target.files?.[0]; if (f) alElegir(f); e.target.value = ''; }}
      />
    </Button>
  );
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
// La misma regla que `normalizar` del backend: sin tildes, mayúsculas ni espacios de más.
const claveDeCanal = (canal: string) =>
  canal.normalize('NFKD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Los totales por canal, en la pantalla: editar los cargados (una fila por canal) o
 * armarlos sin Excel, arrancando de los kilos del mes anterior si ya se cargó.
 */
const TotalesDialog = ({ totales, sugerencia, objetivo, onCerrar }: {
  totales: Totales | null; sugerencia?: Sugerencia; objetivo: Objetivo; onCerrar: () => void;
}) => {
  const { editarTotales, ocupado } = useMovil();
  const [iniciales] = useState<Fila[]>(() => {
    if (totales) return totales.detalle.map(t => fila({ canal: t.canal, kilos: aTexto(t.kilos), plata: aTexto(t.plata) }));
    if (sugerencia?.length) return sugerencia.map(t => fila({ canal: t.canal, kilos: aTexto(t.kilos) }));
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
    const falla = await editarTotales(texto);
    if (falla) setError(falla);
    else onCerrar();
  };

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth aria-labelledby="titulo-totales"
      PaperProps={{ component: 'form', onSubmit: guardar }}>
      <DialogTitle id="titulo-totales">{totales ? 'Editar' : 'Armar'} totales por canal</DialogTitle>
      <DialogContent>
        {!totales && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {sugerencia?.length
              ? 'Arranca con los canales y los kilos que se repartieron el mes anterior, del archivo que cargaste. ' +
                'Ajustalos a este mes y completá los pesos: ese archivo no los trae.'
              : 'Una fila por canal, con sus kilos y sus pesos, como en el Excel. Si primero cargás el mes anterior, ' +
                'arranca con sus canales y sus kilos.'}
          </Typography>
        )}
        {objetivo && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Tienen que sumar lo mismo que el objetivo de Contraloría: {conUnidad(objetivo.kilos, 'kilos')} y{' '}
            {conUnidad(objetivo.nns, 'plata')}.
          </Typography>
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
                    <TableCell key={campo}>
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
        {sinPesos > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {sinPesos === conCanal.length
              ? 'Sin pesos, se reparten solo los kilos hasta que los completes.'
              : `Falta el peso de ${sinPesos} ${sinPesos === 1 ? 'canal' : 'canales'}: se toma 0 y los pesos no van a ` +
                'cerrar hasta que lo completes.'}
          </Alert>
        )}
        {sacados.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Vas a sacar {sacados.join(', ')}: al guardar deja de estar en los totales por canal.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
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
            <Subir cargado={!!input2} etiqueta="Excel de totales por canal" alElegir={cargarInput2} />
            {/* Sin Excel, se arman en la pantalla; el diálogo explica desde dónde arranca. */}
            <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => setEditar(true)} disabled={ocupado || soloLectura}
              aria-label={input2 ? 'Editar totales por canal' : 'Armar totales por canal en la pantalla'}>
              {input2 ? 'Editar' : 'Armar en pantalla'}
            </Button>
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

const conSku = (p: Estado['problemas'][number]) => (p.sku ? `SKU ${p.sku} · ${p.mensaje}` : p.mensaje);

/** "Ir a R1", "Ir al SKU 900…": de un problema al lugar donde se mira. Solo lleva: por eso va sin borde y con flecha. */
const Ir = ({ destinos }: { destinos: [Foco['tipo'], string][] }) => {
  const { enfocar } = useMovil();
  return (
    <>
      {destinos.map(([tipo, id]) => (
        <Button key={`${tipo}-${id}`} size="small" color="inherit" onClick={() => enfocar(tipo, id)}
          endIcon={<ArrowForwardRoundedIcon fontSize="small" />} sx={{ whiteSpace: 'nowrap' }}>
          {tipo === 'sku' ? `Ir al SKU ${id}` : `Ir a ${id}`}
        </Button>
      ))}
    </>
  );
};

/** Lo que resuelve el aviso: con borde, para que se distinga de "Ir a…" y del texto del aviso. */
const Resolver = (props: React.ComponentProps<typeof Button>) => (
  <Button size="small" color="inherit" variant="outlined" {...props} sx={{ whiteSpace: 'nowrap' }} />
);

const enLinea = { alignItems: 'center', '& .MuiAlert-action': { pt: 0 } };
const ACCIONES_SX = { display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0.5 } as const;

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
        {error && <Alert severity="error">{error}</Alert>}
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
  const [repartiendo, setRepartiendo] = useState(false);
  const soloLectura = useSoloLectura();
  const repetido = (sku: string | null) => estado.repetidos.find(r => r.sku === sku);
  const { enfocar } = useMovil();
  const acciones = (p: Estado['problemas'][number]) => {
    const r = p.tipo === 'sku_repetido' ? repetido(p.sku) : undefined;
    const celda = p.bloque === 'apertura' && p.sku && p.canal && enMatriz.has(p.sku) ? `${p.sku} · ${p.canal}` : null;
    return (
      <Box sx={ACCIONES_SX}>
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
  if (!inconsistencias.length && !estado.problemas.length && !estado.avisos[unidad].length) {
    return <Typography color={CIERRA}>Nada para revisar en {UNIDADES[unidad].nombre.toLowerCase()}.</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {inconsistencias.map((i, n) => (
        <Alert key={`i${n}`} severity="error" sx={enLinea}
          action={
            <Box sx={ACCIONES_SX}>
              {i.tipo === 'totales_distintos' && !soloLectura && (
                <Resolver onClick={() => setRepartiendo(true)}>Repartir la diferencia</Resolver>
              )}
              {i.tipo === 'sku_sin_canal' && i.skus[0] && (
                <Resolver aria-label={`Elegir canales de SKU ${i.skus[0]}`} onClick={() => setCanalesDe(i.skus[0])}>
                  Elegir canales
                </Resolver>
              )}
              <Ir destinos={[...i.reglas.map((r): [Foco['tipo'], string] => ['regla', r]), ...skus(i.skus)]} />
            </Box>
          }>
          {i.mensaje}
        </Alert>
      ))}
      {/* Rojo solo lo que no cierra; lo del archivo o la apertura no bloquea: amarillo, lo más grave primero. */}
      {errores.map((p, n) => <Alert key={`e${n}`} severity="warning" sx={enLinea} action={acciones(p)}>{conSku(p)}</Alert>)}
      {estado.avisos[unidad].map((a, n) => <Alert key={`a${n}`} severity="info">{a}</Alert>)}
      {avisos.map((p, n) => <Alert key={`p${n}`} severity="warning" sx={enLinea} action={acciones(p)}>{conSku(p)}</Alert>)}
      {eligiendo && <FilaDialog repetido={eligiendo} onCerrar={() => setEligiendo(undefined)} />}
      {canalesDe && <CanalesDialog sku={canalesDe} estado={estado} onCerrar={() => setCanalesDe(undefined)} />}
      {categorias && <CategoriasDialog estado={estado} onCerrar={() => setCategorias(false)} />}
      {repartiendo && <DiferenciaDialog unidad={unidad} onCerrar={() => setRepartiendo(false)} />}
    </Box>
  );
};

const ChipCierre = ({ unidad, cierra }: { unidad: Unidad; cierra: boolean }) => (
  <Chip
    size="small" variant="outlined" label={`${UNIDADES[unidad].nombre}: ${cierra ? 'cierra' : 'no cierra'}`}
    sx={{ borderColor: cierra ? CIERRA : NO_CIERRA, color: cierra ? CIERRA : NO_CIERRA, fontWeight: 700 }}
  />
);

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
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" onClick={confirmar} disabled={ocupado}>Aprobar {mesSolo(estado.mes)}</Button>
      </DialogActions>
    </Dialog>
  );
};

export const MovilPage = () => {
  const { estado, cruce, unidad, refrescar, elegirUnidad, ocupado, errorDeCarga, foco, deshacer, reabrir, meses, verMes,
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
          ? <Alert severity="error" action={<Button color="inherit" onClick={() => refrescar()}>Reintentar</Button>}>
              {errorDeCarga}
            </Alert>
          : <Dato>Cargando el móvil…</Dato>}
      </Box>
    );
  }

  const bloquean = estado.inconsistencias[unidad].length;
  const paraRevisar = estado.problemas.length + estado.avisos[unidad].length;
  // Se abre sola si algo bloquea o si hay un aviso que pide una decisión (no solo mirar).
  const decidir = !estado.aprobado && estado.es_ultimo
    && estado.problemas.some(p => p.tipo === 'sku_repetido' || p.tipo === 'sin_categoria');
  const resumen = !bloquean && !paraRevisar ? <Dato>Nada</Dato> : (
    <>
      {bloquean > 0 && <Typography variant="body2" sx={{ color: NO_CIERRA }}>{UNIDADES[unidad].nombre} no cierra</Typography>}
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
                    <ToggleButton value="kilos">{UNIDADES.kilos.nombre}</ToggleButton>
                    <ToggleButton value="plata">{UNIDADES.plata.nombre}</ToggleButton>
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
                        <ChipCierre unidad="kilos" cierra={estado.cierra.kilos} />
                        <ChipCierre unidad="plata" cierra={estado.cierra.plata} />
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
                      <Button variant="outlined" startIcon={<FileDownloadRoundedIcon />} href={`/api/movil/exportar?mes=${estado.mes}`} disabled={!cierraTodo}>
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
          <Alert severity="info" sx={{ alignItems: 'center' }} action={
            <Button variant="outlined" color="info" size="small" startIcon={<ArrowBackRoundedIcon />}
              sx={{ whiteSpace: 'nowrap' }} onClick={() => verMes(undefined)}>
              Volver a {ultimo ? nombreMes(ultimo) : 'el último mes'}
            </Button>
          }>
            Estás viendo {nombreMes(estado.mes)}, un mes anterior. Es de solo lectura.
          </Alert>
        ) : estado.aprobado && (
          <Alert severity="success" icon={<TaskAltRoundedIcon />} sx={{ alignItems: 'center' }} action={
            <Button variant="contained" color="success" size="small" endIcon={<ArrowForwardRoundedIcon />}
              sx={{ whiteSpace: 'nowrap' }} disabled={ocupado} onClick={empezar}>
              Empezar {mesSolo(estado.siguiente)}
            </Button>
          }>
            Aprobado por {estado.aprobado.autor} el {new Date(estado.aprobado.cuando).toLocaleString('es-AR')}. Es de
            solo lectura: para cambiarlo, reabrilo. El móvil de {nombreMes(estado.siguiente)} arranca de este reparto.
          </Alert>
        )}
        {arranco && arranco.mes === estado.mes && (
          <Alert severity="success" onClose={() => setArranco(undefined)}>
            Arrancaste {mesSolo(estado.mes)} desde {mesSolo(arranco.de)} aprobado: se heredaron el reparto, los totales
            por canal y las reglas.{estado.faltan.length ? ` Falta: ${estado.faltan.join(', ')}.` : ''}
          </Alert>
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
              <Button variant="contained" href={`/api/movil/exportar?mes=${estado.mes}`} onClick={() => setConfirmarExportar(false)}>
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
          <Seccion titulo="Para revisar" abierta={bloquean > 0 || decidir} ayuda={AYUDA.revisar} resumen={resumen}>
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
            : (
              <List dense sx={{ background: AVENA, borderRadius: 1 }}>
                {[...estado.historial].reverse().map((a, n) => (
                  <ListItem key={n}>
                    <ListItemText
                      primary={`${ACCIONES[a.accion] ?? a.accion}: ${a.detalle}${a.motivo ? ` — «${a.motivo}»` : ''}`}
                      secondary={`${a.autor} · ${new Date(a.cuando).toLocaleString('es-AR')}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
        </Seccion>
    </Box>
  );
};
