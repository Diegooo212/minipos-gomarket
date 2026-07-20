import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { useAuthStore } from "./store/useAuthStore";
import { useCajaStore } from "./store/useCajaStore";
import { useStore } from "./store/useStore";
import { getDB } from "./db/database";
import { tienePermiso } from "./utils/permissions";
import PinLogin from "./components/PinLogin";
import TopBar from "./components/TopBar";
import POS from "./pages/POS";
import Dashboard from "./pages/Dashboard";
import Inventario from "./pages/Inventario";
import Clientes from "./pages/Clientes";
import Proveedores from "./pages/Proveedores";
import Reportes from "./pages/Reportes";
import CierreCaja from "./pages/CierreCaja";
import Configuracion from "./pages/Configuracion";

// Página por defecto según rol
function paginaInicialPorRol(rol: string): string {
  switch (rol) {
    case "admin":      return "dashboard";
    case "supervisor": return "dashboard";
    case "cajero":     return "pos";
    default:           return "pos";
  }
}

export default function App() {
  const { usuario } = useAuthStore();
  const { setTurno } = useCajaStore();
  const { paginaActual, setPagina } = useStore();

  // Al hacer login → redirigir a la página correcta según rol
  useEffect(() => {
    if (!usuario) return;
    const paginaInicial = paginaInicialPorRol(usuario.rol);
    setPagina(paginaInicial);
  }, [usuario?.id]); // Solo cuando cambia el usuario (no en cada render)

  // Al hacer login → buscar turno abierto
  useEffect(() => {
    if (!usuario) return;
    (async () => {
      const db = await getDB();
      const rows = await db.select<any[]>(
        "SELECT * FROM turnos_caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1"
      );
      if (rows.length > 0) setTurno(rows[0]);
    })();
  }, [usuario?.id]);

  // Atajos de teclado globales — solo para páginas que el rol puede ver
  useEffect(() => {
    if (!usuario) return;
    const handler = (e: KeyboardEvent) => {
      const mapa: Record<string, { pagina: string; permiso: string }> = {
        F1:  { pagina: "pos",          permiso: "hacerVenta" },
        F2:  { pagina: "dashboard",    permiso: "verDashboard" },
        F3:  { pagina: "inventario",   permiso: "editarProductos" },
        F5:  { pagina: "clientes",     permiso: "hacerVenta" },
        F6:  { pagina: "proveedores",  permiso: "editarProductos" },
        F7:  { pagina: "reportes",     permiso: "verReportes" },
        F8:  { pagina: "cierre_caja",  permiso: "abrirCaja" },
        F12: { pagina: "configuracion",permiso: "gestionarUsuarios" },
      };
      const destino = mapa[e.key];
      if (destino && tienePermiso(usuario.rol, destino.permiso)) {
        e.preventDefault();
        setPagina(destino.pagina);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [usuario]);

  // Guardia de página — si el usuario no tiene permiso para la página actual, redirige
  useEffect(() => {
    if (!usuario) return;
    const permisosPorPagina: Record<string, string> = {
      dashboard:     "verDashboard",
      inventario:    "editarProductos",
      proveedores:   "editarProductos",
      reportes:      "verReportes",
      configuracion: "gestionarUsuarios",
    };
    const permiso = permisosPorPagina[paginaActual];
    if (permiso && !tienePermiso(usuario.rol, permiso)) {
      setPagina(paginaInicialPorRol(usuario.rol));
    }
  }, [paginaActual, usuario]);

  if (!usuario) return (
    <>
      <Toaster position="top-center" toastOptions={{
        style: { background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-default)", fontSize: 13 },
      }} />
      <PinLogin />
    </>
  );

  const paginas: Record<string, React.ReactElement> = {
    pos:           <POS />,
    dashboard:     <Dashboard />,
    inventario:    <Inventario />,
    clientes:      <Clientes />,
    proveedores:   <Proveedores />,
    reportes:      <Reportes />,
    cierre_caja:   <CierreCaja />,
    configuracion: <Configuracion />,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>
      <Toaster position="top-right" toastOptions={{
        style: { background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-default)", fontSize: 13 },
      }} />
      <TopBar pagina={paginaActual} setPagina={setPagina} />
      <div style={{ flex: 1, overflow: "hidden" }}>
        {paginas[paginaActual] ?? <POS />}
      </div>
    </div>
  );
}