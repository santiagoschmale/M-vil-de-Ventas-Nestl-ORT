import React from 'react';
import { Typography } from '@mui/material';

// Lo que explica cada ⓘ de la pantalla. Todo en un lugar para revisarlo con negocio.

const P = ({ children }: { children: React.ReactNode }) => <Typography paragraph>{children}</Typography>;

export const AYUDA = {
  entradas: {
    titulo: 'Qué se carga',
    texto: (
      <>
        <P>
          <b>Objetivo de Contraloría</b>: el Excel con cuánto tiene que vender cada SKU este mes, en kilos y en NNS
          (facturación neta). Es la meta de arriba: no se discute acá.
        </P>
        <P>
          <b>Totales por canal</b>: cuánto tiene que vender cada canal, en kilos y en pesos. Lo define el planner. Se
          sube en Excel o se arma en la pantalla («Armar en pantalla»): si ya cargaste el mes anterior, arranca con sus
          canales y sus kilos, y con sus pesos si el archivo los trae. Mientras escribís ves cuánto falta o sobra en
          kilos, y «Ajustar a Contraloría» lo reparte entre los canales. Si faltan pesos, «Completar con los
          sugeridos» los calcula con los kilos y el precio de cada SKU en cada canal.
        </P>
        <P>
          Si la diferencia con Contraloría es chica (hasta 1 kg o $ 10.000), se reparte sola entre los canales y te
          avisa.
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
          La regla va por categoría: si el objetivo no la trae, se toma la del mes anterior. Un SKU sin categoría no
          entra en ninguna regla.
        </P>
        <P>
          <b>Dónde se vende</b>: para un SKU nuevo, que el mes anterior no se vendió, elegís en qué canales va. Se
          reparte en proporción al total de cada canal. También sirve para limitar un SKU a ciertos canales.
        </P>
        <P>
          <b>Cómo se abre cada canal</b>: un canal que el mes anterior se abrió entre distribuidores o vendedores se
          puede cerrar en el canal, si cambió la estructura comercial, y volver a abrir.
        </P>
      </>
    ),
  },
  limite: {
    titulo: 'Tope, mínimo y fijo',
    texto: (
      <>
        <P><b>Tope</b>: a lo sumo ese %. <b>Mínimo</b>: al menos ese %. <b>Fijo</b>: exactamente ese %.</P>
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
          <b>En rojo</b>, lo que frena: un SKU sin historia, totales que no coinciden, reglas que chocan. Mientras haya
          algo en rojo, esa unidad (kilos o pesos) no se reparte y no se puede exportar ni aprobar.
        </P>
        <P>
          <b>En amarillo</b>, lo que no bloquea pero conviene mirar: kilos que no se pueden abrir entre vendedores, un
          SKU repetido en el Excel, un producto de otro país. Se puede exportar igual: el sistema te los muestra antes
          y quedan en la hoja Problemas del Excel.
        </P>
        <P>
          Los botones lo resuelven ahí mismo (corregir los totales, elegir canales, elegir la fila, ver la celda).
          «Ir a…» solo te lleva a donde mirarlo: la regla o la fila del SKU en la tabla.
        </P>
      </>
    ),
  },
  matriz: {
    titulo: 'Cómo se lee la tabla',
    texto: (
      <>
        <P>
          Cada fila es un SKU y cada columna un canal. Los kilos van al gramo y los pesos al centavo.
        </P>
        <P>
          <b>De dónde sale cada número</b>: cada SKU reparte lo que pide Contraloría entre sus canales como se
          repartió el mes anterior, ajustado a los totales de cada canal. Los kilos siguen lo que vendió cada canal;
          los pesos, lo que facturó, porque el mismo SKU no vale lo mismo en todos los canales. Un SKU que el mes
          anterior no se vendió en un canal no se reparte ahí, salvo que lo agregues con «Dónde se vende».
        </P>
        <P>
          En cada canal, <b>pedido</b> es el total del canal (lo que cargaste en Totales por canal, más la diferencia
          chica con Contraloría si se repartió sola) y <b>repartido</b> lo que quedó: en verde, coinciden. Un «·»
          quiere decir que ese SKU no se vende en ese canal.
        </P>
        <P>
          Tocá una celda para fijarla a mano (queda en azul con un pin y el resto se reacomoda) o para ver cómo se
          abre entre distribuidores y vendedores. El interruptor de cada fila saca al SKU del mes: sus kilos y pesos
          dejan de sumar, y los totales por canal se corrigen con «Ajustar a Contraloría».
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
          sus vendedores. Los kilos se reparten según lo que vendió cada uno de ese SKU el mes anterior y los pesos,
          según lo que facturó. La suma da exacto el valor de la celda.
        </P>
        <P>
          Apagar un distribuidor o vendedor lo saca de todos los SKUs y canales. Lo que le tocaba pasa a los que siguen
          prendidos: en kilos según lo que vendió cada uno el mes anterior, en pesos según lo que facturó.
        </P>
        <P>
          <b>Base</b>: cada uno se reparte por histórico o con un <b>% manual</b>, por ejemplo si le cambiaron la
          cartera. El % vale para todos los SKUs del canal, en kilos y en pesos; el resto se reparte por histórico
          entre los demás. Si en una celda nadie más tiene historia,
          los que tienen % se reparten todo entre ellos, en proporción a su %.
        </P>
        <P>
          <b>Distribuidor o vendedor nuevo</b>: con «Agregar» se suma a un canal. Como no tiene historia, entra con un
          %. Se puede apagar como cualquiera, o eliminar si se cargó por error.
        </P>
      </>
    ),
  },
  etapas: {
    titulo: 'Revisión por etapa',
    texto: (
      <>
        <P>
          El móvil se arma en dos etapas: primero <b>por canal</b> (la tabla SKU × canal) y después <b>debajo del
          canal</b> (cómo se abre cada canal entre distribuidores o vendedores, al tocar una celda).
        </P>
        <P>
          Se marca como revisada con los botones de arriba de la tabla cuando kilos y pesos cierran, primero por canal y
          después debajo del canal; en el encabezado se ve cuáles faltan. Marcarla no te impide seguir cambiando. Si
          después cambiás algo, el OK de esa etapa y de las siguientes se borra. Para aprobar, todas tienen que estar
          revisadas (si ningún canal se abre, hay una sola).
        </P>
      </>
    ),
  },
  historial: {
    titulo: 'Qué guarda el historial',
    texto: (
      <P>
        Cada carga de archivo y cada cambio, con quién lo hizo y cuándo. Los cambios (fijar, apagar, reglas, %) llevan
        además el motivo.
      </P>
    ),
  },
} as const;
