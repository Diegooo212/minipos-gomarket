import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { useAuthStore } from "../store/useAuthStore";
import { Usuario } from "../types";
import toast from "react-hot-toast";

export default function PinLogin() {
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);
  const login = useAuthStore((s) => s.login);

  async function verificarPin(pinIngresado: string) {
    if (pinIngresado.length < 4) return;
    setCargando(true);
    try {
      const db = await getDB();
      const rows = await db.select<Usuario[]>(
        "SELECT * FROM usuarios WHERE pin_hash = ? AND activo = 1 LIMIT 1",
        [pinIngresado]
      );
      if (rows.length > 0) {
        login(rows[0]);
        toast.success(`Bienvenido, ${rows[0].nombre}`);
      } else {
        toast.error("PIN incorrecto");
        setPin("");
      }
    } catch {
      toast.error("Error al verificar PIN");
    }
    setCargando(false);
  }

  // Teclado físico
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (cargando) return;
      if (e.key >= "0" && e.key <= "9") {
        setPin((prev) => {
          const nuevo = prev + e.key;
          if (nuevo.length === 4) {
            setTimeout(() => verificarPin(nuevo), 50);
          }
          return nuevo.length <= 4 ? nuevo : prev;
        });
      }
      if (e.key === "Backspace") {
        setPin((prev) => prev.slice(0, -1));
      }
      if (e.key === "Enter") {
        setPin((prev) => { verificarPin(prev); return prev; });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cargando]);

  function presionar(valor: string) {
    if (cargando) return;
    if (valor === "DEL") { setPin((p) => p.slice(0, -1)); return; }
    if (valor === "OK") { verificarPin(pin); return; }
    const nuevo = pin + valor;
    if (nuevo.length <= 4) {
      setPin(nuevo);
      if (nuevo.length === 4) setTimeout(() => verificarPin(nuevo), 50);
    }
  }

  const teclas = ["1","2","3","4","5","6","7","8","9","DEL","0","OK"];

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0f0f13] gap-8">
      <div className="text-center">
        <div className="text-3xl mb-2">🏪</div>
        <h1 className="text-white text-xl font-semibold">MiniPOS Pro</h1>
        <p className="text-[#4d4d6a] text-sm mt-1">Ingresa tu PIN para continuar</p>
      </div>

      <div className="flex gap-3">
        {[0,1,2,3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              pin.length > i
                ? "bg-blue-500 border-blue-500"
                : "border-[#3d3d5c] bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {teclas.map((t) => (
          <button
            key={t}
            onClick={() => presionar(t)}
            disabled={cargando}
            className={`w-16 h-16 rounded-xl font-semibold text-lg transition-all active:scale-95 ${
              t === "OK"
                ? "bg-green-600 hover:bg-green-500 text-white"
                : t === "DEL"
                ? "bg-[#1e1e2e] hover:bg-[#2a2a3d] text-red-400"
                : "bg-[#1a1a2e] hover:bg-[#2a2a3d] text-white border border-[#2a2a3d]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-[#2a2a3d] text-center">
        Admin: 1234 · Cajero: 1111 · Supervisor: 2222
      </div>
    </div>
  );
}