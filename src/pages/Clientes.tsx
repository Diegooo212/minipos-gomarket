import { useState, useEffect } from "react";
import { getDB } from "../db/database";
import { Cliente } from "../types";
import { fmtCLP, fmtFecha } from "../utils/format";
import Modal from "../components/Modal";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
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

  const totalFiado = clientes.reduce((a, c) => a + c.saldo_fiado, 0);
  const conFiado = clientes.filter(c => c.saldo_fiado > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      <PageHeader titulo="Clientes">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, RUT o teléfono..."
          className="input"
          style={{ width: 300 }}
        />
        <button onClick={() => { setForm(vacio); setEditando(null); setModal(true); }} className="btn btn-primary">
          + Nuevo cliente
        </button>
      </PageHeader>

      {/* KPIs */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3,1fr)",
        gap: "var(--space-3)", padding: "var(--space-4) var(--space-5)", flexShrink: 0,
      }}>
        <KpiCard label="Total clientes" value={clientes.length} />
        <KpiCard label="Con fiado" value={conFiado} valueColor={conFiado > 0 ? "var(--warning)" : undefined} />
        <KpiCard label="Total fiado" value={fmtCLP(totalFiado)} valueColor={totalFiado > 0 ? "var(--danger)" : undefined} />
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflow: "hidden", margin: "0 var(--space-5) var(--space-5)" }}>
        <div className="card" style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="scroll-area" style={{ flex: 1 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>RUT</th>
                  <th>Teléfono</th>
                  <th style={{ textAlign: "right" }}>Fiado</th>
                  <th style={{ textAlign: "right" }}>Puntos</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state">Sin clientes registrados</div></td></tr>
                )}
                {filtrados.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: "var(--text-xs)" }}>
                      {c.rut || "—"}
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{c.telefono || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {c.saldo_fiado > 0
                        ? <span style={{ color: "var(--danger)", fontWeight: 700 }}>{fmtCLP(c.saldo_fiado)}</span>
                        : <span style={{ color: "var(--text-disabled)" }}>—</span>
                      }
                    </td>
                    <td style={{ textAlign: "right", color: "var(--text-muted)" }}>{c.puntos}</td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        <button onClick={() => abrirFiado(c)} className="btn btn-ghost btn-sm"
                          style={{ color: "var(--warning)" }}>
                          Fiado
                        </button>
                        <button onClick={() => { setForm({ ...c }); setEditando(c.id!); setModal(true); }}
                          className="btn btn-ghost btn-sm">
                          Editar
                        </button>
                        <button onClick={() => eliminar(c.id!)} className="btn btn-danger btn-sm">
                          Eliminar
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

      {/* Modal nuevo/editar */}
      <Modal
        abierto={modal}
        onCerrar={() => { setModal(false); setForm(vacio); }}
        titulo={editando ? "Editar cliente" : "Nuevo cliente"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[
            { label: "Nombre completo", key: "nombre", placeholder: "Juan Pérez" },
            { label: "RUT", key: "rut", placeholder: "12.345.678-9" },
            { label: "Teléfono", key: "telefono", placeholder: "+56912345678" },
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
              {editando ? "Guardar cambios" : "Agregar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal fiado */}
      <Modal
        abierto={modalFiado}
        onCerrar={() => setModalFiado(false)}
        titulo="Fiado"
        subtitulo={clienteSeleccionado?.nombre}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)",
          }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Saldo pendiente
            </span>
            <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--danger)" }}>
              {fmtCLP(clienteSeleccionado?.saldo_fiado ?? 0)}
            </span>
          </div>

          <div>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase" }}>
              Registrar pago
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontWeight: 700 }}>$</span>
              <input
                type="number"
                value={montoFiado}
                onChange={e => setMontoFiado(e.target.value)}
                placeholder="0"
                className="input input-lg"
                autoFocus
              />
            </div>
          </div>

          {historial.length > 0 && (
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
                Últimas compras
              </div>
              <div style={{ maxHeight: 120, overflowY: "auto" }}>
                {historial.map(v => (
                  <div key={v.id} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "var(--space-2) 0",
                    borderBottom: "1px solid var(--border-subtle)",
                    fontSize: "var(--text-xs)",
                  }}>
                    <span style={{ color: "var(--text-muted)" }}>{fmtFecha(v.fecha)}</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmtCLP(v.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ padding: 0, paddingTop: "var(--space-2)", justifyContent: "flex-end" }}>
            <button onClick={() => setModalFiado(false)} className="btn btn-ghost">Cerrar</button>
            <button onClick={registrarPagoFiado} className="btn btn-success">Registrar pago</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}