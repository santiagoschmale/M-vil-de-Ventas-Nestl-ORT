import React from 'react';
import { Typography } from '@mui/material';

// Lo que explica cada ⓘ de la pantalla. Todo en un lugar para revisarlo con negocio.

const P = ({ children }: { children: React.ReactNode }) => <Typography paragraph>{children}</Typography>;

export const AYUDA = {
  movil: {
    titulo: 'Qué es el móvil',
    texto: (
      <>
        <P>
          El móvil reparte el objetivo del mes: cuánto tiene que vender cada canal de cada producto (SKU), en kilos y
          en pesos. La herramienta arma el primer reparto sola a partir del mes anterior; vos revisás y corregís lo
          puntual.
        </P>
        <P>
          <b>Cierra</b> quiere decir que se cumplen las dos cosas a la vez, exacto: cada SKU suma lo que pidió
          Contraloría y cada canal suma lo que pediste para ese canal. Kilos y pesos se cierran por separado.
        </P>
        <P>Cuando los dos cierran, se puede exportar el Excel para los equipos comerciales.</P>
      </>
    ),
  },
  entradas: {
    titulo: 'Qué se carga',
    texto: (
      <>
        <P>
          <b>Objetivo de Contraloría</b>: el Excel con cuánto tiene que vender cada SKU este mes, en kilos y en NNS
          (facturación neta). Es la meta de arriba: no se discute acá.
        </P>
        <P>
          <b>Totales por canal</b>: el Excel con cuánto tiene que vender cada canal, en kilos y en pesos. Lo define el
          planner. Si hay que corregir un número, se edita con el botón Editar.
        </P>
        <P>
          <b>Mes anterior</b>: cómo se repartió el mes pasado, SKU por canal, y cómo se abrió cada canal entre
          distribuidores y vendedores. Es el punto de partida: el reparto nuevo se parece lo más posible a ese.
        </P>
      </>
    ),
  },
  reglas: {
    titulo: 'Qué es una regla',
    texto: (
      <>
        <P>
          Una regla limita cuánto de un canal se lleva un grupo de categorías. Por ejemplo: en Mayoristas, el café no
          pasa del 20% de los kilos del canal.
        </P>
        <P>
          El reparto la cumple aunque el mes anterior haya sido distinto, y el resto se reparte entre los demás
          productos, siguiendo el mes anterior.
        </P>
        <P>
          Cada regla tiene un % para kilos y otro para pesos, independientes. Si dos reglas no se pueden cumplir a la
          vez, no hay una que gane: se marcan las dos y se explica en Para revisar.
        </P>
        <P>
          <b>Dónde se vende</b>: para un SKU nuevo, que el mes anterior no se vendió, elegís en qué canales va. Se
          reparte en proporción al total de cada canal. También sirve para limitar un SKU a ciertos canales.
        </P>
      </>
    ),
  },
  limite: {
    titulo: 'Tope, mínimo y fijo',
    texto: (
      <>
        <P><b>Tope</b>: esas categorías se llevan a lo sumo ese % del total del canal.</P>
        <P><b>Mínimo</b>: se llevan al menos ese % del total del canal.</P>
        <P><b>Fijo</b>: se llevan exactamente ese %.</P>
        <P>
          El % es sobre el total del canal, contando lo que hayas fijado a mano. Si una unidad no aplica, dejá su %
          vacío.
        </P>
      </>
    ),
  },
  revisar: {
    titulo: 'Qué hay para revisar',
    texto: (
      <>
        <P>
          <b>En rojo</b>, lo que impide cerrar: un SKU sin historia, totales que no coinciden, reglas que chocan.
          Mientras haya algo en rojo no hay reparto y no se puede exportar.
        </P>
        <P>
          <b>En amarillo</b>, lo que no bloquea pero conviene mirar: kilos que no se pueden abrir entre vendedores, un
          SKU repetido en el Excel, un producto de otro país. Se puede exportar igual: el sistema te los muestra antes
          y quedan en la hoja Problemas del Excel.
        </P>
        <P>Los botones de cada aviso te llevan a donde se resuelve.</P>
      </>
    ),
  },
  matriz: {
    titulo: 'Cómo se lee la tabla',
    texto: (
      <>
        <P>
          Cada fila es un SKU y cada columna un canal. Los kilos van con tres decimales porque se reparte al gramo:
          7.961,420 kg son 7.961 kilos y 420 gramos. Los pesos van con centavos.
        </P>
        <P>
          En cada canal, <b>pedido</b> es lo que pediste y <b>repartido</b> lo que quedó: en verde, coinciden. Un
          «·» quiere decir que ese SKU no se vende en ese canal.
        </P>
        <P>
          Tocá una celda para fijarla a mano (queda en azul con un pin y el resto se reacomoda) o para ver cómo se
          abre entre distribuidores y vendedores. El interruptor de cada fila saca al SKU del mes.
        </P>
      </>
    ),
  },
  apertura: {
    titulo: 'Cómo se abre debajo del canal',
    texto: (
      <>
        <P>
          Algunos canales se reparten hacia adentro: Distribuidores entre los distribuidores, los territorios entre
          sus vendedores. Se reparte con los pesos del mes anterior y la suma da exacto el valor de la celda.
        </P>
        <P>
          Apagar un distribuidor o vendedor lo saca de todos los SKUs y canales. Lo que le tocaba se reparte entre
          los que siguen prendidos, en proporción a lo que vendió cada uno de ese SKU en ese canal el mes anterior.
          Los que tienen un valor fijado a mano no cambian.
        </P>
        <P>
          <b>Base</b>: cada uno se reparte por histórico o con un <b>% manual</b>, por ejemplo si le cambiaron la
          cartera. El % vale para todos los SKUs del canal, en kilos y en pesos, sobre lo que queda después de lo
          fijado a mano; el resto se reparte por histórico entre los demás. Si en una celda nadie más tiene historia,
          los que tienen % se reparten todo entre ellos, en proporción a su %.
        </P>
        <P>
          <b>Distribuidor o vendedor nuevo</b>: con «Agregar» se suma a un canal. Como no tiene historia, entra con un
          %. Se puede apagar como cualquiera, o eliminar si se cargó por error.
        </P>
      </>
    ),
  },
  historial: {
    titulo: 'Qué guarda el historial',
    texto: (
      <P>
        Cada carga de archivo y cada ajuste (fijar, apagar, reglas) con quién lo hizo, cuándo y por qué. Es lo que
        permite explicar después por qué el móvil quedó como quedó.
      </P>
    ),
  },
} as const;
