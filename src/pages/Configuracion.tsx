import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { Usuario, Rol } from "../types";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import Modal from "../components/Modal";

const ROLES: Rol[] = ["admin","supervisor","cajero"];
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
        await db.execute("UPDATE usuarios SET nombre=?,pin_hash=?,rol=? WHERE id=?", [form.nombre, form.pin_hash, form.rol, editando]);
      } else {
        await db.execute("UPDATE usuarios SET nombre=?,rol=? WHERE id=?", [form.nombre, form.rol, editando]);
      }
      toast.success("Usuario actualizado");
    } else {
      await db.execute("INSERT INTO usuarios (nombre,pin_hash,rol,activo) VALUES (?,?,?,1)", [form.nombre, form.pin_hash, form.rol]);
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

  const rolColor: Record<Rol, string> = {
    admin: "bg-purple-500/20 text-purple-400",
    supervisor: "bg-blue-500/20 text-blue-400",
    cajero: "bg-green-500/20 text-green-400",
  };

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-[15px]">⚙️ Configuración — Usuarios</h2>
        <button
          onClick={() => { setForm(vacio); setEditando(null); setModal(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-all"
        >
          + Nuevo usuario
        </button>
      </div>

      <div className="bg-[#13131e] border border-[#2a2a3d] rounded-xl overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-[#0f0f18] border-b border-[#1e1e2e]">
            <tr>
              {["Nombre","PIN","Rol","Estado","Acciones"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[#4d4d6a] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-t border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
                <td className="px-4 py-3 text-white font-medium">{u.nombre}</td>
                <td className="px-4 py-3 font-mono text-[#6060a0]">{"•".repeat(u.pin_hash.length)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${rolColor[u.rol as Rol]}`}>{u.rol}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded ${u.activo ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => { setForm({ nombre: u.nombre, pin_hash: "", rol: u.rol as Rol }); setEditando(u.id!); setModal(true); }} className="text-[11px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-all">Editar</button>
                  <button onClick={() => toggleActivo(u)} className={`text-[11px] px-2 py-1 rounded transition-all ${u.activo ? "bg-red-500/20 hover:bg-red-500/40 text-red-400" : "bg-green-500/20 hover:bg-green-500/40 text-green-400"}`}>
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal abierto={modal} onCerrar={() => { setModal(false); setForm(vacio); }} titulo={editando ? "Editar usuario" : "Nuevo usuario"}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-[#4d4d6a] mb-1 block">Nombre</label>
            <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
              placeholder="Juan Pérez"
              className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-[13px] outline-none focus:border-[#3b5bdb]"/>
          </div>
          <div>
            <label className="text-[11px] text-[#4d4d6a] mb-1 block">PIN {editando && "(dejar vacío para no cambiar)"}</label>
            <input type="password" value={form.pin_hash} onChange={e => setForm({...form, pin_hash: e.target.value})}
              placeholder="****" maxLength={8}
              className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-[13px] outline-none focus:border-[#3b5bdb]"/>
          </div>
          <div>
            <label className="text-[11px] text-[#4d4d6a] mb-1 block">Rol</label>
            <select value={form.rol} onChange={e => setForm({...form, rol: e.target.value as Rol})}
              className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-[13px] outline-none">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-[12px] text-[#6060a0] border border-[#2a2a3d] rounded-lg hover:text-white transition-all">Cancelar</button>
            <button onClick={guardar} className="px-4 py-2 text-[12px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all">
              {editando ? "Guardar" : "Crear"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}