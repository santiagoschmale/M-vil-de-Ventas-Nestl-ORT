import { create } from 'zustand';
import { api } from '../../infra/http';
import { useSnackbarProps } from '../useSnackbarProps';
import { Apertura, Cruce, Estado, TUseMovil } from './useMovil.type';

// Los errores del cliente HTTP traen la respuesta del backend: { detail: "..." }.
const respuesta = (e: unknown) =>
  (e as { response?: { status?: number; data?: unknown } })?.response;

/** Qué pasó y qué hacer, en palabras del planner. El backend ya manda mensajes así. */
export const mensajeDeError = (e: unknown): string => {
  const r = respuesta(e);
  if (!r) return 'No se pudo conectar con el servidor. Revisá la conexión y probá de nuevo.';
  // Una página HTML en vez de JSON: no contestó el backend del móvil (pasa si otro programa usa su puerto).
  if (typeof r.data === 'string' && r.data.trimStart().startsWith('<')) {
    return 'Contestó otra aplicación en lugar del backend del móvil. Revisá que nada más esté usando el puerto 3000.';
  }
  const detalle = (r.data as { detail?: unknown } | undefined)?.detail;
  if (typeof detalle === 'string') return detalle;
  if ((r.status ?? 0) >= 500) {
    return 'Algo falló en el servidor y el cambio no se aplicó. Probá de nuevo; si se repite, avisá al equipo.';
  }
  return 'El pedido tenía un formato que el servidor no reconoce y no se aplicó. Avisá al equipo.';
};

const avisar = (message: string, severity: 'info' | 'error') =>
  useSnackbarProps.getState().setSnackbarProps({ message, severity });

const ruta = (...partes: string[]) => partes.map(encodeURIComponent).join('/');

type Opciones = {
  // Mientras falte alguna entrada no hay reparto: el aviso dice qué se cargó.
  cargado?: string;
  // Desde un diálogo el error se muestra ahí, junto al campo; si no, como aviso.
  errorEnDialogo?: boolean;
};

// El aviso dura unos segundos: corto e informativo. Si cierra o no ya se ve en el encabezado.
const RECALCULADO = 'Reparto recalculado.';

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
      avisar(estado.faltan.length ? opciones.cargado ?? 'Guardado.' : RECALCULADO, 'info');
      return null;
    } catch (e) {
      const mensaje = mensajeDeError(e);
      if (!opciones.errorEnDialogo) avisar(mensaje, 'error');
      return mensaje;
    } finally {
      set({ ocupado: false });
    }
  };

  const subir = (url: string, archivo: File, cargado: string) => {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return cambiar(() => api.upload<Estado>(url, datos), { cargado });
  };

  const enDialogo: Opciones = { errorEnDialogo: true };

  return {
    foco: undefined,
    enfocar: (tipo, id) => set(s => ({ foco: { tipo, id, vez: (s.foco?.vez ?? 0) + 1 } })),
    soltarFoco: () => set({ foco: undefined }),
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

    cargarInput1: archivo => subir('/movil/input1', archivo, 'Objetivo de Contraloría cargado.'),
    cargarBase: archivo => subir('/movil/base', archivo, 'Mes anterior cargado.'),
    cargarInput2: archivo => subir('/movil/input2', archivo, 'Totales por canal cargados.'),
    editarTotales: texto => cambiar(() => api.put('/movil/input2', { texto }), enDialogo),
    cargarMuestra: () => cambiar(() => api.post('/movil/muestra', {})),

    cambiarSku: (sku, activo, motivo) =>
      cambiar(() => api.put(`/movil/skus/${ruta(sku)}`, { activo, motivo }), enDialogo),
    cambiarEntidad: (entidad, activo, motivo) =>
      cambiar(() => api.put(`/movil/entidades/${ruta(entidad)}`, { activo, motivo }), enDialogo),
    fijar: (sku, canal, monto, motivo) =>
      cambiar(() => api.put(`/movil/celdas/${ruta(get().unidad, sku, canal)}`, { monto, motivo }), enDialogo),
    desfijar: (sku, canal, motivo) =>
      cambiar(() => api.delete(`/movil/celdas/${ruta(get().unidad, sku, canal)}`, { data: { motivo } }), enDialogo),

    agregarRegla: (datos, motivo) => cambiar(() => api.post('/movil/reglas', { ...datos, motivo }), enDialogo),
    editarRegla: (id, datos, motivo) =>
      cambiar(() => api.put(`/movil/reglas/${ruta(id)}`, { ...datos, motivo }), enDialogo),
    eliminarRegla: (id, motivo) =>
      cambiar(() => api.delete(`/movil/reglas/${ruta(id)}`, { data: { motivo } }), enDialogo),

    elegirFila: (sku, fila, motivo) =>
      cambiar(() => api.put(`/movil/skus/${ruta(sku)}/fila`, { fila, motivo }), enDialogo),

    elegirCanales: (sku, canales, motivo) =>
      cambiar(() => api.put(`/movil/skus/${ruta(sku)}/canales`, { canales, motivo }), enDialogo),
    quitarCanales: (sku, motivo) =>
      cambiar(() => api.delete(`/movil/skus/${ruta(sku)}/canales`, { data: { motivo } }), enDialogo),
    deshacer: () => cambiar(() => api.post('/movil/deshacer', {})),

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
