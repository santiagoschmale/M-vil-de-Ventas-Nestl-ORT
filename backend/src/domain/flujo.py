"""
Flujo en redes para el cruce SKU × canal. Dos piezas chicas, sin dependencias:

- `FlujoMaximo` (Edmonds-Karp): ¿se pueden cumplir filas y columnas a la vez?
  Si no, el corte mínimo dice qué canales no pueden llegar a su total.
- `flujo_de_costo_minimo`: elige qué celdas redondean para arriba, prefiriendo
  las de mayor resto (el mismo criterio que largest remainder, en dos
  dimensiones).

Las capacidades son enteros (unidades mínimas: gramos, centavos). Los nodos se
recorren siempre en el orden en que se agregaron: el resultado es determinístico.
"""

from __future__ import annotations

import heapq
from collections import deque
from decimal import Decimal

INFINITO = None  # capacidad sin tope
COSTO = Decimal("1e-15")


class FlujoMaximo:
    def __init__(self):
        self._aristas: dict[str, list[list]] = {}  # nodo -> [destino, capacidad, flujo, índice de la inversa]

    def _nodo(self, n: str) -> list[list]:
        return self._aristas.setdefault(n, [])

    def agregar(self, desde: str, hasta: str, capacidad: int | None) -> None:
        ida = self._nodo(desde)
        vuelta = self._nodo(hasta)
        ida.append([hasta, capacidad, 0, len(vuelta)])
        vuelta.append([desde, 0, 0, len(ida) - 1])

    @staticmethod
    def _residual(arista) -> int | None:
        _, capacidad, flujo, _ = arista
        return None if capacidad is INFINITO else capacidad - flujo

    def maximo(self, fuente: str, sumidero: str) -> int:
        total = 0
        while True:
            previo = {fuente: None}
            cola = deque([fuente])
            while cola and sumidero not in previo:
                n = cola.popleft()
                for i, arista in enumerate(self._aristas[n]):
                    r = self._residual(arista)
                    if arista[0] not in previo and (r is None or r > 0):
                        previo[arista[0]] = (n, i)
                        cola.append(arista[0])
            if sumidero not in previo:
                return total
            # cuello de botella del camino
            cuello, n = None, sumidero
            while previo[n] is not None:
                p, i = previo[n]
                r = self._residual(self._aristas[p][i])
                cuello = r if cuello is None or (r is not None and r < cuello) else cuello
                n = p
            n = sumidero
            while previo[n] is not None:
                p, i = previo[n]
                arista = self._aristas[p][i]
                arista[2] += cuello
                self._aristas[arista[0]][arista[3]][2] -= cuello
                n = p
            total += cuello

    def flujo(self, desde: str, hasta: str) -> int:
        return sum(a[2] for a in self._aristas[desde] if a[0] == hasta and a[1] != 0)

    def alcanzables(self, fuente: str) -> set[str]:
        """Nodos alcanzables desde la fuente en el grafo residual (lado fuente del corte mínimo)."""
        vistos = {fuente}
        cola = deque([fuente])
        while cola:
            n = cola.popleft()
            for arista in self._aristas[n]:
                r = self._residual(arista)
                if arista[0] not in vistos and (r is None or r > 0):
                    vistos.add(arista[0])
                    cola.append(arista[0])
        return vistos

    def componentes(self) -> dict[str, int]:
        """Componentes fuertemente conexas del grafo residual (Kosaraju, iterativo)."""
        orden, vistos = [], set()
        for inicio in self._aristas:
            if inicio in vistos:
                continue
            vistos.add(inicio)
            pila = [(inicio, iter(self._aristas[inicio]))]
            while pila:
                n, it = pila[-1]
                avanzo = False
                for arista in it:
                    r = self._residual(arista)
                    if arista[0] not in vistos and (r is None or r > 0):
                        vistos.add(arista[0])
                        pila.append((arista[0], iter(self._aristas[arista[0]])))
                        avanzo = True
                        break
                if not avanzo:
                    orden.append(n)
                    pila.pop()
        # grafo transpuesto del residual
        entrantes: dict[str, list[str]] = {n: [] for n in self._aristas}
        for n, aristas in self._aristas.items():
            for arista in aristas:
                r = self._residual(arista)
                if r is None or r > 0:
                    entrantes[arista[0]].append(n)
        componente: dict[str, int] = {}
        for raiz in reversed(orden):
            if raiz in componente:
                continue
            componente[raiz] = raiz_id = len(set(componente.values()))
            pila = [raiz]
            while pila:
                n = pila.pop()
                for m in entrantes[n]:
                    if m not in componente:
                        componente[m] = raiz_id
                        pila.append(m)
        return componente


