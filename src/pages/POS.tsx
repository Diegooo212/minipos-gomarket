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

  function quitarItem(producto_id: number) {
    setItemsTicket(ticketActivo, ticketActualItems.filter(i => i.producto_id !== producto_id));
  }

  function pedirEliminar(producto_id: number) { setModalEliminar(producto_id); }

  function confirmarEliminar() {
    if (modalEliminar === null) return;
    quitarItem(modalEliminar);
    if (productoSeleccionado === modalEliminar) {
      setProductoSeleccionado(null); setUltimoEscaneado(null);
    }
    setModalEliminar(null);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
        if (item && item.cantidad === 1) pedirEliminar(productoSeleccionado);
        else cambiarCantidad(productoSeleccionado, -1);
      }
      if (e.key === "F10") { e.preventDefault(); abrirModal(); }
      if (e.key === "Escape") { limpiarCarrito(); setProductoSeleccionado(null); setUltimoEscaneado(null); }
      if (e.key === "F4") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ticketActualItems, ticketActivo, modalPago, modalEliminar, productoSeleccionado]);

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
        cantidad: 1, descuento: 0,
        subtotal: Number(encontrado.precio_venta),
      });
      setProductoSeleccionado(encontrado.id!);
      setUltimoEscaneado(encontrado);
      setBusqueda("");
    } else {
      toast.error(`"${codigo}" no encontrado`); setBusqueda("");
    }
  }, [busqueda, productos]);

  const subtotal = ticketActualItems.reduce((a, i) => a + Number(i.subtotal), 0);
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;
  const monto = parseFloat(montoPagado) || 0;
  const vuelto = monto - total;
  const metodoPago = monto > 0 ? "efectivo" : "debito";

  function abrirModal() {
    if (ticketActualItems.length === 0) { toast.error("El carrito está vacío"); return; }
    if (!turno) { toast.error("Abre una caja primero — F8"); return; }
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
      setProductoSeleccionado(null); setUltimoEscaneado(null);
      cargarProductos(); setModalPago(false); setMontoPagado("");
      toast.success(monto > 0 ? `✓ Vuelto: ${fmtCLP(vuelto)}` : `✓ Cobrado ${fmtCLP(total)}`, { duration: 4000 });
    } catch (e) { toast.error("Error al procesar"); console.error(e); }
    setCargando(false);
  }

  const productoInfo = ultimoEscaneado
    ?? (productoSeleccionado ? productos.find(p => p.id === productoSeleccionado) ?? null : null);
  const cantidadEnTicket = productoInfo
    ? (ticketActualItems.find(i => i.producto_id === productoInfo.id)?.cantidad ?? 0) : 0;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── Panel izquierdo ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Barra escaneo */}
        <div style={{ padding: "var(--space-4) var(--space-5) var(--space-3)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            background: "var(--bg-card)", border: "2px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: "0 var(--space-4)",
            height: 48, transition: "border-color 0.15s",
          }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlurCapture={e => (e.currentTarget.style.borderColor = "var(--border-default)")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M3 5h2M3 19h2M7 9h2M7 15h2M11 5h2M11 19h2M15 9h2M15 15h2M19 5h2M19 19h2"/>
            </svg>
            <input
              ref={inputRef} value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onKeyDown={handleScan}
              placeholder="Escanea el código de barra o escribe el nombre del producto y presiona Enter..."
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "var(--text-sm)", color: "var(--text-primary)", fontFamily: "inherit" }}
            />
            {busqueda && (
              <button onClick={() => { setBusqueda(""); inputRef.current?.focus(); }}
                className="btn btn-icon" style={{ flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent-subtle)", color: "var(--accent-text)", padding: "3px 10px", borderRadius: "var(--radius-sm)", letterSpacing: "0.08em", flexShrink: 0 }}>
              ⚡ ACTIVO
            </span>
            <span className="kbd" style={{ flexShrink: 0 }}>F4</span>
          </div>
        </div>

        {/* Panel info producto — siempre visible */}
        <div style={{
          margin: "0 var(--space-5) var(--space-3)",
          background: productoInfo ? "var(--success-subtle)" : "var(--bg-card)",
          border: `1px solid ${productoInfo ? "var(--success-border)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-3) var(--space-5)",
          transition: "all 0.2s",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 80px 80px", gap: "var(--space-4)" }}>
            {[
              { label: "Código", value: productoInfo?.codigo_barra, mono: true },
              { label: "Producto", value: productoInfo?.nombre, truncate: true },
              { label: "Precio unit.", value: productoInfo ? fmtCLP(productoInfo.precio_venta) : null, green: true },
              { label: "Cant. en ticket", value: productoInfo ? String(cantidadEnTicket) : null, big: true },
              {
                label: "Stock",
                value: productoInfo ? String(productoInfo.stock) : null,
                big: true,
                warn: productoInfo ? productoInfo.stock <= productoInfo.stock_minimo : false,
              },
            ].map(col => (
              <div key={col.label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: productoInfo ? "var(--success)" : "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "var(--space-1)", opacity: productoInfo ? 0.8 : 0.5 }}>
                  {col.label}
                </div>
                <div style={{
                  fontSize: col.big ? "var(--text-lg)" : "var(--text-sm)",
                  fontWeight: col.big ? 700 : col.green ? 700 : 500,
                  color: col.value
                    ? col.green ? "var(--success)"
                    : col.warn ? "var(--warning)"
                    : "var(--text-primary)"
                    : "var(--text-disabled)",
                  fontFamily: col.mono ? "monospace" : "inherit",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {col.value ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs tickets */}
        <div style={{ padding: "0 var(--space-5) var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-2)", overflowX: "auto" }}>
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => { setTicketActivo(t.id); setTimeout(() => inputRef.current?.focus(), 50); }}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-2)",
                padding: "var(--space-1) var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${t.id === ticketActivo ? "var(--border-accent)" : "var(--border-default)"}`,
                background: t.id === ticketActivo ? "var(--accent-subtle)" : "var(--bg-card)",
                color: t.id === ticketActivo ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600,
                transition: "all 0.15s", flexShrink: 0,
              }}
            >
              {t.nombre}
              {t.items.length > 0 && (
                <span style={{
                  background: t.id === ticketActivo ? "var(--accent)" : "var(--bg-elevated)",
                  color: t.id === ticketActivo ? "#fff" : "var(--text-muted)",
                  fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "0 5px",
                }}>
                  {t.items.reduce((a, i) => a + i.cantidad, 0)}
                </span>
              )}
              {tickets.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); cerrarTicket(t.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6, padding: 0, display: "flex", alignItems: "center" }}
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
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-1)",
              padding: "var(--space-1) var(--space-3)",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--border-default)",
              background: "transparent", color: "var(--text-disabled)",
              cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600,
              transition: "all 0.15s", flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-disabled)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nuevo ticket
          </button>
        </div>

        {/* Lista items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 var(--space-5) var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {ticketActualItems.length === 0 ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
              </svg>
              <div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-1)" }}>Ticket vacío</div>
                <div style={{ fontSize: "var(--text-xs)" }}>Escanea el código de barra del producto</div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                {[{ key: "F10", desc: "Cobrar" }, { key: "+ / −", desc: "Cantidad" }, { key: "ESC", desc: "Limpiar" }].map(a => (
                  <div key={a.key} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-2) var(--space-3)" }}>
                    <span className="kbd">{a.key}</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{a.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Cabecera */}
              <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 120px 100px 100px 32px", gap: "var(--space-3)", padding: "0 var(--space-4) var(--space-1)", fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                <span>#</span><span>Producto</span><span style={{ textAlign: "center" }}>Cantidad</span>
                <span style={{ textAlign: "right" }}>Precio</span><span style={{ textAlign: "right" }}>Subtotal</span><span />
              </div>

              {ticketActualItems.map((item, idx) => {
                const sel = productoSeleccionado === item.producto_id;
                const prod = productos.find(p => p.id === item.producto_id);
                return (
                  <div
                    key={item.producto_id}
                    onClick={() => { setProductoSeleccionado(item.producto_id); setUltimoEscaneado(prod ?? null); }}
                    style={{
                      display: "grid", gridTemplateColumns: "28px 1fr 120px 100px 100px 32px",
                      gap: "var(--space-3)", alignItems: "center",
                      padding: "var(--space-3) var(--space-4)",
                      background: sel ? "var(--accent-subtle)" : "var(--bg-card)",
                      border: `1px solid ${sel ? "var(--border-accent)" : "var(--border-default)"}`,
                      borderRadius: "var(--radius-lg)", cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-disabled)", fontFamily: "monospace" }}>{idx + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.nombre}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-disabled)", marginTop: 2, fontFamily: "monospace" }}>
                        {prod?.codigo_barra || "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
                      <button
                        onClick={e => { e.stopPropagation(); if (item.cantidad === 1) pedirEliminar(item.producto_id); else cambiarCantidad(item.producto_id, -1); }}
                        className="btn btn-icon"
                        style={{ width: 28, height: 28, minHeight: 28, fontSize: 16, fontWeight: 700 }}
                      >−</button>
                      <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)", width: 28, textAlign: "center" }}>
                        {item.cantidad}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); cambiarCantidad(item.producto_id, 1); }}
                        className="btn btn-icon"
                        style={{ width: 28, height: 28, minHeight: 28, fontSize: 16, fontWeight: 700 }}
                      >+</button>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {fmtCLP(item.precio_unitario)}
                    </div>
                    <div style={{ textAlign: "right", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                      {fmtCLP(item.subtotal)}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); pedirEliminar(item.producto_id); }}
                      className="btn btn-icon"
                      style={{ width: 28, height: 28, minHeight: 28, color: "var(--text-disabled)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--text-disabled)")}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                );
              })}

              {productoSeleccionado !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--text-disabled)", padding: "0 var(--space-1)" }}>
                  <span className="kbd">+</span>
                  <span className="kbd">−</span>
                  <span>ajustar cantidad de <span style={{ color: "var(--text-secondary)" }}>{ticketActualItems.find(i => i.producto_id === productoSeleccionado)?.nombre}</span></span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Separador ── */}
      <div className="divider" />

      {/* ── Panel derecho ── */}
      <div style={{ width: 300, background: "var(--bg-panel)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Resumen
          </span>
          <button onClick={limpiarCarrito} className="btn btn-ghost btn-sm" style={{ color: "var(--text-disabled)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
            ESC
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-3) var(--space-5)" }}>
          {ticketActualItems.length === 0 ? (
            <div className="empty-state" style={{ padding: "var(--space-8) 0" }}>Sin productos</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              {ticketActualItems.map(item => (
                <div key={item.producto_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.nombre}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 2 }}>
                      {item.cantidad} × {fmtCLP(item.precio_unitario)}
                    </div>
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>
                    {fmtCLP(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales */}
        <div style={{ padding: "var(--space-4) var(--space-5)", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            <span>Subtotal</span><span>{fmtCLP(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            <span>IVA 19%</span><span>{fmtCLP(iva)}</span>
          </div>
          <div style={{ height: 1, background: "var(--border-default)", margin: "var(--space-1) 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Total</span>
            <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--success)", lineHeight: 1 }}>
              {fmtCLP(total)}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-disabled)", textAlign: "right" }}>
            {ticketActualItems.reduce((a, i) => a + i.cantidad, 0)} artículos · {ticketActualItems.length} líneas
          </div>
        </div>

        {/* Botón cobrar */}
        <div style={{ padding: "0 var(--space-5) var(--space-5)" }}>
          <button
            onClick={abrirModal}
            disabled={ticketActualItems.length === 0}
            className="btn btn-success btn-xl"
          >
            <span>Cobrar</span>
            <span className="kbd" style={{ marginLeft: "auto" }}>F10</span>
          </button>
        </div>
      </div>

      {/* ── Modal eliminar ── */}
      {modalEliminar !== null && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 340 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>¿Eliminar producto?</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                  {ticketActualItems.find(i => i.producto_id === modalEliminar)?.nombre}
                </div>
              </div>
            </div>
            <div className="modal-body" style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
              Se eliminará del ticket actual.
            </div>
            <div className="modal-footer">
              <button onClick={() => setModalEliminar(null)} className="btn btn-ghost" style={{ flex: 1 }}>
                Cancelar <span className="kbd" style={{ marginLeft: "var(--space-2)" }}>ESC</span>
              </button>
              <button onClick={confirmarEliminar} className="btn btn-danger" style={{ flex: 1 }}>
                Eliminar <span className="kbd" style={{ marginLeft: "var(--space-2)" }}>Enter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pago ── */}
      {modalPago && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 400 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>Confirmar cobro</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                  {ticketActualItems.length} líneas · {ticketActualItems.reduce((a,i)=>a+i.cantidad,0)} artículos
                </div>
              </div>
              <button onClick={() => { setModalPago(false); setMontoPagado(""); }} className="btn btn-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Total grande */}
              <div style={{ background: "var(--success-subtle)", border: "1px solid var(--success-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.7, marginBottom: "var(--space-1)" }}>
                  Total a cobrar
                </div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--success)", lineHeight: 1 }}>
                  {fmtCLP(total)}
                </div>
              </div>

              {/* Input monto */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "var(--space-1)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Monto entregado por el cliente
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontWeight: 700, fontSize: "var(--text-lg)" }}>$</span>
                  <input
                    ref={montoRef} type="number" value={montoPagado}
                    onChange={e => setMontoPagado(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); confirmarPago(); } }}
                    placeholder="0"
                    className="input input-lg"
                    style={{ paddingLeft: 36 }}
                  />
                </div>
                <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: "var(--space-1)" }}>
                  Deja vacío → se registra como débito
                </div>
              </div>

              {/* Método y vuelto */}
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Método</span>
                  <span className={`badge badge-${metodoPago === "efectivo" ? "activo" : "info"}`}>
                    {metodoPago === "efectivo" ? "Efectivo" : "Débito"}
                  </span>
                </div>
                {monto > 0 && (
                  <>
                    <div style={{ height: 1, background: "var(--border-subtle)" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontWeight: 600 }}>Vuelto</span>
                      <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: vuelto >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {vuelto >= 0 ? fmtCLP(vuelto) : "⚠ Insuficiente"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => { setModalPago(false); setMontoPagado(""); }} className="btn btn-ghost" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button onClick={confirmarPago} disabled={cargando || (monto > 0 && monto < total)} className="btn btn-success" style={{ flex: 1 }}>
                {cargando ? "Procesando..." : "Confirmar"}
                {!cargando && <span className="kbd" style={{ marginLeft: "var(--space-2)" }}>Enter</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}