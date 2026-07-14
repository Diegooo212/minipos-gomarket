import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { useAuthStore } from "./store/useAuthStore";
import { useCajaStore } from "./store/useCajaStore";
import { useStore } from "./store/useStore";
import { getDB } from "./db/database";
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

export default function App() {
  const { usuario } = useAuthStore();
  const { setTurno } = useCajaStore();
  const setPagina = useStore((s) => s.setPagina);
  const paginaActual = useStore((s) => s.paginaActual);

  // Atajos de teclado globales
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!usuario) return;
      const mapa: Record<string, string> = {
        F1: "pos", F2: "dashboard", F3: "inventario",
        F5: "clientes", F6: "proveedores", F7: "reportes",
        F8: "cierre_caja", F12: "configuracion",
      };
      if (mapa[e.key]) { e.preventDefault(); setPagina(mapa[e.key]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [usuario]);

  // Verificar si hay turno abierto al iniciar sesión
  useEffect(() => {
    if (!usuario) return;
    (async () => {
      const db = await getDB();
      const rows = await db.select<any[]>(
        "SELECT * FROM turnos_caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1"
      );
      if (rows.length > 0) setTurno(rows[0]);
    })();
  }, [usuario]);

  if (!usuario) return (
    <>
      <Toaster position="top-center" toastOptions={{
        style: { background: "#1a1a2e", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13 },
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
    <div className="flex flex-col h-screen bg-[#0f0f13] overflow-hidden">
      <Toaster position="top-right" toastOptions={{
        style: { background: "#1a1a2e", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13 },
      }} />
      <TopBar pagina={paginaActual} setPagina={setPagina} />
      <div className="flex-1 overflow-hidden">
        {paginas[paginaActual] ?? <POS />}
      </div>
    </div>
  );
}