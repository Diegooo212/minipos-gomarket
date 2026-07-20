import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { Proveedor } from "../types";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import toast from "react-hot-toast";

const vacio: Proveedor = { nombre: "", contacto: "", telefono: "", email: "" };

export default function Proveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Proveedor>(vacio);
  const [editando, setEditando] = useState<number | null>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const db = await getDB();
    const rows = await db.select<Proveedor[]>("SELECT * FROM proveedores ORDER BY nombre");
    setProveedores(rows);
  }

  async function guardar() {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    const db = await getDB();
    if (editando) {
      await db.execute(
        "UPDATE proveedores SET nombre=?,contacto=?,telefono=?,email=? WHERE id=?",
        [form.nombre, form.contacto, form.telefono, form.email, editando]
      );
      toast.success("Proveedor actualizado");
    } else {
      await db.execute(
        "INSERT INTO proveedores (nombre,contacto,telefono,email) VALUES (?,?,?,?)",
        [form.nombre, form.contacto, form.telefono, form.email]
      );
      toast.success("Proveedor agregado");
    }
    setModal(false); setForm(vacio); setEditando(null); cargar();
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este proveedor?")) return;
    const db = await getDB();
    await db.execute("DELETE FROM proveedores WHERE id=?", [id]);
    toast.success("Proveedor eliminado"); cargar();
  }

  const filtrados = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.contacto.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <PageHeader titulo="Proveedores">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar proveedor..."
          className="input"
          style={{ width: 280 }}
        />
        <button onClick={() => { setForm(vacio); setEditando(null); setModal(true); }} className="btn btn-primary">
          + Nuevo proveedor
        </button>
      </PageHeader>

      <div style={{ flex: 1, overflow: "hidden", margin: "var(--space-4) var(--space-5) var(--space-5)" }}>
        <div className="card" style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="scroll-area" style={{ flex: 1 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={5}><div className="empty-state">Sin proveedores registrados</div></td></tr>
                )}
                {filtrados.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{p.contacto || "—"}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{p.telefono || "—"}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{p.email || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        <button onClick={() => { setForm({ ...p }); setEditando(p.id!); setModal(true); }}
                          className="btn btn-ghost btn-sm">Editar</button>
                        <button onClick={() => eliminar(p.id!)} className="btn btn-danger btn-sm">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        abierto={modal}
        onCerrar={() => { setModal(false); setForm(vacio); }}
        titulo={editando ? "Editar proveedor" : "Nuevo proveedor"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[
            { label: "Nombre empresa", key: "nombre", placeholder: "Distribuidora Central" },
            { label: "Contacto", key: "contacto", placeholder: "Juan Pérez" },
            { label: "Teléfono", key: "telefono", placeholder: "+56912345678" },
            { label: "Email", key: "email", placeholder: "contacto@empresa.cl" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.label}
              </label>
              <input
                value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="input"
              />
            </div>
          ))}
          <div className="modal-footer" style={{ padding: 0, paddingTop: "var(--space-4)", justifyContent: "flex-end" }}>
            <button onClick={() => setModal(false)} className="btn btn-ghost">Cancelar</button>
            <button onClick={guardar} className="btn btn-primary">
              {editando ? "Guardar" : "Agregar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}