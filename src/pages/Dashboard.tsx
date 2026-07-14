import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

export default function Dashboard() {
  const [stats, setStats] = useState({ ventasHoy: 0, totalHoy: 0, productos: 0, stockBajo: 0 });
  const [ventasSemana, setVentasSemana] = useState<any[]>([]);
  const [topProductos, setTopProductos] = useState<any[]>([]);
  const [ultimasVentas, setUltimasVentas] = useState<any[]>([]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const db = await getDB();

    const hoy = await db.select<any[]>(
      "SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM ventas WHERE date(fecha)=date('now')"
    );
    const prods = await db.select<any[]>("SELECT COUNT(*) as count FROM productos");
    const bajo = await db.select<any[]>(
      "SELECT COUNT(*) as count FROM productos WHERE stock <= stock_minimo"
    );
    setStats({
      ventasHoy: hoy[0].count,
      totalHoy: hoy[0].total,
      productos: prods[0].count,
      stockBajo: bajo[0].count,
    });

    const semana = await db.select<any[]>(`
      SELECT date(fecha) as dia,
             COUNT(*) as ventas,
             COALESCE(SUM(total),0) as total
      FROM ventas
      WHERE fecha >= date('now','-6 days')
      GROUP BY date(fecha)
      ORDER BY dia
    `);
    setVentasSemana(semana.map(r => ({
      dia: new Date(r.dia).toLocaleDateString("es-CL",{weekday:"short"}),
      ventas: r.ventas,
      total: Math.round(r.total),
    })));

    const top = await db.select<any[]>(`
      SELECT vi.nombre, SUM(vi.cantidad) as cantidad, SUM(vi.subtotal) as total
      FROM venta_items vi
      GROUP BY vi.nombre
      ORDER BY cantidad DESC
      LIMIT 6
    `);
    setTopProductos(top);

    const ultimas = await db.select<any[]>(
      "SELECT * FROM ventas ORDER BY fecha DESC LIMIT 8"
    );
    setUltimasVentas(ultimas);
  }

  const statCards = [
    { label: "Ventas hoy", value: stats.ventasHoy, suffix: "transacciones", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Ingresos hoy", value: fmt(stats.totalHoy), suffix: "total cobrado", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { label: "Productos", value: stats.productos, suffix: "en catálogo", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
    { label: "Stock bajo", value: stats.stockBajo, suffix: "requieren reposición", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  ];

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.bg}`}>
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-semibold mb-1 ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-600">{s.suffix}</div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-3">
        {/* Ventas semana */}
        <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
          <div className="text-sm font-medium text-white mb-4">Ventas últimos 7 días</div>
          {ventasSemana.length === 0 ? (
            <div className="text-center text-gray-600 text-sm py-8">Sin datos aún — realiza tu primera venta</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ventasSemana}>
                <XAxis dataKey="dia" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => "$"+v.toLocaleString("es-CL")} />
                <Tooltip
                  contentStyle={{ background: "#13131f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [fmt(v), "Total"]}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top productos */}
        <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
          <div className="text-sm font-medium text-white mb-4">Productos más vendidos</div>
          {topProductos.length === 0 ? (
            <div className="text-center text-gray-600 text-sm py-8">Sin datos aún</div>
          ) : (
            <div className="flex flex-col gap-2">
              {topProductos.map((p, i) => (
                <div key={p.nombre} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-xs text-white mb-1">{p.nombre}</div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(p.cantidad / topProductos[0].cantidad) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{p.cantidad} uds</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Últimas ventas */}
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
        <div className="text-sm font-medium text-white mb-4">Últimas ventas</div>
        {ultimasVentas.length === 0 ? (
          <div className="text-center text-gray-600 text-sm py-4">Sin ventas registradas</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["#","Fecha","Subtotal","IVA","Total","Método"].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 font-medium pb-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ultimasVentas.map(v => (
                <tr key={v.id} className="border-t border-white/5">
                  <td className="py-2 text-gray-600 text-xs">#{v.id}</td>
                  <td className="py-2 text-gray-400 text-xs">
                    {new Date(v.fecha).toLocaleString("es-CL",{dateStyle:"short",timeStyle:"short"})}
                  </td>
                  <td className="py-2 text-gray-400">{fmt(v.subtotal)}</td>
                  <td className="py-2 text-gray-400">{fmt(v.iva)}</td>
                  <td className="py-2 text-green-400 font-medium">{fmt(v.total)}</td>
                  <td className="py-2">
                    <span className="bg-white/10 text-gray-300 text-xs px-2 py-0.5 rounded-full capitalize">{v.metodo_pago}</span>
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