def flujo_de_costo_minimo(
    ofertas: dict[str, int],
    demandas: dict[str, int],
    arcos: dict[tuple[str, str], Decimal],
    intermedios: list[tuple[str, str, int, Decimal]] = (),
) -> dict[tuple[str, str], int] | None:
    """
    Transporte 0/1: cada arco (oferta, destino) lleva 0 o 1 unidad, cada oferta
    entrega exactamente su cantidad y cada demanda recibe exactamente la suya, con
    costo total mínimo. Devuelve {arco: 0|1}, o None si no hay forma de cumplir.

    `intermedios`: nodos entre ofertas y demandas (las reglas del cruce). Un arco
    puede ir de una oferta a un intermedio, y cada tupla (desde, hasta, capacidad,
    costo) une un intermedio con otro o con una demanda. Un destino que no está en
    `demandas` es un intermedio.

    Caminos más cortos sucesivos con potenciales (Dijkstra sobre costos
    reducidos). Hay a lo sumo una unidad por arco, así que las iteraciones son a
    lo sumo tantas como arcos.
    """
    total = sum(ofertas.values())
    if total != sum(demandas.values()):
        return None
    # Costos a 15 decimales: sobra para elegir qué celda sube, y las sumas quedan exactas
    # en la precisión de Decimal (con 50 dígitos, redondear las sumas arma ciclos
    # negativos de 1e-26 en los que Dijkstra no termina).
    arcos = {k: v.quantize(COSTO) for k, v in arcos.items()}
    intermedios = [(a, b, cap, costo.quantize(COSTO)) for a, b, cap, costo in intermedios]
    fuente, sumidero = "\0fuente", "\0sumidero"
    grafo: dict[str, list[list]] = {fuente: [], sumidero: []}

    def arista(a, b, cap, costo):
        grafo.setdefault(a, [])
        grafo.setdefault(b, [])
        grafo[a].append([b, cap, costo, len(grafo[b])])
        grafo[b].append([a, 0, -costo, len(grafo[a]) - 1])

    def destino(d):
        return ("d:" if d in demandas else "g:") + d

    for o, cantidad in ofertas.items():
        arista(fuente, "o:" + o, cantidad, Decimal(0))
    for (o, d), costo in arcos.items():
        arista("o:" + o, destino(d), 1, costo)
    for desde, hasta, capacidad, costo in intermedios:
        arista("g:" + desde, destino(hasta), capacidad, costo)
    for d, cantidad in demandas.items():
        arista("d:" + d, sumidero, cantidad, Decimal(0))

    potencial = _potenciales(grafo, fuente)
    if potencial is None:
        return None

    orden = {n: i for i, n in enumerate(grafo)}  # desempate determinístico en el heap
    enviado = 0
    while enviado < total:
        dist = {fuente: Decimal(0)}
        previo: dict[str, tuple[str, int]] = {}
        heap = [(Decimal(0), orden[fuente], fuente)]
        while heap:
            d_n, _, n = heapq.heappop(heap)
            if d_n > dist.get(n, d_n):
                continue
            for i, (m, cap, costo, _) in enumerate(grafo[n]):
                if cap <= 0:
                    continue
                nd = d_n + costo + potencial[n] - potencial[m]
                if m not in dist or nd < dist[m]:
                    dist[m] = nd
                    previo[m] = (n, i)
                    heapq.heappush(heap, (nd, orden[m], m))
        if sumidero not in dist:
            return None
        # A los que no se alcanzaron les toca la distancia máxima: así ningún costo
        # reducido queda negativo en la vuelta siguiente (con nodos intermedios pasa).
        lejos = max(dist.values())
        for n in potencial:
            potencial[n] += dist.get(n, lejos)
        # una unidad por el camino (los arcos del medio tienen capacidad 1)
        n = sumidero
        while n != fuente:
            p, i = previo[n]
            a = grafo[p][i]
            a[1] -= 1
            grafo[a[0]][a[3]][1] += 1
            n = p
        enviado += 1

    return {
        (o, d): 1 - next(a[1] for a in grafo["o:" + o] if a[0] == destino(d))
        for (o, d) in arcos
    }


def _potenciales(grafo: dict[str, list[list]], fuente: str) -> dict[str, Decimal] | None:
    """
    Distancias más cortas desde la fuente con costos negativos (Bellman-Ford): los
    potenciales iniciales que dejan todos los costos reducidos >= 0. El grafo es un
    DAG, así que no hay ciclos negativos. Los nodos no alcanzables quedan en 0.
    """
    dist = {fuente: Decimal(0)}
    for _ in range(len(grafo)):
        cambio = False
        for n, aristas in grafo.items():
            if n not in dist:
                continue
            for m, cap, costo, _ in aristas:
                if cap > 0 and (m not in dist or dist[n] + costo < dist[m]):
                    dist[m] = dist[n] + costo
                    cambio = True
        if not cambio:
            return {n: dist.get(n, Decimal(0)) for n in grafo}
    return None  # ciclo negativo: no puede pasar con un DAG
