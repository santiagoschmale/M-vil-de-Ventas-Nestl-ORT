import React from 'react';
import { Box, Paper, Skeleton, useMediaQuery } from '@mui/material';
import { AVENA } from './estilo';

// Lo que se ve mientras llega el móvil: la misma forma que la pantalla (barra fija arriba, tarjetas de
// Entradas, secciones plegadas), en gris, para que al llegar los datos el contenido caiga en el mismo lugar.
// Las medidas copian las de Movil.tsx (mismo contenedor, mismo header): si cambian allá, se cambian acá.
// Las esquinas salen del tema (`rounded` usa theme.shape.borderRadius, 6 px), no se escriben a mano.

export const EsqueletoMovil = () => {
  // Sin animación si el sistema pide menos movimiento (el esqueleto queda quieto, igual de legible).
  const sinMovimiento = useMediaQuery('(prefers-reduced-motion: reduce)');
  const animation = sinMovimiento ? false : 'pulse';
  const pieza = (alto: number, ancho: number | string, clave?: React.Key) => (
    <Skeleton key={clave} variant="rounded" height={alto} width={ancho} animation={animation} />
  );

  return (
    // role="status" + aria-busy: el lector de pantalla anuncia "Cargando el móvil" y no recorre las barras grises.
    <Box role="status" aria-busy="true" aria-label="Cargando el móvil"
      sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box component="header" aria-hidden sx={{
        mx: -3, px: 3, py: 1.5, borderBottom: `1px solid ${AVENA}`, display: 'flex', flexDirection: 'column', gap: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 32 }}>
          {pieza(28, 96)}
          {pieza(28, 140)}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, minHeight: 30 }}>
          {pieza(20, 280)}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {pieza(30, 96)}
            {pieza(30, 110)}
          </Box>
        </Box>
      </Box>

      <Box aria-hidden sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Entradas: la sección abierta, con sus tres tarjetas. */}
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {pieza(24, 160)}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
            {[0, 1, 2].map(n => (
              <Paper key={n} variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {pieza(22, '60%', 't')}
                {pieza(36, 160, 'b')}
                {pieza(16, '80%', 'd')}
              </Paper>
            ))}
          </Box>
        </Paper>

        {/* Reglas, Para revisar e Historial: secciones plegadas. */}
        {[0, 1, 2].map(n => (
          <Paper key={n} variant="outlined" sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
            {pieza(22, 140)}
            {pieza(16, 200)}
          </Paper>
        ))}
      </Box>
    </Box>
  );
};
