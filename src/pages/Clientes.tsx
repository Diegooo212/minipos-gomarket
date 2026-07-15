import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { Cliente } from "../types";
import { fmtCLP, fmtFecha } from "../utils/format";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const vacio: Cliente = { nombre: "", telefono: "", rut: "", saldo_fiado: 0, puntos: 0 };

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(false);
  const [modalFiado, setModalFiado] = useState(false);
  const [form, setForm] = useState<Cliente>(vacio);
  const [editando, setEditando] = useState<number | null>(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [montoFiado, setMontoFiado] = useState("");
  const [historial, setHistorial] = useState<any[]>([]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const db = await getDB();
    const rows = await db.select<Cliente[]>("SELECT * FROM clientes ORDER BY nombre");
    setClientes(rows);
  }

  async function guardar() {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    const db = await getDB();
    if (editando) {
      await db.execute(
        "UPDATE clientes SET nombre=?,telefono=?,rut=? WHERE id=?",
        [form.nombre, form.telefono, form.rut, editando]
      );
      toast.success("Cliente actualizado");
    } else {
      await db.execute(
        "INSERT INTO clientes (nombre,telefono,rut,saldo_fiado,puntos) VALUES (?,?,?,0,0)",
        [form.nombre, form.telefono, form.rut]
      );
      toast.success("Cliente agregado");
    }
    setModal(false); setForm(vacio); setEditando(null); cargar();
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este cliente?")) return;
    const db = await getDB();
    await db.execute("DELETE FROM clientes WHERE id=?", [id]);
    toast.success("Cliente eliminado"); cargar();
  }

  async function abrirFiado(c: Cliente) {
    setClienteSeleccionado(c);
    const db = await getDB();
    const rows = await db.select<any[]>(
      "SELECT * FROM ventas WHERE cliente_id=? ORDER BY fecha DESC LIMIT 10",
      [c.id]
    );
    setHistorial(rows);
    setMontoFiado("");
    setModalFiado(true);
  }

  async function registrarPagoFiado() {
    if (!clienteSeleccionado) return;
    const monto = parseFloat(montoFiado) || 0;
    if (monto <= 0) { toast.error("Ingresa un monto válido"); return; }
    const db = await getDB();
    await db.execute(
      "UPDATE clientes SET saldo_fiado = MAX(0, saldo_fiado - ?) WHERE id=?",
      [monto, clienteSeleccionado.id]
    );
    toast.success(`Pago de ${fmtCLP(monto)} registrado`);
    setModalFiado(false); cargar();
  }

  const filtrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono.includes(busqueda) ||
    c.rut.includes(busqueda)
  );

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-hidden">
      <div className="flex gap-3">
        <input
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, RUT o teléfono..."
          className="flex-1 bg-[#1a1a2e] border border-[#2a2a3d] rounded-lg px-4 py-2.5 text-white text-[13px] outline-none focus:border-[#3b5bdb] placeholder-[#3d3d5c]"
        />
        <button
          onClick={() => { setForm(vacio); setEditando(null); setModal(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all"
        >
          + Nuevo cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total clientes", value: clientes.length, color: "text-blue-400" },
          { label: "Con fiado", value: clientes.filter(c => c.saldo_fiado > 0).length, color: "text-red-400" },
          { label: "Total fiado", value: fmtCLP(clientes.reduce((a, c) => a + c.saldo_fiado, 0)), color: "text-yellow-400" },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1a2e] border border-[#2a2a3d] rounded-xl p-3">
            <div className="text-[11px] text-[#4d4d6a] mb-1">{s.label}</div>
            <div className={`text-[20px] font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto bg-[#13131e] border border-[#2a2a3d] rounded-xl">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-[#0f0f18] border-b border-[#1e1e2e]">
            <tr>
              {["Nombre","RUT","Teléfono","Fiado","Puntos","Acciones"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[#4d4d6a] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-[#3d3d5c]">Sin clientes registrados</td></tr>
            )}
            {filtrados.map(c => (
              <tr key={c.id} className="border-t border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
                <td className="px-4 py-3 text-white font-medium">{c.nombre}</td>
                <td className="px-4 py-3 text-[#6060a0] font-mono">{c.rut || "—"}</td>
                <td className="px-4 py-3 text-[#6060a0]">{c.telefono || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${c.saldo_fiado > 0 ? "text-red-400" : "text-[#3d3d5c]"}`}>
                    {c.saldo_fiado > 0 ? fmtCLP(c.saldo_fiado) : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#6060a0]">{c.puntos}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => abrirFiado(c)} className="text-[11px] bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 px-2 py-1 rounded transition-all">Fiado</button>
                  <button onClick={() => { setForm({...c}); setEditando(c.id!); setModal(true); }} className="text-[11px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-all">Editar</button>
                  <button onClick={() => eliminar(c.id!)} className="text-[11px] bg-red-500/20 hover:bg-red-500/40 text-red-400 px-2 py-1 rounded transition-all">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo/editar */}
      <Modal abierto={modal} onCerrar={() => { setModal(false); setForm(vacio); }} titulo={editando ? "Editar cliente" : "Nuevo cliente"}>
        <div className="flex flex-col gap-3">
          {[
            { label: "Nombre completo", key: "nombre", placeholder: "Juan Pérez" },
            { label: "RUT", key: "rut", placeholder: "12.345.678-9" },
            { label: "Teléfono", key: "telefono", placeholder: "+56912345678" },
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
            <button onClick={() => setModal(false)} className="px-4 py-2 text-[12px] text-[#6060a0] hover:text-white border border-[#2a2a3d] rounded-lg transition-all">Cancelar</button>
            <button onClick={guardar} className="px-4 py-2 text-[12px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all">
              {editando ? "Guardar cambios" : "Agregar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal fiado */}
      <Modal abierto={modalFiado} onCerrar={() => setModalFiado(false)} titulo={`Fiado — ${clienteSeleccionado?.nombre}`}>
        <div className="flex flex-col gap-4">
          <div className="bg-[#0f0f18] border border-[#1e1e2e] rounded-lg p-3 flex justify-between items-center">
            <span className="text-[12px] text-[#4d4d6a]">Saldo pendiente</span>
            <span className="text-[20px] font-bold text-red-400">{fmtCLP(clienteSeleccionado?.saldo_fiado ?? 0)}</span>
          </div>
          <div>
            <label className="text-[11px] text-[#4d4d6a] mb-1 block">Registrar pago</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d4d6a] font-bold">$</span>
              <input
                type="number"
                value={montoFiado}
                onChange={e => setMontoFiado(e.target.value)}
                placeholder="0"
                className="w-full bg-[#0f0f18] border border-[#2a2a3d] rounded-lg pl-8 pr-4 py-2.5 text-white text-[16px] font-bold outline-none focus:border-[#3b5bdb]"
                autoFocus
              />
            </div>
          </div>
          {historial.length > 0 && (
            <div>
              <div className="text-[11px] text-[#4d4d6a] mb-2">Últimas compras</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {historial.map(v => (
                  <div key={v.id} className="flex justify-between text-[11px] py-1 border-b border-[#1e1e2e]">
                    <span className="text-[#6060a0]">{fmtFecha(v.fecha)}</span>
                    <span className="text-white">{fmtCLP(v.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setModalFiado(false)} className="px-4 py-2 text-[12px] text-[#6060a0] border border-[#2a2a3d] rounded-lg hover:text-white transition-all">Cerrar</button>
            <button onClick={registrarPagoFiado} className="px-4 py-2 text-[12px] bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all">Registrar pago</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}