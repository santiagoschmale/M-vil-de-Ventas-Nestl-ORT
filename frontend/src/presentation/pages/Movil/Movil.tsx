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
import { useMovil, useSoloLectura } from '../../../stores/useMovil';
import { Estado, Unidad } from '../../../stores/useMovil/useMovil.type';
import { conUnidad, formatear, UNIDADES } from './formato';
import { AVENA, CIERRA, NO_CIERRA, numeros } from './estilo';
import { Ayuda } from './Ayuda';
import { AYUDA } from './ayudas';
import { Foco, Repetido } from '../../../stores/useMovil/useMovil.type';
import { Matriz } from './Matriz';
import { Reglas } from './Reglas';
import { CanalesDialog } from './CanalesDialog';
import { MotivoDialog } from './MotivoDialog';

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
  porcentaje: 'Cambió la base de cálculo',
  agregar_entidad: 'Agregó un distribuidor o vendedor', eliminar_entidad: 'Eliminó un distribuidor o vendedor',
};

const Subir = ({ cargado, etiqueta, alElegir }: { cargado: boolean; etiqueta: string; alElegir: (f: File) => void }) => {
  const { ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  return (
    <Button component="label" variant="outlined" size="small" startIcon={<UploadFileRoundedIcon />} disabled={ocupado || soloLectura}>
      {cargado ? 'Reemplazar' : 'Subir Excel'}
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
type Fila = { id: number; canal: string; kilos: string; plata: string; nueva: boolean };

let proximaFila = 0;
const fila = (canal = '', kilos = '', plata = '', nueva = false): Fila => ({ id: proximaFila++, canal, kilos, plata, nueva });

/**
 * Los totales por canal, en la pantalla: editar los cargados (una fila por canal) o
 * armarlos sin Excel, arrancando de los kilos del mes anterior si ya se cargó.
 */
const TotalesDialog = ({ totales, sugerencia, objetivo, onCerrar }: {
  totales?: Totales; sugerencia?: Sugerencia; objetivo: Objetivo; onCerrar: () => void;
}) => {
  const { editarTotales, ocupado } = useMovil();
  // Lo cargado, para mostrar "antes: …" en lo que se cambie (se compara texto: el front no calcula).
  const [originales] = useState(() => new Map((totales?.detalle ?? []).map(t => [
    t.canal, { kilos: formatear(t.kilos), plata: t.plata == null ? '' : formatear(t.plata) },
  ])));
  const [filas, setFilas] = useState<Fila[]>(() => {
    if (totales) return totales.detalle.map(t => fila(t.canal, formatear(t.kilos), t.plata == null ? '' : formatear(t.plata)));
    if (sugerencia?.length) return sugerencia.map(t => fila(t.canal, formatear(t.kilos)));
    return [fila('', '', '', true)];
  });
  const antes = (f: Fila, campo: 'kilos' | 'plata') => {
    const original = originales.get(f.canal);
    return original && f[campo].trim() !== original[campo] ? `antes: ${original[campo] || 'vacío'}` : undefined;
  };
  const [error, setError] = useState<string | null>(null);
  const cambiar = (id: number, campo: 'canal' | 'kilos' | 'plata', valor: string) => {
    setFilas(fs => fs.map(f => (f.id === id ? { ...f, [campo]: valor } : f)));
    setError(null);
  };
  const nombre = (f: Fila, i: number) => f.canal.trim() || `canal ${i + 1}`;

  // Lo que va a pasar al guardar, dicho antes: el backend lo acepta, pero conviene saberlo.
  const completas = filas.filter(f => f.canal.trim() || f.kilos.trim() || f.plata.trim());
  const sinPesos = completas.filter(f => !f.plata.trim()).length;
  const sacados = [...originales.keys()].filter(c => !filas.some(f => f.canal === c));
  const clave = (canal: string) => canal.trim().toLowerCase();
  const repetido = (f: Fila) => !!f.canal.trim() && filas.some(x => x.id !== f.id && clave(x.canal) === clave(f.canal));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    // La misma tabla que lee el backend, con los números como se escriben acá (1.234,5).
    const texto = ['Canal\tKilos\tPlata', ...completas.map(f => `${f.canal.trim()}\t${f.kilos.trim()}\t${f.plata.trim()}`)]
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
                        error={repetido(f)} helperText={repetido(f) ? 'Ya está en la tabla' : undefined}
                        inputProps={{ 'aria-label': `Canal ${i + 1}` }} />
                    : f.canal}
                </TableCell>
                <TableCell>
                  <TextField size="small" value={f.kilos} onChange={e => cambiar(f.id, 'kilos', e.target.value)}
                    helperText={antes(f, 'kilos')} color={antes(f, 'kilos') ? 'warning' : undefined} focused={!!antes(f, 'kilos') || undefined}
                    inputProps={{ 'aria-label': `Kilos de ${nombre(f, i)}`, inputMode: 'decimal', style: numeros }} />
                </TableCell>
                <TableCell>
                  <TextField size="small" value={f.plata} onChange={e => cambiar(f.id, 'plata', e.target.value)}
                    helperText={antes(f, 'plata')} color={antes(f, 'plata') ? 'warning' : undefined} focused={!!antes(f, 'plata') || undefined}
                    inputProps={{ 'aria-label': `Pesos de ${nombre(f, i)}`, inputMode: 'decimal', style: numeros }} />
                </TableCell>
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
          onClick={() => setFilas(fs => [...fs, fila('', '', '', true)])}>
          Agregar canal
        </Button>
        {sinPesos > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Falta el peso de {sinPesos} {sinPesos === 1 ? 'canal' : 'canales'}: se toma 0 y los pesos no van a cerrar
            hasta que lo completes.
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
        <Button type="submit" variant="contained" disabled={ocupado || !completas.length || filas.some(repetido)}>
          Guardar
        </Button>
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
            {input2 ? (
              <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => setEditar(true)} disabled={ocupado || soloLectura}
                aria-label="Editar totales por canal">
                Editar
              </Button>
            ) : (
              <Tooltip title={base ? 'Arranca con los canales y los kilos del mes anterior' : 'Una fila por canal, sin Excel'}>
                <span>
                  <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => setEditar(true)}
                    disabled={ocupado || soloLectura} aria-label="Armar totales por canal en la pantalla">
                    Armar en pantalla
                  </Button>
                </span>
              </Tooltip>
            )}
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
        </Box>
      )}
      {editar && (
        <TotalesDialog totales={input2 ?? undefined} sugerencia={base?.canales} objetivo={input1}
          onCerrar={() => setEditar(false)} />
      )}
    </>
  );
};

