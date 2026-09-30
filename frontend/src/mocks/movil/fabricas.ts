import { Factory } from 'fishery';
import { Ajuste, Cruce, Estado, Inconsistencia, Regla } from '../../stores/useMovil/useMovil.type';

// Datos de prueba con la forma de /api/movil. Arman objetos válidos para el tipo,
// no verdaderos: un Cruce de acá puede decir que cierra sin sumar. Los números que
// cierran los garantizan los tests del backend; el front solo muestra.

const ajuste: Ajuste = {
  accion: 'agregar_regla', detalle: '', autor: 'planner-local', cuando: '2026-09-24T10:00:00-03:00', motivo: 'x',
};

export const reglaFactory = Factory.define<Regla>(({ sequence }) => ({
  ...ajuste,
  id: `R${sequence}`,
  canal: 'Catering',
  categorias: ['Café'],
  limite: 'tope',
  kilos: '20',
  nns: '25',
  motivo: 'acuerdo con la cadena',
}));

export const inconsistenciaFactory = Factory.define<Inconsistencia>(() => ({
  tipo: 'reglas_en_conflicto',
  mensaje: 'Las reglas R1 y R2 no se pueden cumplir a la vez con los totales del mes.',
  skus: [],
  canales: ['Catering'],
  diferencia: null,
  reglas: ['R1', 'R2'],
}));

const vacio = () => ({ kilos: [], plata: [] });

export const estadoFactory = Factory.define<Estado>(() => ({
  faltan: [],
  entradas: {
    input1: { archivo: 'objetivo_septiembre.xlsx', skus: 2, kilos: '1500.000', nns: '100.00' },
    input2: {
      archivo: 'totales_septiembre.xlsx', canales: 2, kilos: '1500.000', plata: '100.00',
      detalle: [{ canal: 'Catering', kilos: '1000.000', plata: '60.00' },
                { canal: 'Directa (BA)', kilos: '500.000', plata: '40.00' }],
    },
    base: { archivo: 'reparto_agosto.xlsx', celdas: 3, aperturas: 1,
      canales: [{ canal: 'Catering', kilos: '950.000' }, { canal: 'Directa (BA)', kilos: '480.000' }] },
  },
  cierra: { kilos: true, plata: true },
  inconsistencias: vacio(),
  avisos: vacio(),
  problemas: [],
  apagados: { skus: [], entidades: [] },
  fijas: vacio(),
  reglas: [],
  repetidos: [],
  canales_sku: [],
  opciones: { canales: ['Catering', 'Directa (BA)'], categorias: ['Café', 'Chocolatería', 'Lácteos'] },
  historial: [],
  deshacer: null,
  aprobado: null,
  etapas: [
    { etapa: 'canal', revisada: { accion: 'revisar_etapa', detalle: 'Revisó la etapa por canal', autor: 'planner-local', cuando: '2026-09-24T10:00:00', motivo: null } },
    { etapa: 'apertura', revisada: { accion: 'revisar_etapa', detalle: 'Revisó la etapa debajo del canal', autor: 'planner-local', cuando: '2026-09-24T10:00:00', motivo: null } },
  ],
  porcentajes: [],
  entidades_nuevas: [],
  porcentaje_asignado: {},
}));

export const cruceFactory = Factory.define<Cruce>((): Cruce => ({
  unidad: 'kilos',
  cierra: true,
  canales: [
    { nombre: 'Catering', pedido: '1000.000', repartido: '1000.000' },
    { nombre: 'Directa (BA)', pedido: '500.000', repartido: '499.999' },
  ],
  skus: [
    { codigo: '100', descripcion: 'Café 1 kg', objetivo: '1500.000', activo: true,
      celdas: { Catering: { monto: '1000.000', fijada: false },
                'Directa (BA)': { monto: '12345678901234567.891', fijada: true } } },
    { codigo: '200', descripcion: 'SKU nuevo', objetivo: '0.000', activo: true, celdas: {} },
  ],
}));
