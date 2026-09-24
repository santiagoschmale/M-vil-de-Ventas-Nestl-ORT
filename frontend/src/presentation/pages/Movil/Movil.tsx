import React, { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, LinearProgress, Link, List, ListItem,
  ListItemText, Paper, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useMovil } from '../../../stores/useMovil';
import { Estado, Unidad } from '../../../stores/useMovil/useMovil.type';
import { formatear, UNIDADES } from './formato';
import { AVENA, CIERRA, NO_CIERRA } from './estilo';
import { Matriz } from './Matriz';

const ACCIONES: Record<string, string> = {
  cargar_input1: 'Cargó el input 1', cargar_input2: 'Cargó el input 2', cargar_base: 'Cargó la base',
  apagar_sku: 'Apagó un SKU', prender_sku: 'Prendió un SKU',
  apagar_entidad: 'Apagó un distribuidor o vendedor', prender_entidad: 'Prendió un distribuidor o vendedor',
  fijar: 'Fijó una celda', desfijar: 'Volvió una celda a calculada',
};

const Subir = ({ cargado, etiqueta, alElegir }: { cargado: boolean; etiqueta: string; alElegir: (f: File) => void }) => {
  const { ocupado } = useMovil();
  return (
    <Button component="label" variant="outlined" size="small" startIcon={<UploadFileRoundedIcon />} disabled={ocupado}>
      {cargado ? 'Reemplazar' : 'Subir'}
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

const Tarjeta = ({ titulo, ayuda, children }: { titulo: string; ayuda: string; children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box>
      <Typography fontWeight={700}>{titulo}</Typography>
      <Dato>{ayuda}</Dato>
    </Box>
    {children}
  </Paper>
);

const Entradas = ({ estado }: { estado: Estado }) => {
  const { cargarInput1, cargarInput2, cargarBase, cargarMuestra, ocupado } = useMovil();
  const { input1, input2, base } = estado.entradas;
  const [texto, setTexto] = useState(input2?.texto ?? '');
  useEffect(() => { setTexto(input2?.texto ?? ''); }, [input2?.texto]);

  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
        <Tarjeta titulo="Input 1 · Contraloría" ayuda="Excel con el objetivo por SKU, en kilos y pesos.">
          <Box><Subir cargado={!!input1} etiqueta="Excel del input 1" alElegir={cargarInput1} /></Box>
          {input1 && (
            <Box>
              <Dato>{input1.archivo}</Dato>
              <Dato>{input1.skus} SKUs · {formatear(input1.kilos)} kg · $ {formatear(input1.nns)}</Dato>
            </Box>
          )}
        </Tarjeta>

        <Tarjeta titulo="Input 2 · Totales por canal" ayuda="Copiá la tabla de Excel (canal, kilos, pesos) y pegala acá.">
          <TextField
            multiline minRows={4} maxRows={10} fullWidth size="small" value={texto}
            onChange={e => setTexto(e.target.value)} placeholder={'Canal\tKilos\tPesos\nCatering\t12.500\t$ 3.400.000'}
            inputProps={{ 'aria-label': 'Tabla del input 2', style: { fontFamily: 'ui-monospace, monospace', fontSize: 12 } }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Button size="small" variant="outlined" disabled={ocupado || !texto.trim() || texto === input2?.texto}
              onClick={() => cargarInput2(texto)}>
              Cargar tabla
            </Button>
            {input2 && <Dato>{input2.canales} canales · {formatear(input2.kilos)} kg · $ {formatear(input2.plata)}</Dato>}
          </Box>
        </Tarjeta>

        <Tarjeta titulo="Base · Mes anterior" ayuda="Excel con el reparto SKU × canal y su apertura.">
          <Box><Subir cargado={!!base} etiqueta="Excel de la base" alElegir={cargarBase} /></Box>
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
          <Link component="button" variant="body2" disabled={ocupado} onClick={() => cargarMuestra()}>
            Cargar datos de muestra (solo en desarrollo)
          </Link>
        </Box>
      )}
    </>
  );
};

const conSku = (p: Estado['problemas'][number]) => (p.sku ? `SKU ${p.sku} · ${p.mensaje}` : p.mensaje);

const Pendientes = ({ estado, unidad }: { estado: Estado; unidad: Unidad }) => {
  const inconsistencias = estado.inconsistencias[unidad];
  const errores = estado.problemas.filter(p => p.severidad === 'error');
  const avisos = estado.problemas.filter(p => p.severidad !== 'error');
  if (!inconsistencias.length && !estado.problemas.length && !estado.avisos[unidad].length) {
    return <Typography color={CIERRA}>Nada para revisar en {UNIDADES[unidad].nombre.toLowerCase()}.</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {inconsistencias.map((i, n) => <Alert key={`i${n}`} severity="error">{i.mensaje}</Alert>)}
      {errores.map((p, n) => <Alert key={`e${n}`} severity="error">{conSku(p)}</Alert>)}
      {estado.avisos[unidad].map((a, n) => <Alert key={`a${n}`} severity="info">{a}</Alert>)}
      {avisos.map((p, n) => <Alert key={`p${n}`} severity="warning">{conSku(p)}</Alert>)}
    </Box>
  );
};

const ChipCierre = ({ unidad, cierra }: { unidad: Unidad; cierra: boolean }) => (
  <Chip
    size="small" variant="outlined" label={`${UNIDADES[unidad].nombre}: ${cierra ? 'cierra' : 'no cierra'}`}
    sx={{ borderColor: cierra ? CIERRA : NO_CIERRA, color: cierra ? CIERRA : NO_CIERRA, fontWeight: 700 }}
  />
);

const Seccion = ({ titulo, resumen, abierta, children }:
  { titulo: string; resumen?: React.ReactNode; abierta?: boolean; children: React.ReactNode }) => (
  // key: si cambia si debería estar abierta (p. ej. se cargaron las entradas), vuelve a su posición inicial.
  <Accordion key={String(abierta)} defaultExpanded={abierta} disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}>
    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 2 }}>
        <Typography fontWeight={700}>{titulo}</Typography>
        {resumen}
      </Box>
    </AccordionSummary>
    <AccordionDetails>{children}</AccordionDetails>
  </Accordion>
);

