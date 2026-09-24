import React, { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Link, List, ListItem, ListItemText,
  Paper, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useMovil } from '../../../stores/useMovil';
import { Estado, Unidad } from '../../../stores/useMovil/useMovil.type';
import { formatear } from './formato';
import { AVENA, CIERRA, NO_CIERRA } from './estilo';
import { Matriz } from './Matriz';

const Subir = ({ etiqueta, alElegir }: { etiqueta: string; alElegir: (f: File) => void }) => {
  const { ocupado } = useMovil();
  return (
    <Button component="label" variant="outlined" size="small" startIcon={<UploadFileRoundedIcon />} disabled={ocupado}>
      {etiqueta}
      <input
        hidden type="file" accept=".xlsx"
        onChange={e => { const f = e.target.files?.[0]; if (f) alElegir(f); e.target.value = ''; }}
      />
    </Button>
  );
};

const Dato = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{children}</Typography>
);

const Entradas = ({ estado }: { estado: Estado }) => {
  const { cargarInput1, cargarInput2, cargarBase, ocupado } = useMovil();
  const { input1, input2, base } = estado.entradas;
  const [texto, setTexto] = useState(input2?.texto ?? '');
  useEffect(() => { setTexto(input2?.texto ?? ''); }, [input2?.texto]);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr 1fr' }, gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography fontWeight={700}>Input 1 · Contraloría</Typography>
        <Dato>Objetivo por SKU en kilos y NNS.</Dato>
        <Box sx={{ my: 1.5 }}><Subir etiqueta={input1 ? 'Reemplazar Excel' : 'Subir Excel'} alElegir={cargarInput1} /></Box>
        {input1 && (
          <>
            <Dato>{input1.archivo} · {input1.skus} SKUs</Dato>
            <Dato>{formatear(input1.kilos)} kg · $ {formatear(input1.nns)}</Dato>
          </>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography fontWeight={700}>Input 2 · Totales por canal</Typography>
        <Dato>Pegá la tabla desde Excel: canal, kilos y plata.</Dato>
        <TextField
          multiline minRows={4} maxRows={10} fullWidth size="small" value={texto}
          onChange={e => setTexto(e.target.value)} placeholder={'Canal\tKilos\tPlata\nCatering\t12.500\t$ 3.400.000'}
          inputProps={{ 'aria-label': 'Tabla del input 2', style: { fontFamily: 'ui-monospace, monospace', fontSize: 12 } }}
          sx={{ my: 1.5 }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button size="small" variant="outlined" disabled={ocupado || !texto.trim() || texto === input2?.texto}
            onClick={() => cargarInput2(texto)}>
            Cargar input 2
          </Button>
          {input2 && <Dato>{input2.canales} canales · {formatear(input2.kilos)} kg · $ {formatear(input2.plata)}</Dato>}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography fontWeight={700}>Base · Mes anterior</Typography>
        <Dato>Reparto SKU × canal y su apertura.</Dato>
        <Box sx={{ my: 1.5 }}><Subir etiqueta={base ? 'Reemplazar Excel' : 'Subir Excel'} alElegir={cargarBase} /></Box>
        {base && <Dato>{base.archivo} · {base.celdas} celdas · {base.aperturas} aperturas</Dato>}
      </Paper>
    </Box>
  );
};

const conSku = (p: Estado['problemas'][number]) => (p.sku ? `SKU ${p.sku} · ${p.mensaje}` : p.mensaje);

const Pendientes = ({ estado, unidad }: { estado: Estado; unidad: Unidad }) => {
  const inconsistencias = estado.inconsistencias[unidad];
  const errores = estado.problemas.filter(p => p.severidad === 'error');
  const avisos = estado.problemas.filter(p => p.severidad !== 'error');
  if (!inconsistencias.length && !estado.problemas.length && !estado.avisos[unidad].length) {
    return <Typography color={CIERRA}>Nada pendiente en {unidad}.</Typography>;
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

const ChipCierre = ({ unidad, cierra }: { unidad: string; cierra: boolean }) => (
  <Chip
    size="small" variant="outlined" label={`${unidad}: ${cierra ? 'cierra' : 'no cierra'}`}
    sx={{ borderColor: cierra ? CIERRA : NO_CIERRA, color: cierra ? CIERRA : NO_CIERRA, fontWeight: 700 }}
  />
);

const Seccion = ({ titulo, resumen, abierta, children }:
  { titulo: string; resumen?: React.ReactNode; abierta?: boolean; children: React.ReactNode }) => (
  // key: si cambia si debería estar abierta (p. ej. se cargaron las entradas), vuelve a su posición inicial.
  <Accordion key={String(abierta)} defaultExpanded={abierta} disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}>
    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
      <Typography fontWeight={700} sx={{ mr: 2 }}>{titulo}</Typography>
      {resumen}
    </AccordionSummary>
    <AccordionDetails>{children}</AccordionDetails>
  </Accordion>
);

export const MovilPage = () => {
  const { estado, cruce, unidad, refrescar, elegirUnidad, cargarMuestra, ocupado } = useMovil();
  useEffect(() => { refrescar(); }, []);

  if (!estado) return <Box sx={{ p: 3 }}><Dato>Cargando el móvil…</Dato></Box>;

  const bloquean = estado.inconsistencias[unidad].length;
  const errores = estado.problemas.filter(p => p.severidad === 'error').length;
  const avisos = estado.problemas.length - errores + estado.avisos[unidad].length;
  const resumen = [
    bloquean && `${unidad} no cierra`, errores && `${errores} errores en los datos`, avisos && `${avisos} avisos`,
  ].filter(Boolean).join(' · ') || 'Nada';

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mr: 'auto' }}>Móvil del mes</Typography>
        <ChipCierre unidad="Kilos" cierra={estado.cierra.kilos} />
        <ChipCierre unidad="Plata" cierra={estado.cierra.plata} />
        <ToggleButtonGroup
          size="small" exclusive value={unidad} aria-label="Unidad de la matriz"
          onChange={(_, u: Unidad | null) => u && elegirUnidad(u)}
        >
          <ToggleButton value="kilos">Kilos</ToggleButton>
          <ToggleButton value="plata">Plata</ToggleButton>
        </ToggleButtonGroup>
        <Button
          variant="contained" startIcon={<FileDownloadRoundedIcon />} href="/api/movil/exportar"
          disabled={estado.faltan.length > 0}
        >
          Exportar Excel
        </Button>
      </Box>

      <Seccion
        titulo="Entradas" abierta={estado.faltan.length > 0}
        resumen={<Dato>{estado.faltan.length ? `Falta: ${estado.faltan.join(', ')}` : 'Las tres cargadas'}</Dato>}
      >
        <Entradas estado={estado} />
        <Box sx={{ mt: 1.5 }}>
          <Link component="button" variant="body2" disabled={ocupado} onClick={() => cargarMuestra()}>
            Cargar datos de muestra
          </Link>
        </Box>
      </Seccion>

      {estado.faltan.length === 0 && (
        <Seccion
          titulo="Para revisar" abierta={bloquean > 0}
          resumen={<Dato>{resumen}</Dato>}
        >
          <Pendientes estado={estado} unidad={unidad} />
        </Seccion>
      )}

      {cruce && (
        <Seccion titulo={`Matriz SKU × canal en ${unidad}`} abierta>
          <Matriz cruce={cruce} />
        </Seccion>
      )}

      <Seccion titulo="Historial" resumen={<Dato>{estado.historial.length} cambios</Dato>}>
        <List dense sx={{ background: AVENA, borderRadius: 1 }}>
          {[...estado.historial].reverse().map((a, n) => (
            <ListItem key={n}>
              <ListItemText
                primary={`${a.detalle}${a.motivo ? ` — «${a.motivo}»` : ''}`}
                secondary={`${a.accion} · ${a.autor} · ${new Date(a.cuando).toLocaleString('es-AR')}`}
              />
            </ListItem>
          ))}
        </List>
      </Seccion>
    </Box>
  );
};
