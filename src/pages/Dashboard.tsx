import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { fmtCLP } from "../utils/format";
import KpiCard from "../components/KpiCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line
} from "recharts";

export default function Dashboard() {
  const [stats, setStats] = useState({
    ventasHoy: 0, totalHoy: 0, ticketPromedio: 0, stockBajo: 0
  });
  const [ventasSemana, setVentasSemana] = useState<any[]>([]);
  const [topProductos, setTopProductos] = useState<any[]>([]);
  const [ultimasVentas, setUltimasVentas] = useState<any[]>([]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const db = await getDB();

    const hoy = await db.select<any[]>(
      "SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM ventas WHERE date(fecha)=date('now') AND estado='completada'"
    );
    const bajo = await db.select<any[]>(
      "SELECT COUNT(*) as count FROM productos WHERE stock <= stock_minimo AND activo=1"
    );
    const ticket = hoy[0].count > 0 ? Math.round(hoy[0].total / hoy[0].count) : 0;
    setStats({
      ventasHoy: hoy[0].count,
      totalHoy: hoy[0].total,
      ticketPromedio: ticket,
      stockBajo: bajo[0].count,
    });

    const semana = await db.select<any[]>(`
      SELECT date(fecha) as dia, COUNT(*) as ventas, COALESCE(SUM(total),0) as total
      FROM ventas WHERE fecha >= date('now','-6 days') AND estado='completada'
      GROUP BY date(fecha) ORDER BY dia
    `);
    setVentasSemana(semana.map(r => ({
      dia: new Date(r.dia).toLocaleDateString("es-CL", { weekday: "short", day: "numeric" }),
      total: Math.round(r.total),
      ventas: r.ventas,
    })));

    const top = await db.select<any[]>(`
      SELECT dv.nombre_producto as nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as total
      FROM detalle_venta dv
      JOIN ventas v ON v.id = dv.venta_id
      WHERE v.estado='completada' AND v.fecha >= date('now','-7 days')
      GROUP BY dv.nombre_producto ORDER BY cantidad DESC LIMIT 5
    `);
    setTopProductos(top);

    const ultimas = await db.select<any[]>(
      "SELECT * FROM ventas WHERE estado='completada' ORDER BY fecha DESC LIMIT 6"
    );
    setUltimasVentas(ultimas);
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
      height: "100%", overflowY: "auto", overflowX: "hidden",
      padding: "var(--space-5)",
      display: "flex", flexDirection: "column", gap: "var(--space-4)",
    }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-3)" }}>
        <KpiCard
          label="Ventas hoy"
          value={stats.ventasHoy}
          sub="transacciones"
        />
        <KpiCard
          label="Ingresos hoy"
          value={fmtCLP(stats.totalHoy)}
          sub="total cobrado"
          valueColor="var(--success)"
        />
        <KpiCard
          label="Ticket promedio"
          value={fmtCLP(stats.ticketPromedio)}
          sub="por venta"
        />
        <KpiCard
          label="Stock bajo"
          value={stats.stockBajo}
          sub="requieren reposición"
          valueColor={stats.stockBajo > 0 ? "var(--warning)" : undefined}
        />
      </div>

      {/* Gráficos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>

        {/* Ventas 7 días */}
        <div className="card" style={{ padding: "var(--space-5)" }}>
          <div style={{
            fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-4)"
          }}>
            Ventas últimos 7 días
          </div>
          {ventasSemana.length === 0 ? (
            <div className="empty-state" style={{ padding: "var(--space-8)" }}>
              Sin ventas en este período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ventasSemana} barCategoryGap="35%">
                <XAxis
                  dataKey="dia"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => "$" + (v / 1000).toFixed(0) + "k"}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-elevated)" }} />
                <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top productos */}
        <div className="card" style={{ padding: "var(--space-5)" }}>
          <div style={{
            fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-4)"
          }}>
            Productos más vendidos — 7 días
          </div>
          {topProductos.length === 0 ? (
            <div className="empty-state" style={{ padding: "var(--space-8)" }}>Sin datos aún</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {topProductos.map((p, i) => {
                const pct = Math.round((p.cantidad / topProductos[0].cantidad) * 100);
                return (
                  <div key={p.nombre}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span style={{
                          fontSize: "var(--text-xs)", color: "var(--text-disabled)",
                          fontWeight: 700, width: 16, textAlign: "right"
                        }}>{i + 1}</span>
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{p.nombre}</span>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{p.cantidad} uds</span>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--success)", fontWeight: 600, width: 64, textAlign: "right" }}>
                          {fmtCLP(p.total)}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`,
                        background: "var(--accent)", borderRadius: 2,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Últimas ventas */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: "var(--text-xs)", fontWeight: 700,
          color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Últimas ventas
        </div>
        {ultimasVentas.length === 0 ? (
          <div className="empty-state">Sin ventas registradas aún</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th style={{ textAlign: "right" }}>Subtotal</th>
                <th style={{ textAlign: "right" }}>IVA</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {ultimasVentas.map(v => (
                <tr key={v.id}>
                  <td style={{ color: "var(--text-disabled)", fontFamily: "monospace", fontSize: "var(--text-xs)" }}>
                    #{v.id}
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>
                    {new Date(v.fecha).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{fmtCLP(v.subtotal)}</td>
                  <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{fmtCLP(v.iva)}</td>
                  <td style={{ textAlign: "right", color: "var(--success)", fontWeight: 700 }}>{fmtCLP(v.total)}</td>
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
  );
}