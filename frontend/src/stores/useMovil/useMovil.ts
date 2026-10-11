import { create } from 'zustand';
import { api } from '../../infra/http';
import { useSnackbarProps } from '../useSnackbarProps';
import { Apertura, Cruce, Estado, MesResumen, TUseMovil } from './useMovil.type';

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
  // El aviso si salió bien, cuando no es un recálculo (aprobar, reabrir).
  aviso?: string;
};

// El aviso dura unos segundos: corto e informativo. Si cierra o no ya se ve en el encabezado.
const RECALCULADO = 'Reparto recalculado.';
const TOTALES_CARGADOS = 'Totales por canal cargados.';

/** Lo que se está viendo del último mes, o un mes anterior. */
const viendoAnterior = (s: { mes?: string; meses: MesResumen[] }) =>
  s.mes !== undefined && s.mes !== s.meses[s.meses.length - 1]?.mes;

/**
 * Aprobado, o un mes anterior, es de solo lectura: lo que edita se deshabilita (el backend
 * igual lo rechaza). Por eso las acciones van siempre al último mes, sin ?mes.
 */
export const useSoloLectura = () => useMovil(s => !!s.estado?.aprobado || viendoAnterior(s));

/** El mes, legible: "2026-10" → "octubre 2026". */
export const nombreMes = (mes: string) => {
  const [anio, m] = mes.split('-').map(Number);
  return `${new Date(anio, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' })} ${anio}`;
};

export const useMovil = create<TUseMovil>((set, get) => {
  // Las lecturas van al mes que se está viendo.
  const conMes = (url: string) => (get().mes ? `${url}${url.includes('?') ? '&' : '?'}mes=${get().mes}` : url);
  const traerMeses = async () => set({ meses: (await api.get<MesResumen[]>('/movil/meses')).data });

  const traerCruce = async (estado: Estado) => {
    if (estado.faltan.length) return set({ cruce: undefined });
    const { unidad } = get();
    const cruce = (await api.get<Cruce>(conMes(`/movil/cruce/${unidad}`))).data;
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
      avisar(opciones.aviso ?? (estado.faltan.length ? opciones.cargado ?? 'Guardado.' : RECALCULADO), 'info');
      return null;
    } catch (e) {
      const mensaje = mensajeDeError(e);
      if (!opciones.errorEnDialogo) avisar(mensaje, 'error');
      // Un rechazo puede ser porque otro planner cambió el móvil (p. ej. lo aprobó): traer el estado real.
      if (respuesta(e)?.status === 422) {
        api.get<Estado>(conMes('/movil')).then(r => set({ estado: r.data })).catch(() => undefined);
        traerMeses().catch(() => undefined);
      }
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
    mes: undefined,
    meses: [],
    unidad: 'kilos',
    ocupado: false,
    errorDeCarga: undefined,

    refrescar: async () => {
      set({ ocupado: true });
      try {
        const estado = (await api.get<Estado>(conMes('/movil'))).data;
        set({ estado, errorDeCarga: undefined });
        // Si falla la lista de meses, el móvil se ve igual.
        await Promise.all([traerCruce(estado), traerMeses().catch(() => undefined)]);
      } catch (e) {
        set({ errorDeCarga: mensajeDeError(e) });
      } finally {
        set({ ocupado: false });
      }
    },

    asignarCategorias: (categorias, motivo) =>
      cambiar(() => api.put('/movil/categorias', { categorias, motivo }), { ...enDialogo, aviso: 'Categorías guardadas.' }),
    cargarCategorias: archivo => {
      const datos = new FormData();
      datos.append('archivo', archivo);
      return cambiar(() => api.upload<Estado>('/movil/categorias', datos), { ...enDialogo, aviso: 'Categorías cargadas.' });
    },

    cambiarAperturaCanal: (canal, abre, motivo) =>
      cambiar(() => api.put(`/movil/aperturas/${ruta(canal)}`, { abre, motivo }), enDialogo),

    verMes: async mes => {
      set({ mes, cruce: undefined, foco: undefined });
      await get().refrescar();
    },
    empezarSiguiente: async () => {
      const falla = await cambiar(() => api.post('/movil/meses/siguiente', {}),
        { errorEnDialogo: true, aviso: 'Mes nuevo: cargá el objetivo de Contraloría.' });
      if (!falla) {
        set({ mes: undefined });
        await traerMeses();
      }
      return falla;
    },

    elegirUnidad: async unidad => {
      set({ unidad });
      const { estado } = get();
      if (estado) await traerCruce(estado).catch(e => avisar(mensajeDeError(e), 'error'));
    },

    cargarInput1: archivo => subir('/movil/input1', archivo, 'Objetivo de Contraloría cargado.'),
    cargarBase: archivo => subir('/movil/base', archivo, 'Mes anterior cargado.'),
    cargarInput2: archivo => subir('/movil/input2', archivo, TOTALES_CARGADOS),
    editarTotales: texto =>
      cambiar(() => api.put('/movil/input2', { texto }), { ...enDialogo, cargado: TOTALES_CARGADOS }),
    // Sin totales: objetivo y mes anterior, para armar los totales por canal en la pantalla.
    cargarMuestra: (totales = true) => cambiar(() => api.post(`/movil/muestra?totales=${totales}`, {}),
      totales ? {} : { cargado: 'Muestra cargada sin totales por canal: armalos en la pantalla.' }),

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
    aprobar: async () => {
      const falla = await cambiar(() => api.post('/movil/aprobar', {}), { errorEnDialogo: true, aviso: 'Móvil aprobado.' });
      if (!falla) await traerMeses();
      return falla;
    },
    asignarPorcentaje: (canal, entidad, porcentaje, motivo) =>
      cambiar(() => api.put('/movil/porcentajes', { canal, entidad, porcentaje, motivo }), enDialogo),
    agregarEntidad: (canal, entidad, porcentaje, motivo) =>
      cambiar(() => api.post('/movil/entidades', { canal, entidad, porcentaje, motivo }), enDialogo),
    eliminarEntidad: (canal, entidad, motivo) =>
      cambiar(() => api.delete('/movil/entidades', { data: { canal, entidad, motivo } }), enDialogo),
    revisarEtapa: etapa => cambiar(() => api.post(`/movil/etapas/${ruta(etapa)}`, {}), { aviso: 'Etapa revisada.' }),
    reabrir: async motivo => {
      const falla = await cambiar(() => api.post('/movil/reabrir', { motivo }),
        { errorEnDialogo: true, aviso: 'El móvil volvió a borrador.' });
      if (!falla) await traerMeses();
      return falla;
    },

    apertura: async (sku, canal) => {
      try {
        return (await api.get<Apertura>(conMes(`/movil/apertura/${ruta(sku, canal)}`))).data;
      } catch (e) {
        if (respuesta(e)?.status !== 404) avisar(mensajeDeError(e), 'error'); // 404: no se abre debajo del canal
        return null;
      }
    },
  };
});
