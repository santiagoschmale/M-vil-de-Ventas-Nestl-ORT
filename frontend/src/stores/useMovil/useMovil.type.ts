// Espejo de /api/movil. Los montos son texto con los decimales de su unidad:
// el front no suma ni redondea, sólo muestra.

export type Unidad = 'kilos' | 'plata';
export type Monto = string;

export type Ajuste = {
  accion: string;
  detalle: string;
  autor: string;
  cuando: string;
  motivo: string | null;
};

export type Inconsistencia = {
  tipo: string;
  mensaje: string;
  skus: string[];
  canales: string[];
  diferencia: Monto | null;
};

export type Problema = {
  severidad: 'error' | 'aviso';
  mensaje: string;
  sku: string | null;
  bloque: string | null;
};

export type Estado = {
  faltan: string[];
  entradas: {
    input1: { archivo: string; skus: number; kilos: Monto; nns: Monto } | null;
    input2: { canales: number; texto: string; kilos: Monto; plata: Monto } | null;
    base: { archivo: string; celdas: number; aperturas: number } | null;
  };
  cierra: Record<Unidad, boolean>;
  inconsistencias: Record<Unidad, Inconsistencia[]>;
  avisos: Record<Unidad, string[]>;
  problemas: Problema[];
  apagados: {
    skus: (Ajuste & { codigo: string })[];
    entidades: (Ajuste & { nombre: string })[];
  };
  fijas: Record<Unidad, (Ajuste & { sku: string; canal: string; valor: Monto })[]>;
  historial: Ajuste[];
};

export type Celda = { monto: Monto; fijada: boolean };

export type Cruce = {
  unidad: Unidad;
  cierra: boolean;
  canales: { nombre: string; pedido: Monto | null; repartido: Monto }[];
  skus: {
    codigo: string;
    descripcion: string;
    objetivo: Monto | null;
    activo: boolean;
    celdas: Record<string, Celda>;
  }[];
};

export type Apertura = {
  sku: string;
  canal: string;
  kilos: Monto;
  plata: Monto;
  cuadra: Record<Unidad, boolean>;
  aviso: string | null;
  entidades: { nombre: string; activo: boolean; peso: string; kilos: Monto; plata: Monto }[];
};

/** null si salió bien; si no, el mensaje de error para mostrar. */
type Resultado = Promise<string | null>;

export type TUseMovil = {
  estado?: Estado;
  cruce?: Cruce;
  unidad: Unidad;
  ocupado: boolean;
  errorDeCarga?: string;
  refrescar: () => Promise<void>;
  elegirUnidad: (unidad: Unidad) => Promise<void>;
  cargarInput1: (archivo: File) => Resultado;
  cargarInput2: (texto: string) => Resultado;
  cargarBase: (archivo: File) => Resultado;
  cargarMuestra: () => Resultado;
  cambiarSku: (sku: string, activo: boolean, motivo: string) => Resultado;
  cambiarEntidad: (entidad: string, activo: boolean, motivo: string) => Resultado;
  fijar: (sku: string, canal: string, monto: string, motivo: string) => Resultado;
  desfijar: (sku: string, canal: string, motivo: string) => Resultado;
  apertura: (sku: string, canal: string) => Promise<Apertura | null>;
};
