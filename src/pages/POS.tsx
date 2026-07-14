import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "../store/useStore";
import { useAuthStore } from "../store/useAuthStore";
import { useCajaStore } from "../store/useCajaStore";
import { getDB } from "../db/database";
import { Producto } from "../types";
import { fmtCLP } from "../utils/format";
import toast from "react-hot-toast";

export default function POS() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const [montoPagado, setMontoPagado] = useState("");
  const { carrito, agregarItem, quitarItem, cambiarCantidad, limpiarCarrito } = useStore();
  const { usuario } = useAuthStore();
  const { turno, agregarVentaAlTurno } = useCajaStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const montoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { cargarProductos(); inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (modalPago) setTimeout(() => montoRef.current?.focus(), 100);
  }, [modalPago]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (modalPago) {
        if (e.key === "Escape") { setModalPago(false); setMontoPagado(""); }
        return;
      }
      if (e.key === "+" || e.key === "Add") {
        e.preventDefault();
        if (productoSeleccionado !== null) cambiarCantidad(productoSeleccionado, 1);
      }
      if (e.key === "-" || e.key === "Subtract") {
        e.preventDefault();
        if (productoSeleccionado !== null) cambiarCantidad(productoSeleccionado, -1);
      }
      if (e.key === "F10") { e.preventDefault(); abrirModal(); }
      if (e.key === "Escape") { limpiarCarrito(); setProductoSeleccionado(null); }
      if (e.key === "F4") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [carrito, modalPago, productoSeleccionado]);

  async function cargarProductos() {
    const db = await getDB();
    const rows = await db.select<Producto[]>(
      "SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.activo = 1 ORDER BY p.nombre"
    );
    setProductos(rows);
  }

  const handleScan = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const codigo = busqueda.trim();
    if (!codigo) return;

    const encontrado = productos.find((p) => {
      const codigoDB = (p.codigo_barra ?? "").toString().trim();
      const codigoInput = codigo.toString().trim();
      return (
        codigoDB === codigoInput ||
        codigoDB.startsWith(codigoInput) ||
        codigoInput.startsWith(codigoDB) ||
        p.nombre.toLowerCase().includes(codigoInput.toLowerCase())
      );
    });

    if (encontrado) {
      agregar(encontrado);
      setBusqueda("");
    } else {
      toast.error(`"${codigo}" no encontrado`);
      setBusqueda("");
    }
  }, [busqueda, productos]);

  function agregar(p: Producto) {
    if (!p.id) return;
    agregarItem({
      producto_id: p.id,
      nombre: p.nombre,
      precio_unitario: Number(p.precio_venta),
      precio_costo: Number(p.precio_costo),
      cantidad: 1,
      descuento: 0,
      subtotal: Number(p.precio_venta),
    });
    setProductoSeleccionado(p.id);
    toast.success(`${p.nombre}`, { duration: 600, position: "bottom-right" });
  }

  const subtotal = carrito.reduce((a, i) => a + Number(i.subtotal), 0);
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;
  const monto = parseFloat(montoPagado) || 0;
  const vuelto = monto - total;
  const metodoPago = monto > 0 ? "efectivo" : "debito";

  function abrirModal() {
    if (carrito.length === 0) { toast.error("El carrito está vacío"); return; }
    if (!turno) { toast.error("Debes abrir una caja primero — ve a F8"); return; }
    setMontoPagado("");
    setModalPago(true);
  }

  async function confirmarPago() {
    if (monto > 0 && monto < total) { toast.error("Monto insuficiente"); return; }
    if (!usuario || !turno) { toast.error("Sesión inválida"); return; }
    setCargando(true);
    try {
      const db = await getDB();
      const result = await db.execute(
        "INSERT INTO ventas (usuario_id, turno_id, subtotal, iva, total, monto_pagado, vuelto, metodo_pago, estado) VALUES (?,?,?,?,?,?,?,?,?)",
        [usuario.id, turno.id, subtotal, iva, total, monto || total, monto > 0 ? vuelto : 0, metodoPago, "completada"]
      );
      const ventaId = result.lastInsertId;
      for (const item of carrito) {
        await db.execute(
          "INSERT INTO detalle_venta (venta_id, producto_id, nombre_producto, precio_unitario, precio_costo, cantidad, descuento, subtotal) VALUES (?,?,?,?,?,?,?,?)",
          [ventaId, item.producto_id, item.nombre, item.precio_unitario, item.precio_costo, item.cantidad, item.descuento, item.subtotal]
        );
        await db.execute(
          "UPDATE productos SET stock = stock - ? WHERE id = ?",
          [item.cantidad, item.producto_id]
        );
      }
      agregarVentaAlTurno(total);
      limpiarCarrito();
      setProductoSeleccionado(null);
      cargarProductos();
      setModalPago(false);
      setMontoPagado("");
      toast.success(
        monto > 0 ? `✓ Cobrado — Vuelto: ${fmtCLP(vuelto)}` : `✓ Cobrado — ${fmtCLP(total)} débito`,
        { duration: 4000 }
      );
    } catch (e) {
      toast.error("Error al procesar la venta");
      console.error(e);
    }
    setCargando(false);
  }

  return (
    <div className="flex h-full">
      {/* Panel izquierdo */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">

        {/* Barra escaneo */}
        <div className="flex items-center gap-3 bg-[#16161f] border border-[#2a2a3d] focus-within:border-[#3b5bdb] rounded-lg px-4 py-3 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b5bdb" strokeWidth="2">
            <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M3 5h2M3 19h2M7 9h2M7 15h2M11 5h2M11 19h2M15 9h2M15 15h2M19 5h2M19 19h2"/>
          </svg>
          <input
            ref={inputRef}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={handleScan}
            placeholder="Escanea código de barra o escribe nombre y presiona Enter...  F4"
            className="flex-1 bg-transparent outline-none text-white placeholder-[#3d3d52] text-[13px]"
          />
          {busqueda && (
            <button onClick={() => { setBusqueda(""); inputRef.current?.focus(); }}
              className="text-[#3d3d5c] hover:text-white transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          <span className="text-[10px] bg-[#1e2a3a] text-[#4d9be6] px-2.5 py-1 rounded font-semibold tracking-widest shrink-0">
            ⚡ ACTIVO
          </span>
        </div>

        {/* Estado vacío */}
        {carrito.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[#16161f] border border-[#1e1e2e] flex items-center justify-center mb-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2d2d45" strokeWidth="1.5">
                <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
              </svg>
            </div>
            <p className="text-[14px] font-medium text-[#3d3d5c]">Listo para escanear</p>
            <p className="text-[12px] text-[#2a2a3d] max-w-xs leading-relaxed">
              Apunta el escáner al código de barra del producto.<br/>
              También puedes escribir el nombre y presionar Enter.
            </p>
            <div className="flex gap-3 mt-2">
              {[{ key:"F10", desc:"Cobrar" }, { key:"+ / −", desc:"Cantidad" }, { key:"ESC", desc:"Limpiar" }].map(a => (
                <div key={a.key} className="flex items-center gap-2 bg-[#16161f] border border-[#1e1e2e] rounded-lg px-3 py-2">
                  <span className="font-mono text-[11px] bg-[#1e1e2e] text-[#4d4d6a] px-1.5 py-0.5 rounded">{a.key}</span>
                  <span className="text-[11px] text-[#3d3d5c]">{a.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista items escaneados */}
        {carrito.length > 0 && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
            {carrito.map((item, idx) => {
              const seleccionado = productoSeleccionado === item.producto_id;
              return (
                <div
                  key={item.producto_id}
                  onClick={() => setProductoSeleccionado(item.producto_id)}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                    seleccionado
                      ? "bg-[#1a1f3a] border-[#3b5bdb]"
                      : "bg-[#16161f] border-[#1e1e2e] hover:border-[#2a2a4a]"
                  }`}
                >
                  <span className="text-[11px] text-[#3d3d5c] w-5 text-center shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#d0d0e8] truncate">{item.nombre}</div>
                    <div className="text-[11px] text-[#4d4d6a] mt-0.5">{fmtCLP(item.precio_unitario)} por unidad</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); cambiarCantidad(item.producto_id, -1); }}
                      className="w-7 h-7 rounded-md bg-[#1e1e2e] hover:bg-[#2a2a3d] text-[#8080a0] hover:text-white font-bold flex items-center justify-center transition-colors"
                    >−</button>
                    <span className="text-[14px] font-bold text-white w-8 text-center">{item.cantidad}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); cambiarCantidad(item.producto_id, 1); }}
                      className="w-7 h-7 rounded-md bg-[#1e1e2e] hover:bg-[#2a2a3d] text-[#8080a0] hover:text-white font-bold flex items-center justify-center transition-colors"
                    >+</button>
                  </div>
                  <span className="text-[14px] font-bold text-white w-20 text-right shrink-0">{fmtCLP(item.subtotal)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      quitarItem(item.producto_id);
                      if (productoSeleccionado === item.producto_id) setProductoSeleccionado(null);
                    }}
                    className="w-6 h-6 rounded flex items-center justify-center text-[#2d2d45] hover:text-[#ef4444] hover:bg-[#2a1a1a] transition-colors shrink-0"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Hint teclado */}
        {carrito.length > 0 && productoSeleccionado !== null && (
          <div className="flex items-center gap-2 text-[11px] text-[#3d3d5c]">
            <span className="font-mono bg-[#16161f] border border-[#1e1e2e] px-1.5 py-0.5 rounded text-[10px]">+</span>
            <span className="font-mono bg-[#16161f] border border-[#1e1e2e] px-1.5 py-0.5 rounded text-[10px]">−</span>
            <span>ajustar cantidad de <span className="text-[#6060a0]">{carrito.find(i => i.producto_id === productoSeleccionado)?.nombre}</span></span>
          </div>
        )}
      </div>

      {/* Separador */}
      <div className="w-px bg-[#1e1e2e]" />

      {/* Panel derecho */}
      <div className="w-[280px] bg-[#111118] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            <span className="text-[12px] font-semibold text-[#8080a0] uppercase tracking-wider">Resumen</span>
          </div>
          <button
            onClick={() => { limpiarCarrito(); setProductoSeleccionado(null); }}
            className="text-[10px] text-[#2d2d45] hover:text-[#ef4444] transition-colors flex items-center gap-1"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-3">
          {carrito.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[11px] text-[#2a2a3d]">Sin productos</p>
            </div>
          ) : (
            <div className="space-y-1">
              {carrito.map(item => (
                <div key={item.producto_id} className="flex justify-between text-[11px] py-1">
                  <span className="text-[#4d4d6a] truncate flex-1 mr-2">{item.nombre} ×{item.cantidad}</span>
                  <span className="text-[#6060a0] shrink-0">{fmtCLP(item.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#1e1e2e] px-4 py-4 space-y-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-[#3d3d5c]">Subtotal</span>
            <span className="text-[#6060a0]">{fmtCLP(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#3d3d5c]">IVA 19%</span>
            <span className="text-[#6060a0]">{fmtCLP(iva)}</span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-[#1e1e2e] mt-2">
            <span className="text-[11px] font-semibold text-[#8080a0] uppercase tracking-wider">Total</span>
            <span className="text-[24px] font-bold text-[#22c55e] leading-none">{fmtCLP(total)}</span>
          </div>
          <div className="text-[10px] text-[#2d2d45] text-right">
            {carrito.reduce((a, i) => a + i.cantidad, 0)} productos · {carrito.length} líneas
          </div>
        </div>

        <div className="px-3 pb-4">
          <button
            onClick={abrirModal}
            disabled={carrito.length === 0}
            className="w-full py-3.5 rounded-lg bg-[#16a34a] hover:bg-[#15803d] disabled:bg-[#16161f] disabled:text-[#2d2d45] text-white font-bold text-[14px] flex items-center justify-between px-4 transition-all active:scale-[0.98]"
          >
            <span>Cobrar</span>
            <span className="bg-white/15 rounded px-2 py-0.5 text-[11px] font-mono">F10</span>
          </button>
        </div>
      </div>

      {/* Modal pago */}
      {modalPago && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#13131e] border border-[#2a2a3d] rounded-xl w-[360px] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
              <div>
                <div className="text-[13px] font-semibold text-white">Confirmar pago</div>
                <div className="text-[11px] text-[#4d4d6a] mt-0.5">
                  Total: <span className="text-[#22c55e] font-bold">{fmtCLP(total)}</span>
                </div>
              </div>
              <button onClick={() => { setModalPago(false); setMontoPagado(""); }}
                className="text-[#3d3d5c] hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-[#4d4d6a] uppercase tracking-widest block mb-2">
                  Monto entregado por el cliente
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d4d6a] font-bold">$</span>
                  <input
                    ref={montoRef}
                    type="number"
                    value={montoPagado}
                    onChange={(e) => setMontoPagado(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarPago(); } }}
                    placeholder="0"
                    className="w-full bg-[#0f0f18] border border-[#2a2a3d] focus:border-[#3b5bdb] rounded-lg pl-8 pr-4 py-3 text-white text-[20px] font-bold outline-none transition-colors placeholder-[#2a2a3d]"
                  />
                </div>
                <p className="text-[10px] text-[#3d3d5c] mt-1.5">
                  Deja vacío → se registra como débito automáticamente
                </p>
              </div>

              <div className="bg-[#0f0f18] border border-[#1e1e2e] rounded-lg p-3 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#4d4d6a]">Método detectado</span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${
                    metodoPago === "efectivo"
                      ? "bg-[#14532d] text-[#4ade80]"
                      : "bg-[#1e1b4b] text-[#818cf8]"
                  }`}>
                    {metodoPago === "efectivo" ? "💵 Efectivo" : "💳 Débito"}
                  </span>
                </div>
                {monto > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-[#1e1e2e]">
                    <span className="text-[11px] text-[#4d4d6a]">Vuelto a entregar</span>
                    <span className={`text-[22px] font-bold ${vuelto >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {vuelto >= 0 ? fmtCLP(vuelto) : "⚠ Insuficiente"}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-[#3d3d5c] space-y-1 max-h-24 overflow-y-auto">
                {carrito.map(i => (
                  <div key={i.producto_id} className="flex justify-between">
                    <span>{i.nombre} ×{i.cantidad}</span>
                    <span className="text-[#5d5d7a]">{fmtCLP(i.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => { setModalPago(false); setMontoPagado(""); }}
                className="flex-1 py-2.5 rounded-lg border border-[#2a2a3d] text-[#5d5d7a] hover:text-white hover:border-[#3d3d5c] text-[12px] font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPago}
                disabled={cargando || (monto > 0 && monto < total)}
                className="flex-1 py-2.5 rounded-lg bg-[#16a34a] hover:bg-[#15803d] disabled:bg-[#1a2a1a] disabled:text-[#3d5c3d] text-white text-[12px] font-bold transition-all flex items-center justify-center gap-2"
              >
                {cargando ? "Procesando..." : "Confirmar"}
                {!cargando && <span className="bg-white/15 rounded px-1.5 py-0.5 text-[10px] font-mono">Enter</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}