import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { CIERRA, NO_CIERRA } from './estilo';

const AMBAR = '#D69E2E';

/** frena: hay que resolverlo; aviso: conviene mirarlo; info: dónde estás; listo: salió bien. */
export type Tono = 'frena' | 'aviso' | 'info' | 'listo';
const BORDE: Record<Tono, string> = { frena: NO_CIERRA, aviso: AMBAR, info: 'primary.main', listo: CIERRA };

/** Lo que resuelve el aviso: con borde (el tema le da la tinta), para que se distinga de "Ir a…" y del texto. */
export const Resolver = (props: React.ComponentProps<typeof Button>) => (
  <Button size="small" variant="outlined" color="primary" {...props} sx={{ whiteSpace: 'nowrap', bgcolor: 'background.paper' }} />
);

/** La acción principal de una alerta: llena, para que se vea qué hacer primero. */
export const Principal = (props: React.ComponentProps<typeof Button>) => (
  <Button size="small" variant="contained" {...props} sx={{ whiteSpace: 'nowrap' }} />
);

/**
 * El único aviso de la pantalla: título corto, el SKU si hay uno, qué hacer, y los botones a la derecha.
 * Sin título, el texto va como título (un error de un diálogo, por ejemplo).
 */
export const Alerta = ({ tono, titulo, sku, descripcion, acciones, children }: {
  tono: Tono; titulo?: string; sku?: string | null; descripcion?: string | null; acciones?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <Box role={tono === 'frena' ? 'alert' : undefined} sx={{
    bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderTop: 3, borderTopColor: BORDE[tono],
    px: 2, py: 1.25, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 2, rowGap: 0.25, alignItems: 'center',
  }}>
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap', minWidth: 0 }}>
      <Typography variant="body2" fontWeight={titulo ? 700 : 400}>{titulo ?? children}</Typography>
      {sku && (
        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ fontFamily: 'monospace', color: 'text.primary' }}>{sku}</Box>{descripcion ? ` ${descripcion}` : ''}
        </Typography>
      )}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0.5, gridColumn: 2, gridRow: '1 / span 2' }}>
      {acciones}
    </Box>
    {titulo && children && (
      <Typography variant="body2" color="text.secondary" sx={{ gridColumn: 1, minWidth: 0 }}>{children}</Typography>
    )}
  </Box>
);
