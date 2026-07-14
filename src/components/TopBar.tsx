import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useStore } from "../store/useStore";
import { useCajaStore } from "../store/useCajaStore";
import OfflineIndicator from "./OfflineIndicator";
import { fmtCLP } from "../utils/format";

const NAV = [
  { id: "pos",          label: "Venta",       icon: "🛒", tecla: "F1", rol: ["admin","supervisor","cajero"] },
  { id: "dashboard",    label: "Dashboard",   icon: "📊", tecla: "F2", rol: ["admin","supervisor"] },
  { id: "inventario",   label: "Inventario",  icon: "📦", tecla: "F3", rol: ["admin","supervisor"] },
  { id: "clientes",     label: "Clientes",    icon: "👥", tecla: "F5", rol: ["admin","supervisor","cajero"] },
  { id: "proveedores",  label: "Proveedores", icon: "🚚", tecla: "F6", rol: ["admin","supervisor"] },
  { id: "reportes",     label: "Reportes",    icon: "📈", tecla: "F7", rol: ["admin","supervisor"] },
  { id: "cierre_caja",  label: "Caja",        icon: "💰", tecla: "F8", rol: ["admin","supervisor","cajero"] },
  { id: "configuracion",label: "Config",      icon: "⚙️",  tecla: "F12",rol: ["admin"] },
];

interface TopBarProps {
  pagina: string;
  setPagina: (p: string) => void;
}

export default function TopBar({ pagina, setPagina }: TopBarProps) {
  const { usuario, logout } = useAuthStore();
  const carrito = useStore((s) => s.carrito);
  const { totalDelTurno, ventasDelTurno } = useCajaStore();
  const [hora, setHora] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const navFiltrado = NAV.filter((n) =>
    usuario?.rol && n.rol.includes(usuario.rol)
  );

  const totalCarrito = carrito.reduce((a, i) => a + i.cantidad, 0);

  return (
    <div className="flex items-center gap-2 px-3 h-11 bg-[#0d0d16] border-b border-[#1a1a2e] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-1 shrink-0">
        <span className="text-base">🏪</span>
        <span className="text-white font-semibold text-[12px]">MiniPOS</span>
      </div>

      <div className="w-px h-4 bg-[#1e1e2e] mx-1" />

      {/* Nav */}
      <nav className="flex gap-0.5 flex-1 overflow-hidden">
        {navFiltrado.map((n) => (
          <button
            key={n.id}
            onClick={() => setPagina(n.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
              pagina === n.id
                ? "bg-[#1e3a5f] text-blue-300"
                : "text-[#4d4d6a] hover:text-white hover:bg-[#1a1a2e]"
            }`}
          >
            <span className="text-[13px]">{n.icon}</span>
            {n.label}
            <span className={`font-mono text-[9px] px-1 rounded ${
              pagina === n.id ? "bg-blue-500/30 text-blue-300" : "bg-[#1e1e2e] text-[#3d3d5c]"
            }`}>{n.tecla}</span>
            {n.id === "pos" && totalCarrito > 0 && (
              <span className="bg-green-500 text-white text-[9px] rounded-full px-1.5 leading-none py-0.5">
                {totalCarrito}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Derecha */}
      <div className="flex items-center gap-3 ml-auto shrink-0">
        <OfflineIndicator />
        <div className="w-px h-4 bg-[#1e1e2e]" />
        <div className="text-[11px] text-[#4d4d6a]">
          Turno: <span className="text-[#8080a0]">{fmtCLP(totalDelTurno)}</span>
          <span className="ml-1 text-[#3d3d5c]">({ventasDelTurno} ventas)</span>
        </div>
        <div className="w-px h-4 bg-[#1e1e2e]" />
        <div className="text-[11px] text-[#6060a0]">
          {hora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
        <div className="w-px h-4 bg-[#1e1e2e]" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#6060a0]">👤 {usuario?.nombre}</span>
          <button
            onClick={logout}
            className="text-[10px] text-[#3d3d5c] hover:text-red-400 transition-colors px-2 py-1 rounded border border-[#1e1e2e] hover:border-red-500/30"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}