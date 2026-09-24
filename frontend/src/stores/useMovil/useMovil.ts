import { create } from 'zustand';
import { api } from '../../infra/http';
import { useSnackbarProps } from '../useSnackbarProps';
import { Apertura, Cruce, Estado, TUseMovil } from './useMovil.type';

// Los errores del cliente HTTP traen la respuesta del backend: { detail: "..." }.
const respuesta = (e: unknown) =>
  (e as { response?: { status?: number; data?: { detail?: unknown } } })?.response;

const avisarError = (e: unknown) => {
  const detalle = respuesta(e)?.data?.detail;
  const message = typeof detalle === 'string' ? detalle : 'No se pudo hablar con el servidor. Probá de nuevo.';
  useSnackbarProps.getState().setSnackbarProps({ message, severity: 'error' });
};

const ruta = (...partes: string[]) => partes.map(encodeURIComponent).join('/');

export const useMovil = create<TUseMovil>((set, get) => {
  const traerCruce = async (estado: Estado) => {
    if (estado.faltan.length) return set({ cruce: undefined });
    const cruce = (await api.get<Cruce>(`/movil/cruce/${get().unidad}`)).data;
    set({ cruce });
  };

  // Todo cambio devuelve el estado nuevo; después se trae la matriz de la unidad elegida.
  const cambiar = async (pedido: () => Promise<{ data: Estado }>) => {
    set({ ocupado: true });
    try {
      const estado = (await pedido()).data;
      set({ estado });
      await traerCruce(estado);
      return true;
    } catch (e) {
      avisarError(e);
      return false;
    } finally {
      set({ ocupado: false });
    }
  };

  const subir = (url: string, archivo: File) => {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return cambiar(() => api.upload<Estado>(url, datos));
  };

  return {
    estado: undefined,
    cruce: undefined,
    unidad: 'kilos',
    ocupado: false,

    refrescar: async () => { await cambiar(() => api.get<Estado>('/movil')); },

    elegirUnidad: async unidad => {
      set({ unidad });
      const { estado } = get();
      if (estado) await traerCruce(estado).catch(avisarError);
    },

    cargarInput1: archivo => subir('/movil/input1', archivo),
    cargarBase: archivo => subir('/movil/base', archivo),
    cargarInput2: texto => cambiar(() => api.put('/movil/input2', { texto })),
    cargarMuestra: () => cambiar(() => api.post('/movil/muestra', {})),

    cambiarSku: (sku, activo, motivo) =>
      cambiar(() => api.put(`/movil/skus/${ruta(sku)}`, { activo, motivo })),
    cambiarEntidad: (entidad, activo, motivo) =>
      cambiar(() => api.put(`/movil/entidades/${ruta(entidad)}`, { activo, motivo })),
    fijar: (sku, canal, monto, motivo) =>
      cambiar(() => api.put(`/movil/celdas/${ruta(get().unidad, sku, canal)}`, { monto, motivo })),
    desfijar: (sku, canal, motivo) =>
      cambiar(() => api.delete(`/movil/celdas/${ruta(get().unidad, sku, canal)}`, { data: { motivo } })),

    apertura: async (sku, canal) => {
      try {
        return (await api.get<Apertura>(`/movil/apertura/${ruta(sku, canal)}`)).data;
      } catch (e) {
        if (respuesta(e)?.status === 404) return null; // la celda no se abre debajo del canal
        avisarError(e);
        return null;
      }
    },
  };
});