export const MovilPage = () => {
  const { estado, cruce, unidad, refrescar, elegirUnidad, ocupado, errorDeCarga } = useMovil();
  useEffect(() => { refrescar(); }, []);

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
  const errores = estado.problemas.filter(p => p.severidad === 'error').length;
  const avisos = estado.problemas.length - errores + estado.avisos[unidad].length;
  const resumen = [
    bloquean && `${UNIDADES[unidad].nombre} no cierra`,
    errores && `${errores} ${errores === 1 ? 'error' : 'errores'} en los datos`,
    avisos && `${avisos} ${avisos === 1 ? 'aviso' : 'avisos'}`,
  ].filter(Boolean).join(' · ') || 'Nada';
  const cierraTodo = estado.cierra.kilos && estado.cierra.plata;

  return (
    <Box sx={{ position: 'relative' }}>
      {ocupado && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} aria-label="Recalculando" />}
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ mr: 'auto' }}>
            <Typography variant="h5" fontWeight={700}>Móvil</Typography>
            <Dato>Reparto del objetivo del mes por SKU y canal.</Dato>
          </Box>
          {estado.faltan.length === 0 && (
            <>
              <ChipCierre unidad="kilos" cierra={estado.cierra.kilos} />
              <ChipCierre unidad="plata" cierra={estado.cierra.plata} />
            </>
          )}
          <ToggleButtonGroup
            size="small" exclusive value={unidad} aria-label="Unidad de la matriz"
            onChange={(_, u: Unidad | null) => u && elegirUnidad(u)}
          >
            <ToggleButton value="kilos">{UNIDADES.kilos.nombre}</ToggleButton>
            <ToggleButton value="plata">{UNIDADES.plata.nombre}</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title={cierraTodo ? 'Descarga el Excel con kilos, pesos, apertura y problemas' : 'Se puede exportar cuando kilos y pesos cierran'}>
            <span>
              <Button variant="contained" startIcon={<FileDownloadRoundedIcon />} href="/api/movil/exportar" disabled={!cierraTodo}>
                Exportar
              </Button>
            </span>
          </Tooltip>
        </Box>

        <Seccion
          titulo="Entradas" abierta={estado.faltan.length > 0}
          resumen={<Dato>{estado.faltan.length ? `Falta: ${estado.faltan.join(', ')}` : 'Las tres cargadas'}</Dato>}
        >
          <Entradas estado={estado} />
        </Seccion>

        {estado.faltan.length === 0 && (
          <Seccion titulo="Para revisar" abierta={bloquean > 0} resumen={<Dato>{resumen}</Dato>}>
            <Pendientes estado={estado} unidad={unidad} />
          </Seccion>
        )}

        {cruce && (
          <Seccion titulo={`SKU × canal en ${UNIDADES[unidad].nombre.toLowerCase()}`} abierta>
            <Matriz cruce={cruce} />
          </Seccion>
        )}

        <Seccion titulo="Historial" resumen={<Dato>{estado.historial.length} {estado.historial.length === 1 ? 'cambio' : 'cambios'}</Dato>}>
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
    </Box>
  );
};
