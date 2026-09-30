// Espejo de /api/movil. Los montos son texto con los decimales de su unidad:
// el front no suma ni redondea, sólo muestra.

export type Unidad = 'kilos' | 'plata';
export type Etapa = 'canal' | 'apertura';
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
  reglas: string[];
};

export type Limite = 'tope' | 'minimo' | 'fijo';

/** Lo que carga el planner. Los % van como texto; null = en esa unidad no aplica. */
export type DatosRegla = {
  canal: string;
  categorias: string[];
  limite: Limite;
  kilos: string | null;
  nns: string | null;
};

export type Regla = DatosRegla & Ajuste & { id: string };

export type Problema = {
  severidad: 'error' | 'aviso';
  mensaje: string;
  sku: string | null;
  bloque: string | null;
  tipo?: string | null; // p. ej. 'sku_repetido': la pantalla ofrece resolverlo
  canal?: string | null; // si es de una celda SKU × canal
};

/** Un SKU repetido en el objetivo de Contraloría: sus filas del Excel y cuál vale. */
export type Repetido = {
  sku: string;
  elegida: number;
  filas: { fila: number; descripcion: string; kilos: Monto; nns: Monto | null }[];
};

export type Estado = {
  faltan: string[];
  entradas: {
    input1: { archivo: string; skus: number; kilos: Monto; nns: Monto } | null;
    input2: {
      archivo: string | null; // null: editados a mano en la pantalla
      canales: number;
      kilos: Monto;
      plata: Monto;
      detalle: { canal: string; kilos: Monto; plata: Monto | null }[];
    } | null;
    // canales: kilos por canal del mes anterior, para arrancar los totales en la pantalla.
    base: { archivo: string; celdas: number; aperturas: number; canales: { canal: string; kilos: Monto }[] } | null;
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
  reglas: Regla[];
  repetidos: Repetido[];
  canales_sku: (Ajuste & { sku: string; canales: string[] })[]; // "Dónde se vende"
  opciones: { canales: string[]; categorias: string[] };
  historial: Ajuste[];
  deshacer: Ajuste | null; // el último cambio, si se puede deshacer (una sola vez)
  aprobado: Ajuste | null; // quién aprobó y cuándo; mientras no sea null, es de solo lectura
  etapas: { etapa: Etapa; revisada: Ajuste | null }[]; // revisión por etapa, en orden; solo las que aplican
  porcentajes: (Ajuste & { canal: string; entidad: string; porcentaje: string })[]; // base de cálculo manual
  entidades_nuevas: (Ajuste & { canal: string; entidad: string })[]; // altas hechas en la herramienta
  porcentaje_asignado: Record<string, string>; // canal -> % manual asignado en total
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
  // porcentaje: % manual (base de cálculo) o null si va por histórico.
  // nueva: dada de alta en la herramienta (sin historia); se puede eliminar.
  entidades: {
    nombre: string; activo: boolean; peso: string; porcentaje: string | null; nueva: boolean; kilos: Monto; plata: Monto;
  }[];
};

/** null si salió bien; si no, el mensaje de error para mostrar. */
type Resultado = Promise<string | null>;

/** A qué fila fue a mirar el planner desde "Para revisar". `vez` cambia en cada clic. */
export type Foco = { tipo: 'regla' | 'sku' | 'celda'; id: string; vez: number }; // celda: "sku|canal"

export type TUseMovil = {
  foco?: Foco;
  enfocar: (tipo: Foco['tipo'], id: string) => void;
  soltarFoco: () => void;
  estado?: Estado;
  cruce?: Cruce;
  unidad: Unidad;
  ocupado: boolean;
  errorDeCarga?: string;
  refrescar: () => Promise<void>;
  elegirUnidad: (unidad: Unidad) => Promise<void>;
  cargarInput1: (archivo: File) => Resultado;
  cargarInput2: (archivo: File) => Resultado;
  editarTotales: (texto: string) => Resultado;
  cargarBase: (archivo: File) => Resultado;
  cargarMuestra: (totales?: boolean) => Resultado;
  cambiarSku: (sku: string, activo: boolean, motivo: string) => Resultado;
  cambiarEntidad: (entidad: string, activo: boolean, motivo: string) => Resultado;
  fijar: (sku: string, canal: string, monto: string, motivo: string) => Resultado;
  desfijar: (sku: string, canal: string, motivo: string) => Resultado;
  apertura: (sku: string, canal: string) => Promise<Apertura | null>;
  agregarRegla: (datos: DatosRegla, motivo: string) => Resultado;
  editarRegla: (id: string, datos: DatosRegla, motivo: string) => Resultado;
  eliminarRegla: (id: string, motivo: string) => Resultado;
  elegirFila: (sku: string, fila: number, motivo: string) => Resultado;
  elegirCanales: (sku: string, canales: string[], motivo: string) => Resultado;
  quitarCanales: (sku: string, motivo: string) => Resultado;
  deshacer: () => Resultado;
  aprobar: () => Resultado;
  reabrir: (motivo: string) => Resultado;
  revisarEtapa: (etapa: Etapa) => Resultado;
  asignarPorcentaje: (canal: string, entidad: string, porcentaje: string | null, motivo: string) => Resultado;
  agregarEntidad: (canal: string, entidad: string, porcentaje: string, motivo: string) => Resultado;
  eliminarEntidad: (canal: string, entidad: string, motivo: string) => Resultado;
};
