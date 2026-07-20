import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { Usuario, Rol } from "../types";
import { useAuthStore } from "../store/useAuthStore";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import toast from "react-hot-toast";

const ROLES: Rol[] = ["admin", "supervisor", "cajero"];
const vacio = { nombre: "", pin_hash: "", rol: "cajero" as Rol };

export default function Configuracion() {
  const { usuario } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<typeof vacio>(vacio);
  const [editando, setEditando] = useState<number | null>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const db = await getDB();
    const rows = await db.select<Usuario[]>("SELECT * FROM usuarios ORDER BY rol, nombre");
    setUsuarios(rows);
  }

  async function guardar() {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!editando && form.pin_hash.length < 4) { toast.error("El PIN debe tener al menos 4 dígitos"); return; }
    const db = await getDB();
    if (editando) {
      if (form.pin_hash) {
        await db.execute("UPDATE usuarios SET nombre=?,pin_hash=?,rol=? WHERE id=?",
          [form.nombre, form.pin_hash, form.rol, editando]);
      } else {
        await db.execute("UPDATE usuarios SET nombre=?,rol=? WHERE id=?",
          [form.nombre, form.rol, editando]);
      }
      toast.success("Usuario actualizado");
    } else {
      await db.execute("INSERT INTO usuarios (nombre,pin_hash,rol,activo) VALUES (?,?,?,1)",
        [form.nombre, form.pin_hash, form.rol]);
      toast.success("Usuario creado");
    }
    setModal(false); setForm(vacio); setEditando(null); cargar();
  }

  async function toggleActivo(u: Usuario) {
    if (u.id === usuario?.id) { toast.error("No puedes desactivarte a ti mismo"); return; }
    const db = await getDB();
    await db.execute("UPDATE usuarios SET activo=? WHERE id=?", [u.activo ? 0 : 1, u.id]);
    cargar();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <PageHeader titulo="Configuración — Usuarios">
        <button onClick={() => { setForm(vacio); setEditando(null); setModal(true); }} className="btn btn-primary">
          + Nuevo usuario
        </button>
      </PageHeader>

      <div style={{ flex: 1, overflow: "hidden", margin: "var(--space-4) var(--space-5) var(--space-5)" }}>
        <div className="card" style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="scroll-area" style={{ flex: 1 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>PIN</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: 4 }}>
                      {"•".repeat(u.pin_hash.length)}
                    </td>
                    <td><span className={`badge badge-${u.rol}`}>{u.rol}</span></td>
                    <td>
                      <span className={`badge ${u.activo ? "badge-activo" : "badge-inactivo"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => { setForm({ nombre: u.nombre, pin_hash: "", rol: u.rol as Rol }); setEditando(u.id!); setModal(true); }}
                          className="btn btn-ghost btn-sm"
                        >Editar</button>
                        <button
                          onClick={() => toggleActivo(u)}
                          className={`btn btn-sm ${u.activo ? "btn-danger" : "btn-ghost"}`}
                          style={!u.activo ? { color: "var(--success)" } : undefined}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
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
        titulo={editando ? "Editar usuario" : "Nuevo usuario"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase" }}>
              Nombre
            </label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Juan Pérez" className="input" />
          </div>
          <div>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase" }}>
              PIN {editando && <span style={{ fontWeight: 400, textTransform: "none" }}>(dejar vacío para no cambiar)</span>}
            </label>
            <input type="password" value={form.pin_hash}
              onChange={e => setForm({ ...form, pin_hash: e.target.value })}
              placeholder="****" maxLength={8} className="input" />
          </div>
          <div>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase" }}>
              Rol
            </label>
            <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value as Rol })}
              className="input">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="modal-footer" style={{ padding: 0, paddingTop: "var(--space-4)", justifyContent: "flex-end" }}>
            <button onClick={() => setModal(false)} className="btn btn-ghost">Cancelar</button>
            <button onClick={guardar} className="btn btn-primary">
              {editando ? "Guardar" : "Crear usuario"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}