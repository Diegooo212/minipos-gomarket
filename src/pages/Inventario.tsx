import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { Producto } from "../types";
import { fmtCLP } from "../utils/format";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const CATEGORIAS = [
  { id: 1, nombre: "Bebidas" },
  { id: 2, nombre: "Abarrotes" },
  { id: 3, nombre: "Lácteos" },
  { id: 4, nombre: "Panadería" },
  { id: 5, nombre: "Aseo" },
  { id: 6, nombre: "Snacks" },
  { id: 7, nombre: "Conservas" },
  { id: 8, nombre: "Cigarrillos" },
  { id: 9, nombre: "Refrigerados" },
  { id: 10, nombre: "General" },
];

const vacio: Producto = {
  nombre: "",
  codigo_barra: "",
  precio_venta: 0,
  precio_costo: 0,
  stock: 0,
  stock_minimo: 5,
  categoria_id: 10,
  activo: true,
  unidad: "unidad",
};

export default function Inventario() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Producto>(vacio);
  const [editando, setEditando] = useState<number | null>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const db = await getDB();
    const rows = await db.select<Producto[]>(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1
      ORDER BY p.nombre
    `);
    setProductos(rows);
  }

  async function guardar() {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (form.precio_venta <= 0) { toast.error("El precio debe ser mayor a 0"); return; }
    const db = await getDB();
    if (editando) {
      await db.execute(
        `UPDATE productos SET
          nombre=?, codigo_barra=?, precio_venta=?, precio_costo=?,
          stock=?, stock_minimo=?, categoria_id=?, unidad=?
         WHERE id=?`,
        [
          form.nombre, form.codigo_barra, form.precio_venta, form.precio_costo,
          form.stock, form.stock_minimo, form.categoria_id, form.unidad,
          editando
        ]
      );
      toast.success("Producto actualizado");
    } else {
      await db.execute(
        `INSERT INTO productos
          (nombre, codigo_barra, precio_venta, precio_costo, stock, stock_minimo, categoria_id, unidad, activo)
         VALUES (?,?,?,?,?,?,?,?,1)`,
        [
          form.nombre, form.codigo_barra, form.precio_venta, form.precio_costo,
          form.stock, form.stock_minimo, form.categoria_id, form.unidad
        ]
      );
      toast.success("Producto agregado");
    }
    setModal(false);
    setForm(vacio);
    setEditando(null);
    cargar();
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;
    const db = await getDB();
    await db.execute("UPDATE productos SET activo=0 WHERE id=?", [id]);
    toast.success("Producto eliminado");
    cargar();
  }

  function abrir(p?: Producto) {
    setForm(p ? { ...p } : vacio);
    setEditando(p?.id ?? null);
    setModal(true);
  }

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.codigo_barra ?? "").includes(busqueda) ||
    (p.categoria_nombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const margen = (p: Producto) => {
    if (!p.precio_costo || p.precio_costo === 0) return null;
    return Math.round(((p.precio_venta - p.precio_costo) / p.precio_venta) * 100);
  };

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto, categoría o código de barra..."
          className="flex-1 bg-[#1a1a2e] border border-[#2a2a3d] rounded-lg px-4 py-2.5 text-white text-[13px] outline-none focus:border-[#3b5bdb] placeholder-[#3d3d5c]"
        />
        <button
          onClick={() => abrir()}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all"
        >
          + Nuevo producto
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total productos", value: productos.length, color: "text-blue-400" },
          { label: "Stock bajo", value: productos.filter(p => p.stock <= p.stock_minimo && p.stock > 0).length, color: "text-yellow-400" },
          { label: "Sin stock", value: productos.filter(p => p.stock === 0).length, color: "text-red-400" },
          { label: "Categorías", value: [...new Set(productos.map(p => p.categoria_id))].length, color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1a2e] border border-[#2a2a3d] rounded-xl p-3">
            <div className="text-[11px] text-[#4d4d6a] mb-1">{s.label}</div>
            <div className={`text-[22px] font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto bg-[#13131e] border border-[#2a2a3d] rounded-xl">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-[#0f0f18] border-b border-[#1e1e2e]">
            <tr>
              {["Producto","Código","Categoría","Precio venta","Costo","Margen","Stock","Acciones"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[#4d4d6a] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-[#3d3d5c]">Sin productos encontrados</td>
              </tr>
            )}
            {filtrados.map(p => {
              const mg = margen(p);
              return (
                <tr key={p.id} className="border-t border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{p.nombre}</td>
                  <td className="px-4 py-3 text-[#6060a0] font-mono text-[11px]">{p.codigo_barra || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full">
                      {p.categoria_nombre || "General"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-green-400 font-semibold">{fmtCLP(p.precio_venta)}</td>
                  <td className="px-4 py-3 text-[#6060a0]">{fmtCLP(p.precio_costo)}</td>
                  <td className="px-4 py-3">
                    {mg !== null ? (
                      <span className={`font-medium ${mg >= 30 ? "text-green-400" : mg >= 15 ? "text-yellow-400" : "text-red-400"}`}>
                        {mg}%
                      </span>
                    ) : <span className="text-[#3d3d5c]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${
                      p.stock === 0 ? "text-red-400" :
                      p.stock <= p.stock_minimo ? "text-yellow-400" :
                      "text-white"
                    }`}>
                      {p.stock === 0 ? "⛔ 0" : p.stock <= p.stock_minimo ? `⚠ ${p.stock}` : p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => abrir(p)}
                      className="text-[11px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-all"
                    >Editar</button>
                    <button
                      onClick={() => eliminar(p.id!)}
                      className="text-[11px] bg-red-500/20 hover:bg-red-500/40 text-red-400 px-2 py-1 rounded transition-all"
                    >Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal
        abierto={modal}
        onCerrar={() => { setModal(false); setForm(vacio); }}
        titulo={editando ? "Editar producto" : "Nuevo producto"}
        ancho="w-[520px]"
      >
        <div className="grid grid-cols-2 gap-3">
          {/* Nombre — full width */}
          <div className="col-span-2">
            <label className="text-[11px] text-[#4d4d6a] mb-1 block">Nombre del producto</label>
            <input
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Coca-Cola 1.5L"
              className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-[13px] outline-none focus:border-[#3b5bdb]"
            />
          </div>

          {/* Código de barra — full width */}
          <div className="col-span-2">
            <label className="text-[11px] text-[#4d4d6a] mb-1 block">Código de barra</label>
            <input
              value={form.codigo_barra}
              onChange={e => setForm({ ...form, codigo_barra: e.target.value })}
              placeholder="Escanea o escribe el código"
              className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-[13px] outline-none focus:border-[#3b5bdb] font-mono"
            />
          </div>

          {[
            { label: "Precio venta", key: "precio_venta" },
            { label: "Precio costo", key: "precio_costo" },
            { label: "Stock actual", key: "stock" },
            { label: "Stock mínimo", key: "stock_minimo" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[11px] text-[#4d4d6a] mb-1 block">{f.label}</label>
              <input
                type="number"
                value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: Number(e.target.value) })}
                className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-[13px] outline-none focus:border-[#3b5bdb]"
              />
            </div>
          ))}

          <div>
            <label className="text-[11px] text-[#4d4d6a] mb-1 block">Categoría</label>
            <select
              value={form.categoria_id}
              onChange={e => setForm({ ...form, categoria_id: Number(e.target.value) })}
              className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-[13px] outline-none"
            >
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#4d4d6a] mb-1 block">Unidad</label>
            <select
              value={form.unidad}
              onChange={e => setForm({ ...form, unidad: e.target.value })}
              className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-[13px] outline-none"
            >
              {["unidad","kg","litro","paquete","caja","cajetilla"].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Margen calculado */}
          {form.precio_venta > 0 && form.precio_costo > 0 && (
            <div className="col-span-2 bg-[#0f0f18] border border-[#1e1e2e] rounded-lg px-3 py-2 flex justify-between items-center">
              <span className="text-[11px] text-[#4d4d6a]">Margen calculado</span>
              <span className={`text-[14px] font-bold ${
                margen(form)! >= 30 ? "text-green-400" :
                margen(form)! >= 15 ? "text-yellow-400" : "text-red-400"
              }`}>
                {margen(form)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={() => { setModal(false); setForm(vacio); }}
            className="px-4 py-2 text-[12px] text-[#6060a0] border border-[#2a2a3d] rounded-lg hover:text-white transition-all"
          >Cancelar</button>
          <button
            onClick={guardar}
            className="px-4 py-2 text-[12px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all"
          >
            {editando ? "Guardar cambios" : "Agregar producto"}
          </button>
        </div>
      </Modal>
    </div>
  );
}