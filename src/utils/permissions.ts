import { Rol } from "../types";

const PERMISOS: Record<string, Rol[]> = {
  verReportes: ["admin", "supervisor"],
  anularVenta: ["admin", "supervisor"],
  editarProductos: ["admin", "supervisor"],
  verCostos: ["admin", "supervisor"],
  gestionarUsuarios: ["admin"],
  abrirCaja: ["admin", "supervisor", "cajero"],
  verDashboard: ["admin", "supervisor"],
  hacerVenta: ["admin", "supervisor", "cajero"],
};

export function tienePermiso(rol: Rol, permiso: string): boolean {
  return PERMISOS[permiso]?.includes(rol) ?? false;
}