const conSku = (p: Estado['problemas'][number]) => (p.sku ? `SKU ${p.sku} · ${p.mensaje}` : p.mensaje);

/** "Ver R1", "Ver SKU 900…": de un problema al lugar donde se arregla. */
const Ir = ({ destinos }: { destinos: [Foco['tipo'], string][] }) => {
  const { enfocar } = useMovil();
  if (!destinos.length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {destinos.map(([tipo, id]) => (
        <Button key={`${tipo}-${id}`} size="small" color="inherit" onClick={() => enfocar(tipo, id)}
          sx={{ whiteSpace: 'nowrap' }}>
          Ver {tipo === 'sku' ? `SKU ${id}` : id}
        </Button>
      ))}
    </Box>
  );
};

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
  const repetido = (sku: string | null) => estado.repetidos.find(r => r.sku === sku);
  const { enfocar } = useMovil();
  const acciones = (p: Estado['problemas'][number]) => {
    const r = p.tipo === 'sku_repetido' ? repetido(p.sku) : undefined;
    const celda = p.bloque === 'apertura' && p.sku && p.canal && enMatriz.has(p.sku) ? `${p.sku} · ${p.canal}` : null;
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {celda && (
          <Button size="small" color="inherit" sx={{ whiteSpace: 'nowrap' }} aria-label={`Ver celda ${celda}`}
            onClick={() => enfocar('celda', `${p.sku}|${p.canal}`)}>
            Ver celda
          </Button>
        )}
        {r && (
          <Button size="small" color="inherit" sx={{ whiteSpace: 'nowrap' }} onClick={() => setEligiendo(r)}
            aria-label={`Elegir fila de SKU ${r.sku}`}>
            Elegir fila
          </Button>
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
        <Alert key={`i${n}`} severity="error"
          action={
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {i.tipo === 'sku_sin_canal' && i.skus[0] && (
                <Button size="small" color="inherit" sx={{ whiteSpace: 'nowrap' }}
                  aria-label={`Elegir canales de SKU ${i.skus[0]}`} onClick={() => setCanalesDe(i.skus[0])}>
                  Elegir canales
                </Button>
              )}
              <Ir destinos={[...i.reglas.map((r): [Foco['tipo'], string] => ['regla', r]), ...skus(i.skus)]} />
            </Box>
          }>
          {i.mensaje}
        </Alert>
      ))}
      {/* Rojo solo lo que no cierra; lo del archivo o la apertura no bloquea: amarillo, lo más grave primero. */}
      {errores.map((p, n) => <Alert key={`e${n}`} severity="warning" action={acciones(p)}>{conSku(p)}</Alert>)}
      {estado.avisos[unidad].map((a, n) => <Alert key={`a${n}`} severity="info">{a}</Alert>)}
      {avisos.map((p, n) => <Alert key={`p${n}`} severity="warning" action={acciones(p)}>{conSku(p)}</Alert>)}
      {eligiendo && <FilaDialog repetido={eligiendo} onCerrar={() => setEligiendo(undefined)} />}
      {canalesDe && <CanalesDialog sku={canalesDe} estado={estado} onCerrar={() => setCanalesDe(undefined)} />}
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

