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
  const [ultimoEscaneado, setUltimoEscaneado] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const [modalEliminar, setModalEliminar] = useState<number | null>(null);
  const [montoPagado, setMontoPagado] = useState("");

  const {
    tickets, ticketActivo, agregarTicket, cerrarTicket,
    setTicketActivo, setItemsTicket, limpiarTicket,
    agregarItem, cambiarCantidad, limpiarCarrito,
  } = useStore();

  const { usuario } = useAuthStore();
  const { turno, agregarVentaAlTurno } = useCajaStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const montoRef = useRef<HTMLInputElement>(null);

  const ticketActualItems = tickets.find(t => t.id === ticketActivo)?.items ?? [];

  useEffect(() => { cargarProductos(); inputRef.current?.focus(); }, []);
  useEffect(() => { if (modalPago) setTimeout(() => montoRef.current?.focus(), 100); }, [modalPago]);

  // ── Eliminar producto ──────────────────────────────────────────────────
  function quitarItem(producto_id: number) {
    const items = ticketActualItems.filter(i => i.producto_id !== producto_id);
    setItemsTicket(ticketActivo, items);
  }

  function pedirEliminar(producto_id: number) {
    setModalEliminar(producto_id);
  }

  function confirmarEliminar() {
    if (modalEliminar === null) return;
    quitarItem(modalEliminar);
    if (productoSeleccionado === modalEliminar) {
      setProductoSeleccionado(null);
      setUltimoEscaneado(null);
    }
    setModalEliminar(null);
  }

  // ── Atajos de teclado ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Modal eliminar tiene prioridad
      if (modalEliminar !== null) {
        if (e.key === "Enter") { e.preventDefault(); confirmarEliminar(); }
        if (e.key === "Escape") { e.preventDefault(); setModalEliminar(null); }
        return;
      }
      if (modalPago) {
        if (e.key === "Escape") { setModalPago(false); setMontoPagado(""); }
        return;
      }
      if ((e.key === "+" || e.key === "Add") && productoSeleccionado !== null) {
        e.preventDefault(); cambiarCantidad(productoSeleccionado, 1);
      }
      if ((e.key === "-" || e.key === "Subtract") && productoSeleccionado !== null) {
        e.preventDefault();
        const item = ticketActualItems.find(i => i.producto_id === productoSeleccionado);
        if (item && item.cantidad === 1) {
          pedirEliminar(productoSeleccionado);
        } else {
          cambiarCantidad(productoSeleccionado, -1);
        }
      }
      if (e.key === "F10") { e.preventDefault(); abrirModal(); }
      if (e.key === "Escape") { limpiarCarrito(); setProductoSeleccionado(null); setUltimoEscaneado(null); }
      if (e.key === "F4") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ticketActualItems, ticketActivo, modalPago, modalEliminar, productoSeleccionado]);

  // ── DB ─────────────────────────────────────────────────────────────────
  async function cargarProductos() {
    const db = await getDB();
    const rows = await db.select<Producto[]>(
      "SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.activo = 1 ORDER BY p.nombre"
    );
    setProductos(rows);
  }

  // ── Escáner ────────────────────────────────────────────────────────────
  const handleScan = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const codigo = busqueda.trim();
    if (!codigo) return;
    const encontrado = productos.find(p => {
      const cod = (p.codigo_barra ?? "").toString().trim();
      return cod === codigo || cod.startsWith(codigo) || codigo.startsWith(cod) ||
        p.nombre.toLowerCase().includes(codigo.toLowerCase());
    });
    if (encontrado) {
      agregarItem({
        producto_id: encontrado.id!,
        nombre: encontrado.nombre,
        precio_unitario: Number(encontrado.precio_venta),
        precio_costo: Number(encontrado.precio_costo),
        cantidad: 1,
        descuento: 0,
        subtotal: Number(encontrado.precio_venta),
      });
      setProductoSeleccionado(encontrado.id!);
      setUltimoEscaneado(encontrado);
      setBusqueda("");
    } else {
      toast.error(`"${codigo}" no encontrado`);
      setBusqueda("");
    }
  }, [busqueda, productos]);

  // ── Totales ────────────────────────────────────────────────────────────
  const subtotal = ticketActualItems.reduce((a, i) => a + Number(i.subtotal), 0);
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;
  const monto = parseFloat(montoPagado) || 0;
  const vuelto = monto - total;
  const metodoPago = monto > 0 ? "efectivo" : "debito";

  // ── Pago ───────────────────────────────────────────────────────────────
  function abrirModal() {
    if (ticketActualItems.length === 0) { toast.error("El carrito está vacío"); return; }
    if (!turno) { toast.error("Debes abrir una caja primero — F8"); return; }
    setMontoPagado(""); setModalPago(true);
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
      for (const item of ticketActualItems) {
        await db.execute(
          "INSERT INTO detalle_venta (venta_id, producto_id, nombre_producto, precio_unitario, precio_costo, cantidad, descuento, subtotal) VALUES (?,?,?,?,?,?,?,?)",
          [ventaId, item.producto_id, item.nombre, item.precio_unitario, item.precio_costo, item.cantidad, item.descuento, item.subtotal]
        );
        await db.execute("UPDATE productos SET stock = stock - ? WHERE id = ?", [item.cantidad, item.producto_id]);
      }
      agregarVentaAlTurno(total);
      limpiarTicket(ticketActivo);
      setProductoSeleccionado(null);
      setUltimoEscaneado(null);
      cargarProductos();
      setModalPago(false);
      setMontoPagado("");
      toast.success(
        monto > 0 ? `✓ Cobrado — Vuelto: ${fmtCLP(vuelto)}` : `✓ Cobrado — ${fmtCLP(total)}`,
        { duration: 4000 }
      );
    } catch (e) { toast.error("Error al procesar"); console.error(e); }
    setCargando(false);
  }

  // ── Info producto ──────────────────────────────────────────────────────
  const productoInfo = ultimoEscaneado
    ?? (productoSeleccionado ? productos.find(p => p.id === productoSeleccionado) ?? null : null);

  const cantidadEnTicket = productoInfo
    ? (ticketActualItems.find(i => i.producto_id === productoInfo.id)?.cantidad ?? 0)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Panel izquierdo ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Barra escaneo */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-3 bg-[#16161f] border-2 border-[#2a2a3d] focus-within:border-[#3b5bdb] rounded-xl px-5 py-3.5 transition-all">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b5bdb" strokeWidth="2">
              <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M3 5h2M3 19h2M7 9h2M7 15h2M11 5h2M11 19h2M15 9h2M15 15h2M19 5h2M19 19h2"/>
            </svg>
            <input
              ref={inputRef}
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onKeyDown={handleScan}
              placeholder="Escanea código de barra o escribe nombre del producto y presiona Enter...   F4"
              className="flex-1 bg-transparent outline-none text-white placeholder-[#3d3d52] text-[14px]"
            />
            {busqueda && (
              <button onClick={() => { setBusqueda(""); inputRef.current?.focus(); }}
                className="text-[#3d3d5c] hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
            <span className="text-[11px] bg-[#1e2a3a] text-[#4d9be6] px-3 py-1.5 rounded-lg font-bold tracking-widest shrink-0">
              ⚡ ACTIVO
            </span>
          </div>
        </div>

        {/* Info último producto — SIEMPRE VISIBLE */}
        <div className={`mx-5 mb-3 rounded-xl px-5 py-3 border transition-all ${
          productoInfo ? "bg-[#0f1f0f] border-[#1a3a1a]" : "bg-[#16161f] border-[#1e1e2e]"
        }`}>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-[#3d5c3d]">Código</div>
              <div className="text-[13px] font-mono text-[#4ade80] truncate">
                {productoInfo?.codigo_barra || <span className="text-[#2d2d45]">—</span>}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-[#3d5c3d]">Producto</div>
              <div className="text-[13px] font-semibold text-white truncate">
                {productoInfo?.nombre || <span className="text-[#2d2d45]">Esperando escaneo...</span>}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-[#3d5c3d]">Precio unit.</div>
              <div className="text-[13px] font-bold text-[#4ade80]">
                {productoInfo ? fmtCLP(productoInfo.precio_venta) : <span className="text-[#2d2d45]">—</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-[#3d5c3d]">Cant.</div>
                <div className="text-[20px] font-bold text-white leading-none">
                  {productoInfo ? cantidadEnTicket : <span className="text-[#2d2d45] text-[13px]">—</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-[#3d5c3d]">Stock</div>
                <div className={`text-[20px] font-bold leading-none ${
                  !productoInfo ? "text-[#2d2d45] text-[13px]" :
                  productoInfo.stock <= productoInfo.stock_minimo ? "text-yellow-400" : "text-white"
                }`}>
                  {productoInfo
                    ? (productoInfo.stock <= productoInfo.stock_minimo ? `⚠ ${productoInfo.stock}` : productoInfo.stock)
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs tickets */}
        <div className="px-5 flex items-center gap-2 mb-3 overflow-x-auto">
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => { setTicketActivo(t.id); setTimeout(() => inputRef.current?.focus(), 50); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all text-[12px] font-medium border shrink-0 ${
                t.id === ticketActivo
                  ? "bg-[#1e3a5f] border-[#3b5bdb] text-blue-300"
                  : "bg-[#16161f] border-[#2a2a3d] text-[#4d4d6a] hover:text-white hover:border-[#3d3d5c]"
              }`}
            >
              🧾 {t.nombre}
              {t.items.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  t.id === ticketActivo ? "bg-blue-500/30 text-blue-300" : "bg-white/10 text-[#6060a0]"
                }`}>
                  {t.items.reduce((a, i) => a + i.cantidad, 0)}
                </span>
              )}
              {tickets.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); cerrarTicket(t.id); }}
                  className="ml-1 text-[#3d3d5c] hover:text-red-400 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => { agregarTicket(); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[#2a2a3d] text-[#3d3d5c] hover:text-white hover:border-[#4d4d6a] transition-all text-[12px] shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nuevo ticket
          </button>
        </div>

        {/* Lista items */}
        <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-2 pb-4">
          {ticketActualItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
              <div className="w-20 h-20 rounded-2xl bg-[#16161f] border border-[#1e1e2e] flex items-center justify-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2d2d45" strokeWidth="1.5">
                  <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
                </svg>
              </div>
              <div>
                <p className="text-[15px] font-medium text-[#3d3d5c]">Ticket vacío</p>
                <p className="text-[12px] text-[#2a2a3d] mt-1">Escanea o escribe el nombre del producto</p>
              </div>
              <div className="flex gap-3 mt-1">
                {[{ key:"F10", desc:"Cobrar" },{ key:"+ / −", desc:"Cantidad" },{ key:"ESC", desc:"Limpiar" }].map(a => (
                  <div key={a.key} className="flex items-center gap-2 bg-[#16161f] border border-[#1e1e2e] rounded-lg px-3 py-2">
                    <span className="font-mono text-[11px] bg-[#1e1e2e] text-[#4d4d6a] px-1.5 py-0.5 rounded">{a.key}</span>
                    <span className="text-[11px] text-[#3d3d5c]">{a.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[32px_1fr_130px_110px_110px_36px] gap-3 px-4 py-2 text-[10px] font-bold text-[#3d3d5c] uppercase tracking-widest">
                <span>#</span>
                <span>Producto</span>
                <span className="text-center">Cantidad</span>
                <span className="text-right">Precio</span>
                <span className="text-right">Subtotal</span>
                <span></span>
              </div>

              {ticketActualItems.map((item, idx) => {
                const sel = productoSeleccionado === item.producto_id;
                const prod = productos.find(p => p.id === item.producto_id);
                return (
                  <div
                    key={item.producto_id}
                    onClick={() => { setProductoSeleccionado(item.producto_id); setUltimoEscaneado(prod ?? null); }}
                    className={`grid grid-cols-[32px_1fr_130px_110px_110px_36px] gap-3 items-center px-4 py-4 rounded-xl border cursor-pointer transition-all ${
                      sel ? "bg-[#1a1f3a] border-[#3b5bdb]" : "bg-[#16161f] border-[#1e1e2e] hover:border-[#2a2a4a]"
                    }`}
                  >
                    <span className="text-[12px] text-[#3d3d5c] font-mono">{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-white truncate">{item.nombre}</div>
                      <div className="text-[11px] text-[#4d4d6a] mt-0.5 font-mono">{prod?.codigo_barra || "—"}</div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (item.cantidad === 1) pedirEliminar(item.producto_id);
                          else cambiarCantidad(item.producto_id, -1);
                        }}
                        className="w-8 h-8 rounded-lg bg-[#1e1e2e] hover:bg-[#2a2a3d] text-[#8080a0] hover:text-white font-bold text-lg flex items-center justify-center transition-colors"
                      >−</button>
                      <span className="text-[16px] font-bold text-white w-8 text-center">{item.cantidad}</span>
                      <button
                        onClick={e => { e.stopPropagation(); cambiarCantidad(item.producto_id, 1); }}
                        className="w-8 h-8 rounded-lg bg-[#1e1e2e] hover:bg-[#2a2a3d] text-[#8080a0] hover:text-white font-bold text-lg flex items-center justify-center transition-colors"
                      >+</button>
                    </div>
                    <div className="text-right text-[13px] text-[#8080a0]">{fmtCLP(item.precio_unitario)}</div>
                    <div className="text-right text-[15px] font-bold text-white">{fmtCLP(item.subtotal)}</div>
                    <button
                      onClick={e => { e.stopPropagation(); pedirEliminar(item.producto_id); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#2d2d45] hover:text-red-400 hover:bg-[#2a1a1a] transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                );
              })}

              {productoSeleccionado !== null && (
                <div className="flex items-center gap-2 text-[11px] text-[#3d3d5c] px-1 pb-1">
                  <span className="font-mono bg-[#16161f] border border-[#1e1e2e] px-1.5 py-0.5 rounded text-[10px]">+</span>
                  <span className="font-mono bg-[#16161f] border border-[#1e1e2e] px-1.5 py-0.5 rounded text-[10px]">−</span>
                  <span>ajustar cantidad de <span className="text-[#6060a0]">{ticketActualItems.find(i => i.producto_id === productoSeleccionado)?.nombre}</span></span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Separador ── */}
      <div className="w-px bg-[#1a1a2e]" />

      {/* ── Panel derecho ── */}
      <div className="w-[320px] bg-[#0d0d16] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a2e]">
          <div className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            <span className="text-[12px] font-bold text-[#8080a0] uppercase tracking-widest">Resumen</span>
          </div>
          <button
            onClick={limpiarCarrito}
            className="text-[10px] text-[#2d2d45] hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {ticketActualItems.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[12px] text-[#2a2a3d]">Sin productos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ticketActualItems.map(item => (
                <div key={item.producto_id} className="flex justify-between items-start gap-2 py-2 border-b border-[#1a1a2e]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#c0c0d8] truncate">{item.nombre}</div>
                    <div className="text-[11px] text-[#3d3d5c]">{item.cantidad} × {fmtCLP(item.precio_unitario)}</div>
                  </div>
                  <span className="text-[13px] font-semibold text-[#8080a0] shrink-0">{fmtCLP(item.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-5 border-t border-[#1a1a2e] space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-[#4d4d6a]">Subtotal</span>
            <span className="text-[14px] text-[#8080a0] font-medium">{fmtCLP(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-[#4d4d6a]">IVA 19%</span>
            <span className="text-[14px] text-[#8080a0] font-medium">{fmtCLP(iva)}</span>
          </div>
          <div className="h-px bg-[#1a1a2e]" />
          <div className="flex justify-between items-center">
            <span className="text-[15px] font-bold text-[#c0c0d8] uppercase tracking-wider">Total</span>
            <span className="text-[32px] font-bold text-[#22c55e] leading-none">{fmtCLP(total)}</span>
          </div>
          <div className="text-[11px] text-[#2d2d45] text-right">
            {ticketActualItems.reduce((a, i) => a + i.cantidad, 0)} artículos · {ticketActualItems.length} líneas
          </div>
        </div>

        <div className="px-5 pb-6">
          <button
            onClick={abrirModal}
            disabled={ticketActualItems.length === 0}
            className="w-full py-4 rounded-xl bg-[#16a34a] hover:bg-[#15803d] disabled:bg-[#16161f] disabled:text-[#2d2d45] text-white font-bold text-[16px] flex items-center justify-between px-5 transition-all active:scale-[0.98]"
          >
            <span>Cobrar</span>
            <span className="bg-white/15 rounded-lg px-2.5 py-1 text-[12px] font-mono">F10</span>
          </button>
        </div>
      </div>

      {/* ── Modal eliminar ── */}
      {modalEliminar !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#13131e] border border-[#2a2a3d] rounded-2xl w-[360px] overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#1e1e2e]">
              <div className="text-[15px] font-bold text-white">¿Eliminar producto?</div>
              <div className="text-[13px] text-[#6060a0] mt-1">
                {ticketActualItems.find(i => i.producto_id === modalEliminar)?.nombre}
              </div>
            </div>
            <div className="px-6 py-4 text-[13px] text-[#4d4d6a]">
              Este producto se eliminará del ticket actual.
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setModalEliminar(null)}
                className="flex-1 py-3 rounded-xl border border-[#2a2a3d] text-[#5d5d7a] hover:text-white text-[13px] font-medium transition-all flex items-center justify-center gap-2"
              >
                Cancelar
                <span className="font-mono text-[11px] bg-white/10 px-1.5 py-0.5 rounded">ESC</span>
              </button>
              <button
                onClick={confirmarEliminar}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[13px] font-bold transition-all flex items-center justify-center gap-2"
              >
                Eliminar
                <span className="bg-white/15 rounded px-2 py-0.5 text-[11px] font-mono">Enter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pago ── */}
      {modalPago && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50">
          <div className="bg-[#13131e] border border-[#2a2a3d] rounded-2xl w-[400px] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e1e2e]">
              <div>
                <div className="text-[15px] font-bold text-white">Confirmar cobro</div>
                <div className="text-[12px] text-[#4d4d6a] mt-0.5">
                  {ticketActualItems.length} productos · {ticketActualItems.reduce((a, i) => a + i.cantidad, 0)} artículos
                </div>
              </div>
              <button
                onClick={() => { setModalPago(false); setMontoPagado(""); }}
                className="text-[#3d3d5c] hover:text-white transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-[#0a1a0a] border border-[#1a3a1a] rounded-xl px-5 py-4 text-center">
                <div className="text-[12px] text-[#3d5c3d] uppercase tracking-widest mb-1">Total a cobrar</div>
                <div className="text-[42px] font-bold text-[#22c55e] leading-none">{fmtCLP(total)}</div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#4d4d6a] uppercase tracking-widest block mb-2">
                  Monto entregado por el cliente
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4d4d6a] font-bold text-lg">$</span>
                  <input
                    ref={montoRef}
                    type="number"
                    value={montoPagado}
                    onChange={e => setMontoPagado(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); confirmarPago(); } }}
                    placeholder="0"
                    className="w-full bg-[#0f0f18] border-2 border-[#2a2a3d] focus:border-[#3b5bdb] rounded-xl pl-10 pr-4 py-3.5 text-white text-[24px] font-bold outline-none transition-colors placeholder-[#2a2a3d]"
                  />
                </div>
                <p className="text-[11px] text-[#3d3d5c] mt-1.5">Deja vacío → se registra como débito</p>
              </div>

              <div className="bg-[#0f0f18] border border-[#1e1e2e] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-[#4d4d6a]">Método detectado</span>
                  <span className={`text-[12px] font-bold px-3 py-1 rounded-lg ${
                    metodoPago === "efectivo" ? "bg-[#14532d] text-[#4ade80]" : "bg-[#1e1b4b] text-[#818cf8]"
                  }`}>
                    {metodoPago === "efectivo" ? "💵 Efectivo" : "💳 Débito"}
                  </span>
                </div>
                {monto > 0 && (
                  <div className="flex justify-between items-center pt-3 border-t border-[#1e1e2e]">
                    <span className="text-[13px] text-[#4d4d6a] font-medium">Vuelto</span>
                    <span className={`text-[28px] font-bold ${vuelto >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {vuelto >= 0 ? fmtCLP(vuelto) : "⚠ Insuficiente"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setModalPago(false); setMontoPagado(""); }}
                className="flex-1 py-3 rounded-xl border border-[#2a2a3d] text-[#5d5d7a] hover:text-white text-[13px] font-medium transition-all"
              >Cancelar</button>
              <button
                onClick={confirmarPago}
                disabled={cargando || (monto > 0 && monto < total)}
                className="flex-1 py-3 rounded-xl bg-[#16a34a] hover:bg-[#15803d] disabled:bg-[#1a2a1a] disabled:text-[#3d5c3d] text-white text-[13px] font-bold transition-all flex items-center justify-center gap-2"
              >
                {cargando ? "Procesando..." : "Confirmar cobro"}
                {!cargando && <span className="bg-white/15 rounded px-2 py-0.5 text-[11px] font-mono">Enter</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}