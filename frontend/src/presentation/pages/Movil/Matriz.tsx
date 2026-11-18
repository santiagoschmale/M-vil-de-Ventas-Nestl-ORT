import React, { useEffect, useState } from 'react';
import {
  Box, Button, IconButton, InputAdornment, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useMovil, useSoloLectura } from '../../../stores/useMovil';
import { Celda, Cruce } from '../../../stores/useMovil/useMovil.type';
import { clave, formatear, UNIDADES } from './formato';
import { APAGADO, AVENA, CIERRA, ENFOCADA, NO_CIERRA, TINTA, numeros } from './estilo';
import { CeldaDialog } from './CeldaDialog';
import { MotivoDialog } from './MotivoDialog';

type Sku = Cruce['skus'][number];

const fija = { position: 'sticky' as const, left: 0, zIndex: 2, background: '#fff' };

export const Matriz = ({ cruce }: { cruce: Cruce }) => {
  const { cambiarSku, foco, soltarFoco } = useMovil();
  const soloLectura = useSoloLectura();
  const [abierta, setAbierta] = useState<{ sku: Sku; canal: string; celda: Celda }>();
  const [prender, setPrender] = useState<Sku>();
  // Con 6 a 9 canales y montos largos cuesta seguir en qué canal estás, sobre todo lejos del
  // encabezado: la columna bajo el mouse (o bajo el foco de teclado) se resalta entera.
  const [canalActivo, setCanalActivo] = useState<string>();
  // Al moverse entre celdas de la misma columna el valor no cambia y React no vuelve a dibujar:
  // con cien filas, redibujar en cada celda se notaría.
  const activar = (canal: string) => setCanalActivo(previo => (previo === canal ? previo : canal));
  const marcas = (canal: string) => ({
    onMouseOver: () => activar(canal),
    onMouseOut: () => setCanalActivo(undefined),
    onFocus: () => activar(canal),
    onBlur: () => setCanalActivo(undefined),
    'data-columna-activa': canalActivo === canal ? 'true' : undefined,
  });
  // Con el móvil real son más de cien SKUs: el buscador filtra las filas que ya están en pantalla.
  // No recalcula nada, así que los totales de cada canal no cambian.
  const [busqueda, setBusqueda] = useState('');
  const buscado = clave(busqueda);
  const skus = buscado
    ? cruce.skus.filter(s => clave(s.codigo).includes(buscado) || clave(s.descripcion).includes(buscado))
    : cruce.skus;
  // "Ver celda" desde Para revisar: abre esa celda con su apertura.
  useEffect(() => {
    if (!foco) return;
    setBusqueda('');  // el SKU al que se va puede estar filtrado, y entonces no se vería
    if (foco.tipo !== 'celda') return;
    const [codigo, canal] = foco.id.split('|');
    const sku = cruce.skus.find(x => x.codigo === codigo);
    const celda = sku?.celdas[canal];
    if (sku && celda) setAbierta({ sku, canal, celda });
    soltarFoco();  // se usa una vez: si la tabla se vuelve a montar, no la reabre
  }, [foco]);

  return (
    <>
      <TextField
        size="small" label="Buscar SKU" value={busqueda}
        helperText="Por código o descripción"
        onChange={e => setBusqueda(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') setBusqueda(''); }}
        sx={{ mb: 1, width: 320, maxWidth: '100%' }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment>
          ),
          endAdornment: busqueda ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Limpiar el campo" onClick={() => setBusqueda('')}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
      />
      <TableContainer sx={{ maxHeight: '65vh', border: `1px solid ${AVENA}`, borderRadius: 1 }}>
        <Table stickyHeader size="small" aria-label={`Matriz SKU por canal en ${UNIDADES[cruce.unidad].nombre.toLowerCase()}`}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...fija, zIndex: 3, background: AVENA, minWidth: 260 }}>SKU</TableCell>
              <TableCell sx={{ ...numeros, background: AVENA }}>Objetivo ({UNIDADES[cruce.unidad].simbolo})</TableCell>
              {cruce.canales.map(c => {
                const cuadra = c.pedido === c.repartido;
                return (
                  <TableCell key={c.nombre} data-columna-activa={canalActivo === c.nombre ? 'true' : undefined}
                    sx={{
                      ...numeros, background: AVENA, verticalAlign: 'top',
                      // Una línea por dentro: marca el encabezado sin correr nada ni cambiar el alto.
                      ...(canalActivo === c.nombre && { boxShadow: `inset 0 -3px 0 ${TINTA}` }),
                    }}>
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
            {skus.length === 0 && (
              <TableRow>
                <TableCell colSpan={2 + cruce.canales.length}>
                  <Typography variant="body2" sx={{ mb: 1 }}>Ningún SKU coincide con «{busqueda}».</Typography>
                  <Button size="small" onClick={() => setBusqueda('')}>Limpiar búsqueda</Button>
                </TableCell>
              </TableRow>
            )}
            {skus.map(s => (
              <TableRow key={s.codigo} id={`sku-${s.codigo}`} hover
                aria-current={foco?.tipo === 'sku' && foco.id === s.codigo ? true : undefined}
                sx={[{ '& td': { color: s.activo ? undefined : APAGADO } },
                     foco?.tipo === 'sku' && foco.id === s.codigo && ENFOCADA]}>
                <TableCell sx={fija}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Sin `ocupado`: solo abre el diálogo, y deshabilitarlo grisaba toda la columna en cada recálculo. */}
                    <Switch
                      size="small" checked={s.activo} disabled={soloLectura}
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
                  const resaltada = canalActivo === c.nombre;
                  if (!celda) {
                    return (
                      <TableCell key={c.nombre} {...marcas(c.nombre)}
                        sx={{ ...numeros, color: APAGADO, ...(resaltada && { backgroundColor: AVENA }) }}>·</TableCell>
                    );
                  }
                  return (
                    <TableCell
                      key={c.nombre}
                      {...marcas(c.nombre)}
                      onClick={() => setAbierta({ sku: s, canal: c.nombre, celda })}
                      onKeyDown={e => {
                        // Enter y Espacio, como cualquier botón; Espacio sin scrollear la página.
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        setAbierta({ sku: s, canal: c.nombre, celda });
                      }}
                      tabIndex={0} role="button"
                      aria-label={`${s.codigo} en ${c.nombre}: ${formatear(celda.monto)}${celda.fijada ? ', fijado' : ''}`}
                      sx={{
                        ...numeros, cursor: 'pointer',
                        ...(resaltada && { backgroundColor: AVENA }),
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
