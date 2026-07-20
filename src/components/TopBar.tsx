import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useStore } from "../store/useStore";
import { useCajaStore } from "../store/useCajaStore";
import { useOffline } from "../hooks/useOffline";
import { fmtCLP } from "../utils/format";

const NAV = [
  { id: "pos",          label: "Venta",      tecla: "F1",  rol: ["admin","supervisor","cajero"] },
  { id: "dashboard",    label: "Dashboard",  tecla: "F2",  rol: ["admin","supervisor"] },
  { id: "inventario",   label: "Inventario", tecla: "F3",  rol: ["admin","supervisor"] },
  { id: "clientes",     label: "Clientes",   tecla: "F5",  rol: ["admin","supervisor","cajero"] },
  { id: "proveedores",  label: "Proveedores",tecla: "F6",  rol: ["admin","supervisor"] },
  { id: "reportes",     label: "Reportes",   tecla: "F7",  rol: ["admin","supervisor"] },
  { id: "cierre_caja",  label: "Caja",       tecla: "F8",  rol: ["admin","supervisor","cajero"] },
  { id: "configuracion",label: "Config",     tecla: "F12", rol: ["admin"] },
];

interface TopBarProps {
  pagina: string;
  setPagina: (p: string) => void;
}

export default function TopBar({ pagina, setPagina }: TopBarProps) {
  const { usuario, logout } = useAuthStore();
  const tickets = useStore(s => s.tickets);
  const { totalDelTurno, ventasDelTurno } = useCajaStore();
  const offline = useOffline();
  const [hora, setHora] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const navFiltrado = NAV.filter(n => usuario?.rol && n.rol.includes(usuario.rol));
  const totalCarrito = tickets.find(t => t.id)?.items.reduce((a, i) => a + i.cantidad, 0) ?? 0;

  return (
    <header className="topbar">

      {/* Logo */}
      <div className="topbar-logo">MiniPOS</div>

      {/* Separador */}
      <div style={{ width: 1, height: 20, background: "var(--border-default)", flexShrink: 0 }} />

      {/* Navegación */}
      <nav style={{ display: "flex", gap: 2, flex: 1, overflow: "hidden" }}>
        {navFiltrado.map(n => (
          <button
            key={n.id}
            onClick={() => setPagina(n.id)}
            className={`nav-item${pagina === n.id ? " active" : ""}`}
          >
            {n.label}
            <span className="kbd">{n.tecla}</span>
            {n.id === "pos" && totalCarrito > 0 && (
              <span style={{
                background: "var(--success)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 10,
                padding: "1px 6px",
                lineHeight: 1.4,
              }}>
                {totalCarrito}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Derecha */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexShrink: 0 }}>

        {/* Estado conexión */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: offline ? "var(--warning)" : "var(--success)",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: "var(--text-xs)", color: offline ? "var(--warning)" : "var(--text-muted)" }}>
            {offline ? "Sin conexión" : "En línea"}
          </span>
        </div>

        <div style={{ width: 1, height: 16, background: "var(--border-default)" }} />

        {/* Turno */}
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          Turno{" "}
          <span style={{ color: "var(--success)", fontWeight: 600 }}>
            {fmtCLP(totalDelTurno)}
          </span>
          <span style={{ color: "var(--text-disabled)", marginLeft: 4 }}>
            {ventasDelTurno} vta{ventasDelTurno !== 1 ? "s" : ""}
          </span>
        </div>

        <div style={{ width: 1, height: 16, background: "var(--border-default)" }} />

        {/* Reloj */}
        <span style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}>
          {hora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>

        <div style={{ width: 1, height: 16, background: "var(--border-default)" }} />

        {/* Usuario */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
            {usuario?.nombre}
          </span>
          <span className={`badge badge-${usuario?.rol}`}>{usuario?.rol}</span>
          <button
            onClick={logout}
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}