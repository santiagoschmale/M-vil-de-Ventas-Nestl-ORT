import React from 'react';
import { Box, Typography } from '@mui/material';
import { Ajuste } from '../../../stores/useMovil/useMovil.type';
import { CIERRA, TINTA } from './estilo';

// Qué clase de cambio es: la etiqueta de color que se ve a la izquierda de cada fila.
type Clase = { nombre: string; color: string };
const CARGA: Clase = { nombre: 'Carga', color: TINTA };
const AJUSTE: Clase = { nombre: 'Ajuste', color: '#D69E2E' };
const REVISION: Clase = { nombre: 'Revisión', color: CIERRA };
const DESHACER: Clase = { nombre: 'Deshacer', color: '#8A8580' };
const CLASE: Record<string, Clase> = {
  cargar_input1: CARGA, cargar_input2: CARGA, cargar_base: CARGA, quitar_input2: CARGA, heredar: CARGA,
  aprobar: REVISION, reabrir: REVISION, revisar_etapa: REVISION,
  deshacer: DESHACER,
};

const DIA = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const HORA = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

const nombreDelDia = (fecha: Date, hoy: Date) => {
  const dias = Math.round((new Date(hoy.toDateString()).getTime() - new Date(fecha.toDateString()).getTime()) / 864e5);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  const texto = DIA.format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** El historial como línea de tiempo: por día, lo más nuevo arriba, con quién, cuándo y por qué. */
export const Historial = ({ historial, acciones, hoy = new Date() }: {
  historial: Ajuste[]; acciones: Record<string, string>; hoy?: Date;
}) => {
  const dias: [string, Ajuste[]][] = [];
  for (const a of [...historial].reverse()) {
    const dia = nombreDelDia(new Date(a.cuando), hoy);
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo[0] === dia) ultimo[1].push(a);
    else dias.push([dia, [a]]);
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {dias.map(([dia, ajustes]) => (
        <Box key={dia} component="section" aria-label={dia}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>{dia}</Typography>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
            {ajustes.map((a, n) => {
              const clase = CLASE[a.accion] ?? AJUSTE;
              return (
                <Box key={n} sx={{
                  display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', columnGap: 1.5, rowGap: 0.25,
                  alignItems: 'baseline', px: 2, py: 1.25, borderTop: n ? 1 : 0, borderColor: 'divider',
                }}>
                  <Box component="span" sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 1,
                    bgcolor: 'action.hover', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
                    '&::before': { content: '""', width: 3, height: 12, borderRadius: 1, bgcolor: clase.color },
                  }}>
                    {clase.nombre}
                  </Box>
                  <Typography variant="body2" sx={{ minWidth: 0 }}>
                    <b>{acciones[a.accion] ?? a.accion}</b>
                    {a.detalle && <Box component="span" sx={{ color: 'text.secondary' }}> · {a.detalle}</Box>}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {HORA.format(new Date(a.cuando))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ gridColumn: 2, minWidth: 0 }}>
                    {a.motivo && <>«{a.motivo}» · </>}{a.autor}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
