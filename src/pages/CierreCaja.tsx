import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useCajaStore } from "../store/useCajaStore";
import { getDB } from "../db/database";
import { fmtCLP, fmtFecha } from "../utils/format";
import KpiCard from "../components/KpiCard";
import toast from "react-hot-toast";

type Vista = "apertura" | "turno" | "historial";

export default function CierreCaja() {
  const { usuario } = useAuthStore();
  const { turno, setTurno, resetTurno, ventasDelTurno, totalDelTurno } = useCajaStore();
  const [montoInicial, setMontoInicial] = useState("0");
  const [montoFinalReal, setMontoFinalReal] = useState("");
  const [ventas, setVentas] = useState<any[]>([]);
  const [historialTurnos, setHistorialTurnos] = useState<any[]>([]);
  const [turnoDetalle, setTurnoDetalle] = useState<any | null>(null);
  const [ventasDetalle, setVentasDetalle] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [vista, setVista] = useState<Vista>(turno ? "turno" : "apertura");

  useEffect(() => {
    if (turno) { setVista("turno"); cargarVentas(); }
    cargarHistorial();
  }, [turno]);

  async function cargarVentas() {
    if (!turno) return;
    const db = await getDB();
    const rows = await db.select<any[]>(
      "SELECT * FROM ventas WHERE turno_id=? AND estado='completada' ORDER BY fecha DESC",
      [turno.id]
    );
    setVentas(rows);
  }

  async function cargarHistorial() {
    const db = await getDB();
    const rows = await db.select<any[]>(`
      SELECT t.*, u.nombre as cajero_nombre,
        COUNT(v.id) as total_ventas,
        COALESCE(SUM(v.total),0) as total_monto
      FROM turnos_caja t
      LEFT JOIN usuarios u ON u.id = t.usuario_id
      LEFT JOIN ventas v ON v.turno_id = t.id AND v.estado='completada'
      WHERE t.estado='cerrado'
      GROUP BY t.id
      ORDER BY t.apertura DESC
      LIMIT 30
    `);
    setHistorialTurnos(rows);
  }

  async function verDetalleTurno(t: any) {
    setTurnoDetalle(t);
    const db = await getDB();
    const rows = await db.select<any[]>(
      "SELECT * FROM ventas WHERE turno_id=? AND estado='completada' ORDER BY fecha DESC",
      [t.id]
    );
    setVentasDetalle(rows);
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
      setTurno({
        id: result.lastInsertId,
        usuario_id: usuario.id!,
        monto_inicial: monto,
        estado: "abierto",
        apertura: new Date().toISOString(),
      });
      setVista("turno");
      toast.success(`Caja abierta con ${fmtCLP(monto)}`);
    } catch { toast.error("Error al abrir caja"); }
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
      setMontoFinalReal("");
      setMontoInicial("0");
      setVista("apertura");
      cargarHistorial();
    } catch { toast.error("Error al cerrar caja"); }
    setCargando(false);
  }

  const montoEsperado = turno ? turno.monto_inicial + totalDelTurno : 0;
  const montoReal = parseFloat(montoFinalReal) || 0;
  const diferencia = montoReal - montoEsperado;
  const diferenciaColor = diferencia === 0 ? "var(--success)" : diferencia > 0 ? "var(--accent)" : "var(--danger)";

  // ── Tabs header ──────────────────────────────────────────────────────
  const tabs = [
    { id: "apertura",  label: turno ? "Turno activo" : "Apertura" },
    { id: "historial", label: "Historial de cajas" },
  ];

  // ── Pantalla apertura / turno activo ──────────────────────────────────
  const renderAperturaTurno = () => {
    if (!turno) return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <div className="card" style={{ width: 400, overflow: "hidden" }}>
          <div style={{ padding: "var(--space-5) var(--space-6)", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
              Apertura de caja
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
              Ingresa el monto inicial en efectivo
            </div>
          </div>
          <div style={{ padding: "var(--space-5) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Monto inicial
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontWeight: 700 }}>$</span>
                <input
                  type="number" value={montoInicial}
                  onChange={e => setMontoInicial(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && abrirCaja()}
                  className="input input-lg" autoFocus
                />
              </div>
            </div>
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {[
                { label: "Cajero", value: usuario?.nombre },
                { label: "Fecha", value: new Date().toLocaleDateString("es-CL") },
                { label: "Hora", value: new Date().toLocaleTimeString("es-CL") },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "0 var(--space-6) var(--space-6)" }}>
            <button onClick={abrirCaja} disabled={cargando} className="btn btn-success btn-xl">
              {cargando ? "Abriendo..." : "Abrir caja"}
              <span className="kbd" style={{ marginLeft: "var(--space-2)" }}>Enter</span>
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-3)" }}>
          <KpiCard label="Monto inicial" value={fmtCLP(turno.monto_inicial)} />
          <KpiCard label="Ventas del turno" value={ventasDelTurno} sub="transacciones" />
          <KpiCard label="Total vendido" value={fmtCLP(totalDelTurno)} valueColor="var(--success)" />
          <KpiCard label="Esperado en caja" value={fmtCLP(montoEsperado)} valueColor="var(--accent-text)" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", flex: 1, minHeight: 0 }}>
          {/* Ventas */}
          <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
              Ventas del turno
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {ventas.length === 0 ? (
                <div className="empty-state">Sin ventas en este turno</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Hora</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th>Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map(v => (
                      <tr key={v.id}>
                        <td style={{ color: "var(--text-disabled)", fontFamily: "monospace", fontSize: "var(--text-xs)" }}>#{v.id}</td>
                        <td style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>
                          {new Date(v.fecha).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--success)", fontWeight: 700 }}>{fmtCLP(v.total)}</td>
                        <td><span className="badge badge-info" style={{ textTransform: "capitalize" }}>{v.metodo_pago}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Arqueo */}
          <div className="card" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Arqueo y cierre
            </div>
            <div>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Efectivo contado en caja
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontWeight: 700 }}>$</span>
                <input type="number" value={montoFinalReal} onChange={e => setMontoFinalReal(e.target.value)}
                  placeholder="0" className="input input-lg" />
              </div>
            </div>
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {[
                { label: "Monto inicial", value: fmtCLP(turno.monto_inicial), color: "var(--text-primary)" },
                { label: "Total vendido", value: `+${fmtCLP(totalDelTurno)}`, color: "var(--success)" },
                { label: "Esperado en caja", value: fmtCLP(montoEsperado), color: "var(--text-primary)", bold: true },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                  <span style={{ color: r.color, fontWeight: r.bold ? 700 : 500 }}>{r.value}</span>
                </div>
              ))}
              {montoFinalReal && (
                <>
                  <div style={{ height: 1, background: "var(--border-subtle)" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Diferencia</span>
                    <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: diferenciaColor }}>
                      {diferencia > 0 ? "+" : ""}{fmtCLP(diferencia)}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div style={{ marginTop: "auto" }}>
              <button onClick={cerrarCaja} disabled={cargando} className="btn btn-xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}>
                {cargando ? "Cerrando..." : "Cerrar caja y finalizar turno"}
              </button>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-disabled)", textAlign: "center", marginTop: "var(--space-2)" }}>
                Apertura: {turno.apertura ? fmtFecha(turno.apertura) : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Historial ──────────────────────────────────────────────────────────
  const renderHistorial = () => (
    <div style={{ display: "flex", gap: "var(--space-4)", flex: 1, minHeight: 0 }}>
      {/* Lista de turnos */}
      <div className="card" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
          Turnos cerrados — últimos 30
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {historialTurnos.length === 0 ? (
            <div className="empty-state">Sin turnos cerrados aún</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cajero</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th style={{ textAlign: "right" }}>Ventas</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {historialTurnos.map(t => {
                  const diff = t.diferencia ?? 0;
                  const diffColor = diff === 0 ? "var(--text-muted)" : diff > 0 ? "var(--success)" : "var(--danger)";
                  const isSelected = turnoDetalle?.id === t.id;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => verDetalleTurno(t)}
                      style={{ cursor: "pointer", background: isSelected ? "var(--accent-subtle)" : undefined }}
                    >
                      <td style={{ color: "var(--text-disabled)", fontFamily: "monospace", fontSize: "var(--text-xs)" }}>#{t.id}</td>
                      <td style={{ fontWeight: 600 }}>{t.cajero_nombre}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>
                        {t.apertura ? fmtFecha(t.apertura) : "—"}
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>
                        {t.cierre ? fmtFecha(t.cierre) : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{t.total_ventas}</td>
                      <td style={{ textAlign: "right", color: "var(--success)", fontWeight: 700 }}>
                        {fmtCLP(t.total_monto)}
                      </td>
                      <td style={{ textAlign: "right", color: diffColor, fontWeight: 600 }}>
                        {diff !== 0 ? (diff > 0 ? "+" : "") + fmtCLP(diff) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detalle del turno seleccionado */}
      <div className="card" style={{ width: 340, overflow: "hidden", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
          {turnoDetalle ? `Detalle — Turno #${turnoDetalle.id}` : "Selecciona un turno"}
        </div>

        {!turnoDetalle ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            Haz clic en un turno para ver el detalle
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {/* Resumen del turno */}
            <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {[
                { label: "Cajero", value: turnoDetalle.cajero_nombre },
                { label: "Apertura", value: turnoDetalle.apertura ? fmtFecha(turnoDetalle.apertura) : "—" },
                { label: "Cierre", value: turnoDetalle.cierre ? fmtFecha(turnoDetalle.cierre) : "—" },
                { label: "Monto inicial", value: fmtCLP(turnoDetalle.monto_inicial) },
                { label: "Esperado", value: fmtCLP(turnoDetalle.monto_final_esperado ?? 0) },
                { label: "Contado", value: fmtCLP(turnoDetalle.monto_final_real ?? 0) },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{r.value}</span>
                </div>
              ))}
              {(turnoDetalle.diferencia ?? 0) !== 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--border-subtle)" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Diferencia</span>
                  <span style={{ fontWeight: 700, color: turnoDetalle.diferencia > 0 ? "var(--success)" : "var(--danger)" }}>
                    {turnoDetalle.diferencia > 0 ? "+" : ""}{fmtCLP(turnoDetalle.diferencia)}
                  </span>
                </div>
              )}
            </div>

            {/* Ventas del turno seleccionado */}
            <div style={{ padding: "var(--space-3) var(--space-5)", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
              Ventas ({ventasDetalle.length})
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {ventasDetalle.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-disabled)", fontSize: "var(--text-xs)", padding: "var(--space-5)" }}>
                  Sin ventas registradas
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th>Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasDetalle.map(v => (
                      <tr key={v.id}>
                        <td style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>
                          {new Date(v.fecha).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--success)", fontWeight: 700 }}>
                          {fmtCLP(v.total)}
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ textTransform: "capitalize" }}>
                            {v.metodo_pago}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Tabs */}
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-1)",
        padding: "var(--space-3) var(--space-5)",
        borderBottom: "1px solid var(--border-subtle)",
        flexShrink: 0,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setVista(t.id as Vista)}
            style={{
              padding: "var(--space-1) var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              transition: "all 0.15s",
              background: vista === t.id ? "var(--accent-subtle)" : "transparent",
              color: vista === t.id ? "var(--accent-text)" : "var(--text-muted)",
            }}
          >
            {t.label}
          </button>
        ))}

        {/* Indicador turno activo */}
        {turno && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              Turno abierto desde {turno.apertura ? fmtFecha(turno.apertura) : "—"}
            </span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflow: "hidden", padding: "var(--space-5)", display: "flex", flexDirection: "column" }}>
        {vista === "apertura" && renderAperturaTurno()}
        {vista === "turno" && renderAperturaTurno()}
        {vista === "historial" && renderHistorial()}
      </div>
    </div>
  );
}