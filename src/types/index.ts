export type Rol = "admin" | "supervisor" | "cajero";
export type MetodoPago = "efectivo" | "debito" | "credito" | "transferencia" | "mixto";
export type EstadoVenta = "completada" | "anulada" | "pendiente";
export type TipoMovimiento = "entrada" | "salida" | "ajuste" | "merma" | "vencimiento";
export type EstadoTurno = "abierto" | "cerrado";

export interface Usuario {
  id?: number;
  nombre: string;
  pin_hash: string;
  rol: Rol;
  activo: boolean;
  created_at?: string;
}

export interface Categoria {
  id?: number;
  nombre: string;
  color: string;
}

export interface Proveedor {
  id?: number;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
}

export interface Producto {
  id?: number;
  nombre: string;
  codigo_barra: string;
  precio_venta: number;
  precio_costo: number;
  stock: number;
  stock_minimo: number;
  categoria_id: number;
  categoria_nombre?: string;
  proveedor_id?: number;
  fecha_vencimiento?: string;
  activo: boolean;
  unidad: string;
}

export interface ItemVenta {
  producto_id: number;
  nombre: string;
  precio_unitario: number;
  precio_costo: number;
  cantidad: number;
  descuento: number;
  subtotal: number;
}

export interface Venta {
  id?: number;
  usuario_id: number;
  turno_id: number;
  cliente_id?: number;
  items: ItemVenta[];
  subtotal: number;
  iva: number;
  total: number;
  monto_pagado: number;
  vuelto: number;
  metodo_pago: MetodoPago;
  estado: EstadoVenta;
  fecha?: string;
  sincronizada?: boolean;
}

export interface TurnoCaja {
  id?: number;
  usuario_id: number;
  usuario_nombre?: string;
  monto_inicial: number;
  monto_final_esperado?: number;
  monto_final_real?: number;
  diferencia?: number;
  apertura?: string;
  cierre?: string;
  estado: EstadoTurno;
}

export interface Cliente {
  id?: number;
  nombre: string;
  telefono: string;
  rut: string;
  saldo_fiado: number;
  puntos: number;
  created_at?: string;
}

export interface MovimientoInventario {
  id?: number;
  producto_id: number;
  producto_nombre?: string;
  usuario_id: number;
  tipo: TipoMovimiento;
  cantidad: number;
  costo_unitario: number;
  motivo: string;
  fecha?: string;
}

export interface Auditoria {
  id?: number;
  usuario_id: number;
  usuario_nombre?: string;
  accion: string;
  tabla: string;
  detalle: string;
  fecha?: string;
}

export interface ResumenDashboard {
  ventasHoy: number;
  totalHoy: number;
  ticketPromedio: number;
  productosStockBajo: number;
  ventasPorMetodo: { metodo: string; total: number }[];
  topProductos: { nombre: string; cantidad: number; total: number }[];
}