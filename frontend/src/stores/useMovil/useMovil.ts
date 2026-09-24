import { create } from 'zustand';
import { api } from '../../infra/http';
import { useSnackbarProps } from '../useSnackbarProps';
import { conUnidad } from '../../presentation/pages/Movil/formato';
import { Apertura, Cruce, Estado, TUseMovil } from './useMovil.type';

// Los errores del cliente HTTP traen la respuesta del backend: { detail: "..." }.
const respuesta = (e: unknown) =>
  (e as { response?: { status?: number; data?: { detail?: unknown } } })?.response;

/** Qué pasó y qué hacer, en palabras del planner. El backend ya manda mensajes así. */
export const mensajeDeError = (e: unknown): string => {
  const r = respuesta(e);
  if (!r) return 'No se pudo conectar con el servidor. Revisá la conexión y probá de nuevo.';
  const detalle = r.data?.detail;
  if (typeof detalle === 'string') return detalle;
  if ((r.status ?? 0) >= 500) {
    return 'Algo falló en el servidor y el cambio no se aplicó. Probá de nuevo; si se repite, avisá al equipo.';
  }
  return 'El pedido tenía un formato que el servidor no reconoce y no se aplicó. Avisá al equipo.';
};

const avisar = (message: string, severity: 'success' | 'error') =>
  useSnackbarProps.getState().setSnackbarProps({ message, severity });

const ruta = (...partes: string[]) => partes.map(encodeURIComponent).join('/');

type Opciones = {
  exito?: (estado: Estado) => string;
  // Desde un diálogo el error se muestra ahí, junto al campo; si no, como aviso.
  errorEnDialogo?: boolean;
};

export const useMovil = create<TUseMovil>((set, get) => {
  const traerCruce = async (estado: Estado) => {
    if (estado.faltan.length) return set({ cruce: undefined });
    const { unidad } = get();
    const cruce = (await api.get<Cruce>(`/movil/cruce/${unidad}`)).data;
    // Si mientras tanto eligieron la otra unidad, esta respuesta ya no va.
    if (get().unidad === unidad) set({ cruce });
  };

  // Todo cambio devuelve el estado nuevo; después se trae la matriz de la unidad elegida.
  // Devuelve null si salió bien o el mensaje de error.
  const cambiar = async (pedido: () => Promise<{ data: Estado }>, opciones: Opciones = {}) => {
    set({ ocupado: true });
    try {
      const estado = (await pedido()).data;
      set({ estado, errorDeCarga: undefined });
      await traerCruce(estado);
      if (opciones.exito) avisar(opciones.exito(estado), 'success');
      return null;
    } catch (e) {
      const mensaje = mensajeDeError(e);
      if (!opciones.errorEnDialogo) avisar(mensaje, 'error');
      return mensaje;
    } finally {
      set({ ocupado: false });
    }
  };

  const subir = (url: string, archivo: File, exito: Opciones['exito']) => {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return cambiar(() => api.upload<Estado>(url, datos), { exito });
  };

  const enDialogo = (exito: Opciones['exito']): Opciones => ({ exito, errorEnDialogo: true });
  const encendido = (activo: boolean) => (activo ? 'prendido' : 'apagado');

  return {
    estado: undefined,
    cruce: undefined,
    unidad: 'kilos',
    ocupado: false,
    errorDeCarga: undefined,

    refrescar: async () => {
      set({ ocupado: true });
      try {
        const estado = (await api.get<Estado>('/movil')).data;
        set({ estado, errorDeCarga: undefined });
        await traerCruce(estado);
      } catch (e) {
        set({ errorDeCarga: mensajeDeError(e) });
      } finally {
        set({ ocupado: false });
      }
    },

    elegirUnidad: async unidad => {
      set({ unidad });
      const { estado } = get();
      if (estado) await traerCruce(estado).catch(e => avisar(mensajeDeError(e), 'error'));
    },

    cargarInput1: archivo =>
      subir('/movil/input1', archivo, e => `Input 1 cargado: ${e.entradas.input1?.skus} SKUs.`),
    cargarBase: archivo =>
      subir('/movil/base', archivo, e => `Base cargada: ${e.entradas.base?.celdas} celdas del mes anterior.`),
    cargarInput2: texto =>
      cambiar(() => api.put('/movil/input2', { texto }), {
        exito: e => `Input 2 cargado: ${e.entradas.input2?.canales} canales.`,
      }),
    cargarMuestra: () =>
      cambiar(() => api.post('/movil/muestra', {}), { exito: () => 'Datos de muestra cargados.' }),

    cambiarSku: (sku, activo, motivo) =>
      cambiar(() => api.put(`/movil/skus/${ruta(sku)}`, { activo, motivo }),
        enDialogo(() => `SKU ${sku} ${encendido(activo)}.`)),
    cambiarEntidad: (entidad, activo, motivo) =>
      cambiar(() => api.put(`/movil/entidades/${ruta(entidad)}`, { activo, motivo }),
        enDialogo(() => `${entidad} ${encendido(activo)}.`)),
    fijar: (sku, canal, monto, motivo) => {
      const { unidad } = get();
      return cambiar(() => api.put(`/movil/celdas/${ruta(unidad, sku, canal)}`, { monto, motivo }),
        enDialogo(e => {
          const valor = e.fijas[unidad].find(f => f.sku === sku && f.canal === canal)?.valor;
          return `Fijado en ${conUnidad(valor, unidad)}. El resto de la fila y la columna se recalculó.`;
        }));
    },
    desfijar: (sku, canal, motivo) =>
      cambiar(() => api.delete(`/movil/celdas/${ruta(get().unidad, sku, canal)}`, { data: { motivo } }),
        enDialogo(() => 'La celda vuelve a calculada.')),

    apertura: async (sku, canal) => {
      try {
        return (await api.get<Apertura>(`/movil/apertura/${ruta(sku, canal)}`)).data;
      } catch (e) {
        if (respuesta(e)?.status !== 404) avisar(mensajeDeError(e), 'error'); // 404: no se abre debajo del canal
        return null;
      }
    },
  };
});
