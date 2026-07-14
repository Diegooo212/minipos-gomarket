import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { Producto } from "../types";
import toast from "react-hot-toast";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

const CATEGORIAS = ["General","Bebidas","Panadería","Lácteos","Abarrotes","Aseo","Conservas","Snacks","Frutas","Carnes"];

const vacío: Producto = { nombre:"", codigo_barra:"", precio:0, costo:0, stock:0, stock_minimo:5, categoria:"General", unidad:"unidad" };

export default function Inventario() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Producto>(vacío);
  const [editando, setEditando] = useState<number | null>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const db = await getDB();
    const rows = await db.select<Producto[]>("SELECT * FROM productos ORDER BY nombre");
    setProductos(rows);
  }

  async function guardar() {
    if (!form.nombre || form.precio <= 0) { toast.error("Nombre y precio son obligatorios"); return; }
    const db = await getDB();
    if (editando) {
      await db.execute(
        "UPDATE productos SET nombre=?,codigo_barra=?,precio=?,costo=?,stock=?,stock_minimo=?,categoria=?,unidad=? WHERE id=?",
        [form.nombre,form.codigo_barra,form.precio,form.costo,form.stock,form.stock_minimo,form.categoria,form.unidad,editando]
      );
      toast.success("Producto actualizado");
    } else {
      await db.execute(
        "INSERT INTO productos (nombre,codigo_barra,precio,costo,stock,stock_minimo,categoria,unidad) VALUES (?,?,?,?,?,?,?,?)",
        [form.nombre,form.codigo_barra,form.precio,form.costo,form.stock,form.stock_minimo,form.categoria,form.unidad]
      );
      toast.success("Producto agregado");
    }
    setModal(false); setForm(vacío); setEditando(null); cargar();
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;
    const db = await getDB();
    await db.execute("DELETE FROM productos WHERE id=?", [id]);
    toast.success("Producto eliminado"); cargar();
  }

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo_barra.includes(busqueda) ||
    p.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  function abrir(p?: Producto) {
    setForm(p ? {...p} : vacío);
    setEditando(p?.id ?? null);
    setModal(true);
  }

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3">
        <input
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto, categoría o código..."
          className="flex-1 bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500/60 placeholder-gray-600"
        />
        <button onClick={() => abrir()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2">
          + Nuevo producto
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total productos", value: productos.length, color: "text-blue-400" },
          { label: "Stock bajo", value: productos.filter(p => p.stock <= p.stock_minimo).length, color: "text-yellow-400" },
          { label: "Sin stock", value: productos.filter(p => p.stock === 0).length, color: "text-red-400" },
          { label: "Categorías", value: [...new Set(productos.map(p => p.categoria))].length, color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto bg-[#1a1a2e] border border-white/10 rounded-xl">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#13131f] border-b border-white/10">
            <tr>
              {["Producto","Código","Categoría","Precio","Costo","Stock","Acciones"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map(p => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{p.nombre}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.codigo_barra}</td>
                <td className="px-4 py-3"><span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">{p.categoria}</span></td>
                <td className="px-4 py-3 text-green-400 font-medium">{fmt(p.precio)}</td>
                <td className="px-4 py-3 text-gray-400">{fmt(p.costo)}</td>
                <td className="px-4 py-3">
                  <span className={`font-medium ${p.stock === 0 ? "text-red-400" : p.stock <= p.stock_minimo ? "text-yellow-400" : "text-white"}`}>
                    {p.stock === 0 ? "⛔ " : p.stock <= p.stock_minimo ? "⚠ " : ""}{p.stock}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => abrir(p)} className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg transition-all">Editar</button>
                  <button onClick={() => eliminar(p.id!)} className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-400 px-3 py-1 rounded-lg transition-all">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-[480px] flex flex-col gap-4">
            <h2 className="text-white font-semibold text-base">{editando ? "Editar producto" : "Nuevo producto"}</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label:"Nombre", key:"nombre", type:"text", full:true },
                { label:"Código de barra", key:"codigo_barra", type:"text" },
                { label:"Precio venta", key:"precio", type:"number" },
                { label:"Costo", key:"costo", type:"number" },
                { label:"Stock actual", key:"stock", type:"number" },
                { label:"Stock mínimo", key:"stock_minimo", type:"number" },
              ].map(f => (
                <div key={f.key} className={f.full ? "col-span-2" : ""}>
                  <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm({...form, [f.key]: f.type==="number" ? Number(e.target.value) : e.target.value})}
                    className="w-full bg-[#13131f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500/60"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm({...form, categoria: e.target.value})}
                  className="w-full bg-[#13131f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                >
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Unidad</label>
                <select
                  value={form.unidad}
                  onChange={e => setForm({...form, unidad: e.target.value})}
                  className="w-full bg-[#13131f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                >
                  {["unidad","kg","litro","paquete","caja"].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-2">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg transition-all">Cancelar</button>
              <button onClick={guardar} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all">
                {editando ? "Guardar cambios" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}