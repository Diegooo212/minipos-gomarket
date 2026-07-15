import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { Proveedor } from "../types";
import Modal from "../components/Modal";
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
    <div className="p-4 flex flex-col gap-4 h-full overflow-hidden">
      <div className="flex gap-3">
        <input
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar proveedor..."
          className="flex-1 bg-[#1a1a2e] border border-[#2a2a3d] rounded-lg px-4 py-2.5 text-white text-[13px] outline-none focus:border-[#3b5bdb] placeholder-[#3d3d5c]"
        />
        <button
          onClick={() => { setForm(vacio); setEditando(null); setModal(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all"
        >
          + Nuevo proveedor
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#13131e] border border-[#2a2a3d] rounded-xl">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-[#0f0f18] border-b border-[#1e1e2e]">
            <tr>
              {["Nombre","Contacto","Teléfono","Email","Acciones"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[#4d4d6a] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-[#3d3d5c]">Sin proveedores registrados</td></tr>
            )}
            {filtrados.map(p => (
              <tr key={p.id} className="border-t border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
                <td className="px-4 py-3 text-white font-medium">{p.nombre}</td>
                <td className="px-4 py-3 text-[#6060a0]">{p.contacto || "—"}</td>
                <td className="px-4 py-3 text-[#6060a0]">{p.telefono || "—"}</td>
                <td className="px-4 py-3 text-[#6060a0]">{p.email || "—"}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => { setForm({...p}); setEditando(p.id!); setModal(true); }} className="text-[11px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-all">Editar</button>
                  <button onClick={() => eliminar(p.id!)} className="text-[11px] bg-red-500/20 hover:bg-red-500/40 text-red-400 px-2 py-1 rounded transition-all">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal abierto={modal} onCerrar={() => { setModal(false); setForm(vacio); }} titulo={editando ? "Editar proveedor" : "Nuevo proveedor"}>
        <div className="flex flex-col gap-3">
          {[
            { label: "Nombre empresa", key: "nombre", placeholder: "Distribuidora Central" },
            { label: "Contacto", key: "contacto", placeholder: "Juan Pérez" },
            { label: "Teléfono", key: "telefono", placeholder: "+56912345678" },
            { label: "Email", key: "email", placeholder: "contacto@empresa.cl" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[11px] text-[#4d4d6a] mb-1 block">{f.label}</label>
              <input
                value={(form as any)[f.key]}
                onChange={e => setForm({...form, [f.key]: e.target.value})}
                placeholder={f.placeholder}
                className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg px-3 py-2 text-white text-[13px] outline-none focus:border-[#3b5bdb]"
              />
            </div>
          ))}
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-[12px] text-[#6060a0] border border-[#2a2a3d] rounded-lg hover:text-white transition-all">Cancelar</button>
            <button onClick={guardar} className="px-4 py-2 text-[12px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all">
              {editando ? "Guardar" : "Agregar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}