/** Las etapas en orden: cada una se da por revisada después de la anterior. */
const Etapas = ({ estado, cierra }: { estado: Estado; cierra: boolean }) => {
  const { revisarEtapa, ocupado } = useMovil();
  const soloLectura = useSoloLectura();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>Revisión por etapa</Typography>
        <Ayuda ayuda={AYUDA.etapas} />
      </Box>
      {estado.etapas.map(({ etapa, revisada }, n) => {
        const anteriorOk = estado.etapas.slice(0, n).every(e => e.revisada);
        const nombre = NOMBRE_ETAPA[etapa];
        return revisada ? (
          <Chip key={etapa} size="small" icon={<TaskAltRoundedIcon />} variant="outlined"
            label={`${n + 1} · ${nombre}: revisada por ${revisada.autor}`} sx={{ borderColor: CIERRA, color: CIERRA }} />
        ) : (
          <Tooltip key={etapa} title={!cierra ? 'Se revisa cuando kilos y pesos cierran'
            : !anteriorOk ? 'Primero revisá la etapa anterior: esta sale de ahí' : ''}>
            <span>
              <Button size="small" variant="outlined" disabled={!cierra || !anteriorOk || ocupado || soloLectura}
                aria-label={`Marcar revisada la etapa ${nombre}`} onClick={() => revisarEtapa(etapa)}>
                {n + 1} · {nombre}: marcar revisada
              </Button>
            </span>
          </Tooltip>
        );
      })}
    </Box>
  );
};

/** Aprobar es una decisión de una persona: se confirma, y lo que quede para revisar se ve antes. */
const AprobarDialog = ({ estado, onCerrar }: { estado: Estado; onCerrar: () => void }) => {
  const { aprobar, ocupado } = useMovil();
  const [error, setError] = useState<string | null>(null);
  const confirmar = async () => {
    const falla = await aprobar();
    if (falla) setError(falla);
    else onCerrar();
  };
  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Aprobar el móvil</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Al aprobarlo, nadie puede cambiarlo hasta que alguien lo reabra, con motivo. Queda en el historial quién lo
          aprobó y cuándo.
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
        <Button variant="contained" onClick={confirmar} disabled={ocupado}>Aprobar</Button>
      </DialogActions>
    </Dialog>
  );
};

