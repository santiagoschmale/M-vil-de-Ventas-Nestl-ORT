import React, { useEffect, useState } from 'react';
import { Box, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import { useMovil } from '../../../stores/useMovil';
import { Celda, Cruce } from '../../../stores/useMovil/useMovil.type';
import { formatear, UNIDADES } from './formato';
import { APAGADO, AVENA, CIERRA, ENFOCADA, NO_CIERRA, TINTA, numeros } from './estilo';
import { CeldaDialog } from './CeldaDialog';
import { MotivoDialog } from './MotivoDialog';

type Sku = Cruce['skus'][number];

const fija = { position: 'sticky' as const, left: 0, zIndex: 2, background: '#fff' };

export const Matriz = ({ cruce }: { cruce: Cruce }) => {
  const { cambiarSku, ocupado, foco, soltarFoco } = useMovil();
  const [abierta, setAbierta] = useState<{ sku: Sku; canal: string; celda: Celda }>();
  const [prender, setPrender] = useState<Sku>();
  // "Ver celda" desde Para revisar: abre esa celda con su apertura.
  useEffect(() => {
    if (foco?.tipo !== 'celda') return;
    const [codigo, canal] = foco.id.split('|');
    const sku = cruce.skus.find(x => x.codigo === codigo);
    const celda = sku?.celdas[canal];
    if (sku && celda) setAbierta({ sku, canal, celda });
    soltarFoco();  // se usa una vez: si la tabla se vuelve a montar, no la reabre
  }, [foco]);

  return (
    <>
      {!cruce.cierra && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Los valores aparecen cuando el cruce cierra. Mientras tanto podés apagar SKUs desde acá.
        </Typography>
      )}
      <TableContainer sx={{ maxHeight: '65vh', border: `1px solid ${AVENA}`, borderRadius: 1 }}>
        <Table stickyHeader size="small" aria-label={`Matriz SKU por canal en ${UNIDADES[cruce.unidad].nombre.toLowerCase()}`}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...fija, zIndex: 3, background: AVENA, minWidth: 260 }}>SKU</TableCell>
              <TableCell sx={{ ...numeros, background: AVENA }}>Objetivo ({UNIDADES[cruce.unidad].simbolo})</TableCell>
              {cruce.canales.map(c => {
                const cuadra = c.pedido === c.repartido;
                return (
                  <TableCell key={c.nombre} sx={{ ...numeros, background: AVENA, verticalAlign: 'top' }}>
                    <Typography variant="body2" fontWeight={700}>{c.nombre}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      pedido {formatear(c.pedido)}
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ color: cuadra ? CIERRA : NO_CIERRA }}>
                      repartido {formatear(c.repartido)}
                    </Typography>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {cruce.skus.map(s => (
              <TableRow key={s.codigo} id={`sku-${s.codigo}`} hover
                aria-current={foco?.tipo === 'sku' && foco.id === s.codigo ? true : undefined}
                sx={[{ '& td': { color: s.activo ? undefined : APAGADO } },
                     foco?.tipo === 'sku' && foco.id === s.codigo && ENFOCADA]}>
                <TableCell sx={fija}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Switch
                      size="small" checked={s.activo} disabled={ocupado}
                      inputProps={{ 'aria-label': `${s.activo ? 'Apagar' : 'Prender'} ${s.codigo}` }}
                      onChange={() => setPrender(s)}
                    />
                    <Box>
                      <Typography variant="body2" sx={numeros} style={{ textAlign: 'left' }}>{s.codigo}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.descripcion}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={numeros}>{formatear(s.objetivo)}</TableCell>
                {cruce.canales.map(c => {
                  const celda = s.celdas[c.nombre];
                  if (!celda) return <TableCell key={c.nombre} sx={{ ...numeros, color: APAGADO }}>·</TableCell>;
                  return (
                    <TableCell
                      key={c.nombre}
                      onClick={() => setAbierta({ sku: s, canal: c.nombre, celda })}
                      onKeyDown={e => e.key === 'Enter' && setAbierta({ sku: s, canal: c.nombre, celda })}
                      tabIndex={0} role="button"
                      aria-label={`${s.codigo} en ${c.nombre}: ${formatear(celda.monto)}${celda.fijada ? ', fijado' : ''}`}
                      sx={{
                        ...numeros, cursor: 'pointer',
                        '&:hover, &:focus-visible': { outline: `2px solid ${TINTA}`, outlineOffset: -2 },
                        ...(celda.fijada && {
                          color: `${TINTA} !important`, fontWeight: 700,
                          textDecoration: 'underline', textDecorationThickness: 2, textUnderlineOffset: 3,
                        }),
                      }}
                    >
                      {celda.fijada && <PushPinRoundedIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />}
                      {formatear(celda.monto)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {abierta && (
        <CeldaDialog
          sku={abierta.sku.codigo} descripcion={abierta.sku.descripcion} canal={abierta.canal}
          celda={abierta.celda} onCerrar={() => setAbierta(undefined)}
        />
      )}
      {prender && (
        <MotivoDialog
          titulo={`${prender.activo ? 'Apagar' : 'Prender'} ${prender.codigo}`}
          descripcion={prender.activo
            ? 'Sale del reparto de este mes, en kilos y en pesos. Si tiene celdas fijadas, se guardan y vuelven al prenderlo.'
            : 'Vuelve al reparto según su distribución del mes anterior.'}
          confirmar={prender.activo ? 'Apagar' : 'Prender'}
          onConfirmar={m => cambiarSku(prender.codigo, !prender.activo, m)}
          onCerrar={() => setPrender(undefined)}
        />
      )}
    </>
  );
};
