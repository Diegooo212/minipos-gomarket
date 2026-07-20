import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { Producto } from "../types";
import { fmtCLP } from "../utils/format";
import Modal from "../components/Modal";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import toast from "react-hot-toast";

const CATEGORIAS = [
  { id: 1, nombre: "Bebidas" }, { id: 2, nombre: "Abarrotes" },
  { id: 3, nombre: "Lácteos" }, { id: 4, nombre: "Panadería" },
  { id: 5, nombre: "Aseo" },    { id: 6, nombre: "Snacks" },
  { id: 7, nombre: "Conservas"},{ id: 8, nombre: "Cigarrillos" },
  { id: 9, nombre: "Refrigerados" }, { id: 10, nombre: "General" },
];

const vacio: Producto = {
  nombre: "", codigo_barra: "", precio_venta: 0, precio_costo: 0,
  stock: 0, stock_minimo: 5, categoria_id: 10, activo: true, unidad: "unidad",
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
      WHERE p.activo = 1 ORDER BY p.nombre
    `);
    setProductos(rows);
  }

  async function guardar() {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (form.precio_venta <= 0) { toast.error("El precio debe ser mayor a 0"); return; }
    const db = await getDB();
    if (editando) {
      await db.execute(
        `UPDATE productos SET nombre=?,codigo_barra=?,precio_venta=?,precio_costo=?,
         stock=?,stock_minimo=?,categoria_id=?,unidad=? WHERE id=?`,
        [form.nombre, form.codigo_barra, form.precio_venta, form.precio_costo,
         form.stock, form.stock_minimo, form.categoria_id, form.unidad, editando]
      );
      toast.success("Producto actualizado");
    } else {
      await db.execute(
        `INSERT INTO productos (nombre,codigo_barra,precio_venta,precio_costo,
         stock,stock_minimo,categoria_id,unidad,activo) VALUES (?,?,?,?,?,?,?,?,1)`,
        [form.nombre, form.codigo_barra, form.precio_venta, form.precio_costo,
         form.stock, form.stock_minimo, form.categoria_id, form.unidad]
      );
      toast.success("Producto agregado");
    }
    setModal(false); setForm(vacio); setEditando(null); cargar();
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;
    const db = await getDB();
    await db.execute("UPDATE productos SET activo=0 WHERE id=?", [id]);
    toast.success("Producto eliminado"); cargar();
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

  const stockBajo = productos.filter(p => p.stock <= p.stock_minimo && p.stock > 0).length;
  const sinStock = productos.filter(p => p.stock === 0).length;
  const categorias = [...new Set(productos.map(p => p.categoria_id))].length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <PageHeader titulo="Inventario">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto, categoría o código..."
          className="input"
          style={{ width: 320 }}
        />
        <button onClick={() => abrir()} className="btn btn-primary">
          + Nuevo producto
        </button>
      </PageHeader>

      {/* KPIs */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)",
        gap: "var(--space-3)", padding: "var(--space-4) var(--space-5)",
        flexShrink: 0,
      }}>
        <KpiCard label="Total productos" value={productos.length} />
        <KpiCard label="Stock bajo" value={stockBajo} valueColor={stockBajo > 0 ? "var(--warning)" : undefined} />
        <KpiCard label="Sin stock" value={sinStock} valueColor={sinStock > 0 ? "var(--danger)" : undefined} />
        <KpiCard label="Categorías" value={categorias} />
      </div>

      {/* Tabla */}
      <div style={{
        flex: 1, overflow: "hidden",
        margin: "0 var(--space-5) var(--space-5)",
      }}>
        <div className="card" style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="scroll-area" style={{ flex: 1 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Categoría</th>
                  <th style={{ textAlign: "right" }}>Precio venta</th>
                  <th style={{ textAlign: "right" }}>Costo</th>
                  <th style={{ textAlign: "right" }}>Margen</th>
                  <th style={{ textAlign: "right" }}>Stock</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">Sin productos encontrados</div>
                    </td>
                  </tr>
                )}
                {filtrados.map(p => {
                  const mg = margen(p);
                  const stockColor = p.stock === 0
                    ? "var(--danger)"
                    : p.stock <= p.stock_minimo
                    ? "var(--warning)"
                    : "var(--text-primary)";
                  const margenColor = mg === null ? "var(--text-muted)"
                    : mg >= 30 ? "var(--success)"
                    : mg >= 15 ? "var(--warning)"
                    : "var(--danger)";

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        {p.codigo_barra || "—"}
                      </td>
                      <td>
                        <span className="badge badge-info">{p.categoria_nombre || "General"}</span>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--success)", fontWeight: 600 }}>
                        {fmtCLP(p.precio_venta)}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                        {fmtCLP(p.precio_costo)}
                      </td>
                      <td style={{ textAlign: "right", color: margenColor, fontWeight: 600 }}>
                        {mg !== null ? `${mg}%` : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: stockColor, fontWeight: 600 }}>
                        {p.stock === 0 ? "⛔ 0" : p.stock <= p.stock_minimo ? `⚠ ${p.stock}` : p.stock}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                          <button onClick={() => abrir(p)} className="btn btn-ghost btn-sm">Editar</button>
                          <button onClick={() => eliminar(p.id!)} className="btn btn-danger btn-sm">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal
        abierto={modal}
        onCerrar={() => { setModal(false); setForm(vacio); }}
        titulo={editando ? "Editar producto" : "Nuevo producto"}
        ancho="500px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Nombre del producto
              </label>
              <input
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Coca-Cola 1.5L"
                className="input"
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Código de barra
              </label>
              <input
                value={form.codigo_barra}
                onChange={e => setForm({ ...form, codigo_barra: e.target.value })}
                placeholder="Escanea o escribe el código"
                className="input"
                style={{ fontFamily: "monospace" }}
              />
            </div>

            {[
              { label: "Precio venta", key: "precio_venta" },
              { label: "Precio costo", key: "precio_costo" },
              { label: "Stock actual", key: "stock" },
              { label: "Stock mínimo", key: "stock_minimo" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {f.label}
                </label>
                <input
                  type="number"
                  value={(form as any)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: Number(e.target.value) })}
                  className="input"
                />
              </div>
            ))}

            <div>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Categoría
              </label>
              <select
                value={form.categoria_id}
                onChange={e => setForm({ ...form, categoria_id: Number(e.target.value) })}
                className="input"
              >
                {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Unidad
              </label>
              <select
                value={form.unidad}
                onChange={e => setForm({ ...form, unidad: e.target.value })}
                className="input"
              >
                {["unidad","kg","litro","paquete","caja","cajetilla"].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Margen calculado */}
            {form.precio_venta > 0 && form.precio_costo > 0 && (
              <div style={{
                gridColumn: "1 / -1",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)",
              }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
                  Margen calculado
                </span>
                <span style={{
                  fontSize: "var(--text-lg)", fontWeight: 700,
                  color: margen(form)! >= 30 ? "var(--success)" : margen(form)! >= 15 ? "var(--warning)" : "var(--danger)",
                }}>
                  {margen(form)}%
                </span>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ padding: 0, paddingTop: "var(--space-4)", justifyContent: "flex-end" }}>
            <button onClick={() => { setModal(false); setForm(vacio); }} className="btn btn-ghost">
              Cancelar
            </button>
            <button onClick={guardar} className="btn btn-primary">
              {editando ? "Guardar cambios" : "Agregar producto"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}