export const MovilPage = () => {
  const { estado, cruce, unidad, refrescar, elegirUnidad, ocupado, errorDeCarga, foco, deshacer, reabrir } = useMovil();
  const [confirmarExportar, setConfirmarExportar] = useState(false);
  const [confirmarAprobar, setConfirmarAprobar] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);
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
  const resumen = [
    bloquean && `${UNIDADES[unidad].nombre} no cierra`,
    paraRevisar && `${paraRevisar} para revisar`,
  ].filter(Boolean).join(' · ') || 'Nada';
  const cierraTodo = estado.cierra.kilos && estado.cierra.plata;
  const sinRevisar = estado.etapas.filter(e => !e.revisada).map(e => NOMBRE_ETAPA[e.etapa]);
  const queDeshace = estado.deshacer
    && `Deshacer: ${ACCIONES[estado.deshacer.accion] ?? estado.deshacer.accion} · ${estado.deshacer.detalle}`;
  const chocan = new Set([...estado.inconsistencias.kilos, ...estado.inconsistencias.plata].flatMap(i => i.reglas)).size;
  const resumenReglas = estado.reglas.length
    ? `${estado.reglas.length} ${estado.reglas.length === 1 ? 'regla' : 'reglas'}${chocan ? ` · ${chocan} ${chocan === 1 ? 'choca' : 'chocan'}` : ''}`
    : 'Ninguna';

  return (
    <Box sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Fijo arriba: si cierra, en qué unidad se mira y la salida, siempre a la vista. */}
        <Box component="header" sx={{
          position: 'sticky', top: 0, zIndex: 5, bgcolor: '#fff', mx: -3, px: 3, py: 1.5,
          borderBottom: `1px solid ${AVENA}`, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5,
        }}>
          {ocupado && <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} aria-label="Recalculando" />}
          <Box sx={{ mr: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h5" fontWeight={700}>Móvil</Typography>
            <Ayuda ayuda={AYUDA.movil} />
          </Box>
          {estado.faltan.length === 0 && (
            <>
              <ChipCierre unidad="kilos" cierra={estado.cierra.kilos} />
              <ChipCierre unidad="plata" cierra={estado.cierra.plata} />
            </>
          )}
          {/* Una sola vuelta atrás: después se deshabilita hasta el próximo cambio. */}
          <Tooltip title={queDeshace ?? 'No hay un cambio para deshacer'}>
            <span>
              <Button size="small" color="inherit" startIcon={<UndoRoundedIcon />} disabled={!queDeshace || ocupado}
                aria-label={queDeshace ?? 'Deshacer'} onClick={() => deshacer()}>
                Deshacer
              </Button>
            </span>
          </Tooltip>
          <ToggleButtonGroup
            size="small" exclusive value={unidad} aria-label="Unidad de la matriz"
            onChange={(_, u: Unidad | null) => u && elegirUnidad(u)}
          >
            <ToggleButton value="kilos">{UNIDADES.kilos.nombre}</ToggleButton>
            <ToggleButton value="plata">{UNIDADES.plata.nombre}</ToggleButton>
          </ToggleButtonGroup>
          {estado.aprobado ? (
            <Button size="small" color="inherit" onClick={() => setReabriendo(true)} disabled={ocupado}>Reabrir</Button>
          ) : (
            <Tooltip title={!cierraTodo ? 'Se puede aprobar cuando kilos y pesos cierran'
              : sinRevisar.length ? `Falta revisar la etapa ${sinRevisar.join(' y la ')}`
                : 'Da por bueno el móvil del mes. Después no se puede cambiar sin reabrirlo'}>
              <span>
                <Button variant="outlined" startIcon={<TaskAltRoundedIcon />} disabled={!cierraTodo || sinRevisar.length > 0 || ocupado}
                  onClick={() => setConfirmarAprobar(true)}>
                  Aprobar
                </Button>
              </span>
            </Tooltip>
          )}
          <Tooltip title={cierraTodo ? 'Descarga el Excel con kilos, pesos, apertura y problemas' : 'Se puede exportar cuando kilos y pesos cierran'}>
            <span>
              {estado.problemas.length ? (
                // Cierra, pero hay algo sin resolver: se exporta igual solo si una persona lo decide.
                <Button variant="contained" startIcon={<FileDownloadRoundedIcon />} disabled={!cierraTodo}
                  onClick={() => setConfirmarExportar(true)}>
                  Exportar
                </Button>
              ) : (
                <Button variant="contained" startIcon={<FileDownloadRoundedIcon />} href="/api/movil/exportar" disabled={!cierraTodo}>
                  Exportar
                </Button>
              )}
            </span>
          </Tooltip>
        </Box>
        {estado.faltan.length === 0 && <Etapas estado={estado} cierra={cierraTodo} />}
        {estado.aprobado && (
          <Alert severity="success" icon={<TaskAltRoundedIcon />}>
            Aprobado por {estado.aprobado.autor} el {new Date(estado.aprobado.cuando).toLocaleString('es-AR')}. Es de
            solo lectura: para cambiarlo, reabrilo.
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
              <Button variant="contained" href="/api/movil/exportar" onClick={() => setConfirmarExportar(false)}>
                Exportar igual
              </Button>
            </DialogActions>
          </Dialog>
        )}

        <Seccion
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
          <Seccion titulo="Para revisar" abierta={bloquean > 0} ayuda={AYUDA.revisar} resumen={<Dato>{resumen}</Dato>}>
            <Pendientes estado={estado} unidad={unidad} enMatriz={new Set(cruce?.skus.map(x => x.codigo))} />
          </Seccion>
        )}

        {cruce && (
          <Seccion titulo={`SKU × canal en ${UNIDADES[unidad].nombre.toLowerCase()} (${UNIDADES[unidad].simbolo})`}
            abierta ayuda={AYUDA.matriz}
            pedido={foco?.tipo === 'sku' || foco?.tipo === 'celda' ? foco.vez : undefined}>
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
