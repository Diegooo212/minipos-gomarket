import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { fmtCLP, fmtFechaSolo } from "../utils/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const COLORES = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];

export default function Reportes() {
  const [ventasDiarias, setVentasDiarias] = useState<any[]>([]);
  const [topProductos, setTopProductos] = useState<any[]>([]);
  const [ventasPorMetodo, setVentasPorMetodo] = useState<any[]>([]);
  const [resumen, setResumen] = useState({ total: 0, cantidad: 0, ticket: 0, iva: 0 });
  const [periodo, setPeriodo] = useState<"7" | "30" | "90">("7");

  useEffect(() => { cargar(); }, [periodo]);

  async function cargar() {
    const db = await getDB();

    const diarias = await db.select<any[]>(`
      SELECT date(fecha) as dia, COUNT(*) as cantidad, SUM(total) as total
      FROM ventas WHERE estado='completada' AND fecha >= date('now','-${periodo} days')
      GROUP BY date(fecha) ORDER BY dia
    `);
    setVentasDiarias(diarias.map(r => ({
      dia: new Date(r.dia).toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit"}),
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
    setVentasPorMetodo(metodos.map(m => ({ name: m.metodo_pago, value: Math.round(m.total) })));

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

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto">
      {/* Periodo selector */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[#4d4d6a]">Período:</span>
        {[{ v:"7", l:"7 días" },{ v:"30", l:"30 días" },{ v:"90", l:"90 días" }].map(p => (
          <button
            key={p.v}
            onClick={() => setPeriodo(p.v as any)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              periodo === p.v ? "bg-blue-600 text-white" : "bg-[#1a1a2e] text-[#6060a0] hover:text-white border border-[#2a2a3d]"
            }`}
          >{p.l}</button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total ventas", value: fmtCLP(resumen.total), color: "text-green-400" },
          { label: "N° transacciones", value: resumen.cantidad.toString(), color: "text-blue-400" },
          { label: "Ticket promedio", value: fmtCLP(resumen.ticket), color: "text-purple-400" },
          { label: "IVA recaudado", value: fmtCLP(resumen.iva), color: "text-yellow-400" },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1a2e] border border-[#2a2a3d] rounded-xl p-4">
            <div className="text-[11px] text-[#4d4d6a] mb-1">{s.label}</div>
            <div className={`text-[20px] font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-4">
        {/* Ventas diarias */}
        <div className="bg-[#13131e] border border-[#2a2a3d] rounded-xl p-4">
          <div className="text-[13px] font-semibold text-white mb-4">Ventas diarias</div>
          {ventasDiarias.length === 0 ? (
            <div className="text-center text-[#3d3d5c] text-[12px] py-8">Sin datos en este período</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ventasDiarias}>
                <XAxis dataKey="dia" tick={{ fill:"#6b7280", fontSize:10 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:"#6b7280", fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => "$"+v.toLocaleString("es-CL")}/>
                <Tooltip contentStyle={{ background:"#13131f", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:12 }} formatter={(v:any) => [fmtCLP(v),"Total"]}/>
                <Bar dataKey="total" fill="#3b82f6" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Métodos de pago */}
        <div className="bg-[#13131e] border border-[#2a2a3d] rounded-xl p-4">
          <div className="text-[13px] font-semibold text-white mb-4">Por método de pago</div>
          {ventasPorMetodo.length === 0 ? (
            <div className="text-center text-[#3d3d5c] text-[12px] py-8">Sin datos</div>
          ) : (
            <div className="flex items-center gap-4">
              <PieChart width={140} height={140}>
                <Pie data={ventasPorMetodo} cx={70} cy={70} innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {ventasPorMetodo.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]}/>)}
                </Pie>
              </PieChart>
              <div className="flex flex-col gap-2">
                {ventasPorMetodo.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-2 text-[12px]">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORES[i % COLORES.length] }}/>
                    <span className="text-[#8080a0] capitalize">{m.name}</span>
                    <span className="text-white font-medium ml-auto">{fmtCLP(m.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top productos */}
      <div className="bg-[#13131e] border border-[#2a2a3d] rounded-xl p-4">
        <div className="text-[13px] font-semibold text-white mb-4">Productos más vendidos</div>
        {topProductos.length === 0 ? (
          <div className="text-center text-[#3d3d5c] text-[12px] py-4">Sin datos</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {topProductos.map((p, i) => (
              <div key={p.nombre} className="flex items-center gap-3">
                <span className="text-[11px] text-[#3d3d5c] w-4">{i+1}</span>
                <div className="flex-1">
                  <div className="text-[12px] text-white mb-1 truncate">{p.nombre}</div>
                  <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width:`${(p.cantidad/topProductos[0].cantidad)*100}%` }}/>
                  </div>
                </div>
                <span className="text-[11px] text-[#6060a0] shrink-0">{p.cantidad} uds</span>
                <span className="text-[11px] text-green-400 shrink-0 w-16 text-right">{fmtCLP(p.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}