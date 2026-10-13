import React, { useState } from 'react';
import { Box, Collapse, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useMovil } from '../../../stores/useMovil';
import { nombreMes } from './formato';
import { Ayuda } from './Ayuda';
import { AYUDA } from './ayudas';

/**
 * En el sidebar, debajo de "Móvil": todos los meses, del más nuevo al más viejo, agrupados por año.
 * El año del último mes (y el del que se está viendo) arranca abierto; los demás, plegados.
 * ponytail: no navega; hoy el móvil es la única pantalla del menú.
 */
export const MesesMenu = () => {
  const { meses, estado, verMes } = useMovil();
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  if (!meses.length) return null;

  const ultimo = meses[meses.length - 1].mes;
  const porAnio = new Map<string, typeof meses>();
  [...meses].reverse().forEach(m => {
    const anio = m.mes.slice(0, 4);
    porAnio.set(anio, [...(porAnio.get(anio) ?? []), m]);
  });
  const abierto = (anio: string) => abiertos[anio]
    ?? (anio === ultimo.slice(0, 4) || anio === estado?.mes.slice(0, 4));

  return (
    <Box component="nav" aria-label="Meses del móvil" sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, gap: 0.5 }}>
        <Typography variant="overline" color="text.secondary">Meses</Typography>
        <Ayuda ayuda={AYUDA.meses} />
      </Box>
      {[...porAnio].map(([anio, delAnio]) => (
        <React.Fragment key={anio}>
          <ListItemButton dense aria-expanded={abierto(anio)} onClick={() => setAbiertos(a => ({ ...a, [anio]: !abierto(anio) }))}>
            {abierto(anio) ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
            <ListItemText primary={anio} primaryTypographyProps={{ fontWeight: 700, variant: 'body2', ml: 1 }} />
          </ListItemButton>
          <Collapse in={abierto(anio)} unmountOnExit>
            <List disablePadding dense>
              {delAnio.map(m => (
                <ListItemButton key={m.mes} sx={{ pl: 5 }} selected={m.mes === estado?.mes}
                  aria-current={m.mes === estado?.mes ? 'page' : undefined}
                  onClick={() => verMes(m.mes === ultimo ? undefined : m.mes)}>
                  <ListItemText primary={nombreMes(m.mes).split(' ')[0]} secondary={m.aprobado ? '✓ Aprobado' : 'En curso'}
                    primaryTypographyProps={{ sx: { '&::first-letter': { textTransform: 'uppercase' } } }} />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        </React.Fragment>
      ))}
    </Box>
  );
};
