import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useCajaStore } from "../store/useCajaStore";
import { getDB } from "../db/database";
import { fmtCLP, fmtFecha } from "../utils/format";
import toast from "react-hot-toast";

export default function CierreCaja() {
  const { usuario } = useAuthStore();
  const { turno, setTurno, resetTurno, ventasDelTurno, totalDelTurno } = useCajaStore();
  const [montoInicial, setMontoInicial] = useState("0");
  const [montoFinalReal, setMontoFinalReal] = useState("");
  const [ventas, setVentas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [vista, setVista] = useState<"apertura" | "turno">(turno ? "turno" : "apertura");

  useEffect(() => {
    if (turno) { setVista("turno"); cargarVentas(); }
  }, [turno]);

  async function cargarVentas() {
    if (!turno) return;
    const db = await getDB();
    const rows = await db.select<any[]>(
      "SELECT * FROM ventas WHERE turno_id = ? ORDER BY fecha DESC",
      [turno.id]
    );
    setVentas(rows);
  }

  async function abrirCaja() {
    if (!usuario) return;
    const monto = parseFloat(montoInicial) || 0;
    setCargando(true);
    try {
      const db = await getDB();
      const result = await db.execute(
        "INSERT INTO turnos_caja (usuario_id, monto_inicial, estado) VALUES (?,?,'abierto')",
        [usuario.id, monto]
      );
      const nuevoTurno = {
        id: result.lastInsertId,
        usuario_id: usuario.id!,
        monto_inicial: monto,
        estado: "abierto" as const,
        apertura: new Date().toISOString(),
      };
      setTurno(nuevoTurno);
      setVista("turno");
      toast.success(`Caja abierta con ${fmtCLP(monto)}`);
    } catch {
      toast.error("Error al abrir caja");
    }
    setCargando(false);
  }

  async function cerrarCaja() {
    if (!turno) return;
    const montoReal = parseFloat(montoFinalReal) || 0;
    const montoEsperado = turno.monto_inicial + totalDelTurno;
    const diferencia = montoReal - montoEsperado;
    setCargando(true);
    try {
      const db = await getDB();
      await db.execute(
        `UPDATE turnos_caja SET 
          monto_final_esperado=?, monto_final_real=?, diferencia=?,
          cierre=CURRENT_TIMESTAMP, estado='cerrado'
         WHERE id=?`,
        [montoEsperado, montoReal, diferencia, turno.id]
      );
      toast.success("Caja cerrada correctamente");
      resetTurno();
      setVista("apertura");
      setMontoFinalReal("");
      setMontoInicial("0");
    } catch {
      toast.error("Error al cerrar caja");
    }
    setCargando(false);
  }

  const montoEsperado = turno ? turno.monto_inicial + totalDelTurno : 0;
  const montoReal = parseFloat(montoFinalReal) || 0;
  const diferencia = montoReal - montoEsperado;

  if (vista === "apertura") return (
    <div className="flex items-center justify-center h-full bg-[#0f0f13]">
      <div className="bg-[#13131e] border border-[#2a2a3d] rounded-xl w-[400px] overflow-hidden shadow-2xl">
        <div className="px-6 py-5 border-b border-[#1e1e2e]">
          <h2 className="text-white font-semibold text-[15px]">💰 Apertura de caja</h2>
          <p className="text-[#4d4d6a] text-[12px] mt-1">Ingresa el monto inicial en efectivo</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[#4d4d6a] uppercase tracking-widest block mb-2">
              Monto inicial en caja
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d4d6a] font-bold">$</span>
              <input
                type="number"
                value={montoInicial}
                onChange={e => setMontoInicial(e.target.value)}
                onKeyDown={e => e.key === "Enter" && abrirCaja()}
                className="w-full bg-[#0f0f18] border border-[#2a2a3d] focus:border-[#3b5bdb] rounded-lg pl-8 pr-4 py-3 text-white text-[20px] font-bold outline-none transition-colors"
                autoFocus
              />
            </div>
          </div>
          <div className="bg-[#0f0f18] border border-[#1e1e2e] rounded-lg p-3 text-[12px] text-[#4d4d6a]">
            <div className="flex justify-between"><span>Cajero</span><span className="text-white">{usuario?.nombre}</span></div>
            <div className="flex justify-between mt-1"><span>Fecha</span><span className="text-white">{new Date().toLocaleDateString("es-CL")}</span></div>
            <div className="flex justify-between mt-1"><span>Hora apertura</span><span className="text-white">{new Date().toLocaleTimeString("es-CL")}</span></div>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={abrirCaja}
            disabled={cargando}
            className="w-full py-3 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-[14px] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {cargando ? "Abriendo..." : "Abrir caja"}
            <span className="bg-white/15 rounded px-2 py-0.5 text-[11px] font-mono">Enter</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto">
      {/* Header turno */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Monto inicial", value: fmtCLP(turno?.monto_inicial ?? 0), color: "text-blue-400" },
          { label: "Ventas del turno", value: ventasDelTurno.toString(), color: "text-purple-400" },
          { label: "Total vendido", value: fmtCLP(totalDelTurno), color: "text-green-400" },
          { label: "Monto esperado", value: fmtCLP(montoEsperado), color: "text-yellow-400" },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1a2e] border border-[#2a2a3d] rounded-xl p-4">
            <div className="text-[11px] text-[#4d4d6a] mb-1">{s.label}</div>
            <div className={`text-[22px] font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {/* Ventas del turno */}
        <div className="bg-[#13131e] border border-[#2a2a3d] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e2e]">
            <h3 className="text-[13px] font-semibold text-white">Ventas del turno</h3>
          </div>
          <div className="overflow-y-auto max-h-[300px]">
            {ventas.length === 0 ? (
              <div className="text-center text-[#3d3d5c] text-[12px] py-8">Sin ventas en este turno</div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-[#0f0f18]">
                  <tr>
                    {["#","Hora","Total","Método"].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-[#4d4d6a] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventas.map(v => (
                    <tr key={v.id} className="border-t border-[#1e1e2e] hover:bg-[#1a1a2e]">
                      <td className="px-4 py-2 text-[#4d4d6a]">#{v.id}</td>
                      <td className="px-4 py-2 text-[#8080a0]">
                        {new Date(v.fecha).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}
                      </td>
                      <td className="px-4 py-2 text-green-400 font-medium">{fmtCLP(v.total)}</td>
                      <td className="px-4 py-2">
                        <span className="bg-[#1e1e2e] text-[#8080a0] px-2 py-0.5 rounded text-[10px] capitalize">{v.metodo_pago}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Arqueo de caja */}
        <div className="bg-[#13131e] border border-[#2a2a3d] rounded-xl p-5 flex flex-col gap-4">
          <h3 className="text-[13px] font-semibold text-white">Arqueo y cierre</h3>

          <div>
            <label className="text-[10px] font-bold text-[#4d4d6a] uppercase tracking-widest block mb-2">
              Efectivo contado en caja
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d4d6a] font-bold">$</span>
              <input
                type="number"
                value={montoFinalReal}
                onChange={e => setMontoFinalReal(e.target.value)}
                placeholder="0"
                className="w-full bg-[#0f0f18] border border-[#2a2a3d] focus:border-[#3b5bdb] rounded-lg pl-8 pr-4 py-3 text-white text-[18px] font-bold outline-none transition-colors placeholder-[#2a2a3d]"
              />
            </div>
          </div>

          <div className="bg-[#0f0f18] border border-[#1e1e2e] rounded-lg p-3 space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-[#4d4d6a]">Monto inicial</span>
              <span className="text-white">{fmtCLP(turno?.monto_inicial ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#4d4d6a]">Total vendido</span>
              <span className="text-green-400">+{fmtCLP(totalDelTurno)}</span>
            </div>
            <div className="flex justify-between border-t border-[#1e1e2e] pt-2">
              <span className="text-[#4d4d6a]">Esperado en caja</span>
              <span className="text-white font-bold">{fmtCLP(montoEsperado)}</span>
            </div>
            {montoFinalReal && (
              <div className="flex justify-between border-t border-[#1e1e2e] pt-2">
                <span className="text-[#4d4d6a]">Diferencia</span>
                <span className={`font-bold text-[14px] ${diferencia === 0 ? "text-green-400" : diferencia > 0 ? "text-blue-400" : "text-red-400"}`}>
                  {diferencia > 0 ? "+" : ""}{fmtCLP(diferencia)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-auto">
            <button
              onClick={cerrarCaja}
              disabled={cargando}
              className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-[#2a1a1a] disabled:text-[#5c3d3d] text-white font-bold text-[13px] transition-all active:scale-[0.98]"
            >
              {cargando ? "Cerrando..." : "Cerrar caja y finalizar turno"}
            </button>
            <p className="text-[10px] text-[#3d3d5c] text-center mt-2">
              Apertura: {turno?.apertura ? fmtFecha(turno.apertura) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}