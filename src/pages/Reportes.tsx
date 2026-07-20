import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { fmtCLP } from "../utils/format";
import KpiCard from "../components/KpiCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

const PERIODOS = [
  { v: "7",  l: "7 días" },
  { v: "30", l: "30 días" },
  { v: "90", l: "90 días" },
];

const METODO_COLORES: Record<string, string> = {
  efectivo:      "var(--success)",
  debito:        "var(--accent)",
  credito:       "#a78bfa",
  transferencia: "var(--info)",
};

export default function Reportes() {
  const [periodo, setPeriodo] = useState<"7"|"30"|"90">("7");
  const [ventasDiarias, setVentasDiarias] = useState<any[]>([]);
  const [topProductos, setTopProductos] = useState<any[]>([]);
  const [ventasPorMetodo, setVentasPorMetodo] = useState<any[]>([]);
  const [resumen, setResumen] = useState({ total: 0, cantidad: 0, ticket: 0, iva: 0 });

  useEffect(() => { cargar(); }, [periodo]);

  async function cargar() {
    const db = await getDB();

    const diarias = await db.select<any[]>(`
      SELECT date(fecha) as dia, COUNT(*) as cantidad, SUM(total) as total
      FROM ventas WHERE estado='completada' AND fecha >= date('now','-${periodo} days')
      GROUP BY date(fecha) ORDER BY dia
    `);
    setVentasDiarias(diarias.map(r => ({
      dia: new Date(r.dia).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }),
      total: Math.round(r.total),
      cantidad: r.cantidad,
    })));

    const top = await db.select<any[]>(`
      SELECT dv.nombre_producto as nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as total
      FROM detalle_venta dv
      JOIN ventas v ON v.id = dv.venta_id
      WHERE v.estado='completada' AND v.fecha >= date('now','-${periodo} days')
      GROUP BY dv.nombre_producto ORDER BY cantidad DESC LIMIT 8
    `);
    setTopProductos(top);

    const metodos = await db.select<any[]>(`
      SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total
      FROM ventas WHERE estado='completada' AND fecha >= date('now','-${periodo} days')
      GROUP BY metodo_pago
    `);
    setVentasPorMetodo(metodos.map(m => ({
      name: m.metodo_pago,
      value: Math.round(m.total),
      cantidad: m.cantidad,
    })));

    const res = await db.select<any[]>(`
      SELECT COUNT(*) as cantidad, COALESCE(SUM(total),0) as total, COALESCE(SUM(iva),0) as iva
      FROM ventas WHERE estado='completada' AND fecha >= date('now','-${periodo} days')
    `);
    const r = res[0];
    setResumen({
      total: r.total,
      cantidad: r.cantidad,
      ticket: r.cantidad > 0 ? Math.round(r.total / r.cantidad) : 0,
      iva: r.iva,
    });
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: "var(--bg-overlay)", border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)",
        fontSize: "var(--text-xs)",
      }}>
        <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
        <div style={{ color: "var(--success)", fontWeight: 700, fontSize: "var(--text-sm)" }}>
          {fmtCLP(payload[0].value)}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      padding: "var(--space-5)",
      display: "flex", flexDirection: "column", gap: "var(--space-4)",
    }}>

      {/* Selector de período */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Período
        </span>
        <div style={{ display: "flex", gap: "var(--space-1)", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: 3 }}>
          {PERIODOS.map(p => (
            <button
              key={p.v}
              onClick={() => setPeriodo(p.v as any)}
              style={{
                padding: "var(--space-1) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                border: "none",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                background: periodo === p.v ? "var(--accent)" : "transparent",
                color: periodo === p.v ? "#fff" : "var(--text-muted)",
              }}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-3)" }}>
        <KpiCard label="Total ventas" value={fmtCLP(resumen.total)} valueColor="var(--success)" />
        <KpiCard label="Transacciones" value={resumen.cantidad} />
        <KpiCard label="Ticket promedio" value={fmtCLP(resumen.ticket)} />
        <KpiCard label="IVA recaudado" value={fmtCLP(resumen.iva)} valueColor="var(--text-secondary)" />
      </div>

      {/* Gráficos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>

        {/* Ventas diarias */}
        <div className="card" style={{ padding: "var(--space-5)" }}>
          <div style={{
            fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-4)"
          }}>
            Ventas diarias
          </div>
          {ventasDiarias.length === 0 ? (
            <div className="empty-state" style={{ padding: "var(--space-8)" }}>Sin datos en este período</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ventasDiarias} barCategoryGap="35%">
                <XAxis dataKey="dia" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => "$" + (v / 1000).toFixed(0) + "k"} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-elevated)" }} />
                <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Por método de pago */}
        <div className="card" style={{ padding: "var(--space-5)" }}>
          <div style={{
            fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-4)"
          }}>
            Por método de pago
          </div>
          {ventasPorMetodo.length === 0 ? (
            <div className="empty-state" style={{ padding: "var(--space-8)" }}>Sin datos</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
              <PieChart width={140} height={140}>
                <Pie
                  data={ventasPorMetodo}
                  cx={70} cy={70}
                  innerRadius={42} outerRadius={65}
                  dataKey="value" paddingAngle={3}
                >
                  {ventasPorMetodo.map((m) => (
                    <Cell key={m.name} fill={METODO_COLORES[m.name] ?? "var(--text-muted)"} />
                  ))}
                </Pie>
              </PieChart>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flex: 1 }}>
                {ventasPorMetodo.map(m => (
                  <div key={m.name} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: METODO_COLORES[m.name] ?? "var(--text-muted)",
                    }} />
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "capitalize", flex: 1 }}>
                      {m.name}
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", fontWeight: 600 }}>
                      {fmtCLP(m.value)}
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-disabled)" }}>
                      {m.cantidad} vtas
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top productos */}
      <div className="card" style={{ padding: "var(--space-5)" }}>
        <div style={{
          fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-4)"
        }}>
          Productos más vendidos
        </div>
        {topProductos.length === 0 ? (
          <div className="empty-state">Sin datos en este período</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4) var(--space-8)" }}>
            {topProductos.map((p, i) => {
              const pct = Math.round((p.cantidad / topProductos[0].cantidad) * 100);
              return (
                <div key={p.nombre}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-disabled)", fontWeight: 700, width: 16 }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500 }}>
                        {p.nombre}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-3)" }}>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{p.cantidad} uds</span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--success)", fontWeight: 600, width: 64, textAlign: "right" }}>
                        {fmtCLP(p.total)}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 3, background: "var(--bg-elevated)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%", width: `${pct}%`,
                      background: "var(--accent)", borderRadius: 2,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}