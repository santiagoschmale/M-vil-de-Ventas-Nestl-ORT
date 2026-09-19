// Tipos compartidos entre apps/web y apps/api.
// Reflejan las entidades de packages/db/prisma/schema.prisma pero sin
// depender del Prisma Client (para que el front no cargue esa lib).

export type EntidadTipo = "canal" | "territorio" | "vendedor" | "distribuidor";

export type OrigenParticipacion = "historico" | "manual";

export interface Sku {
  sku_id: number;
  codigo: string;
  nombre: string;
  categoria: string | null;
  activo: boolean;
}

export interface Canal {
  canal_id: number;
  nombre: string;
  profundidad_maxima: EntidadTipo;
}

export interface ObjetivoTotal {
  objetivo_id: number;
  sku_id: number;
  periodo: string; // 'YYYY-MM'
  kilos: string; // Decimal serializado como string en la API
  facturacion: string;
}

export interface Participacion {
  participacion_id: string; // BigInt serializado como string en la API
  sku_id: number;
  periodo: string;
  entidad_tipo: EntidadTipo;
  entidad_id: number;
  parent_participacion_id: string | null;
  porcentaje: string;
  origen: OrigenParticipacion;
  kilos_calculados: string | null;
  aprobado: boolean;
}
