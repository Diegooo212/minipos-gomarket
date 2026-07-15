import { create } from "zustand";
import { ItemVenta } from "../types";

export interface Ticket {
  id: number;
  nombre: string;
  items: ItemVenta[];
}

interface Store {
  // Tickets persistentes
  tickets: Ticket[];
  ticketActivo: number;
  agregarTicket: () => void;
  cerrarTicket: (id: number) => void;
  setTicketActivo: (id: number) => void;
  setItemsTicket: (ticketId: number, items: ItemVenta[]) => void;
  limpiarTicket: (ticketId: number) => void;

  // Carrito (computed del ticket activo)
  carrito: ItemVenta[];
  agregarItem: (item: ItemVenta) => void;
  quitarItem: (producto_id: number) => void;
  cambiarCantidad: (producto_id: number, delta: number) => void;
  limpiarCarrito: () => void;

  // UI
  paginaActual: string;
  setPagina: (pagina: string) => void;
}

export const useStore = create<Store>((set, get) => ({
  // ── Tickets ──────────────────────────────────────────────────────────
  tickets: [{ id: 1, nombre: "Ticket 1", items: [] }],
  ticketActivo: 1,

  agregarTicket: () => set((state) => {
    const nuevoId = Math.max(...state.tickets.map(t => t.id)) + 1;
    return {
      tickets: [...state.tickets, { id: nuevoId, nombre: `Ticket ${nuevoId}`, items: [] }],
      ticketActivo: nuevoId,
    };
  }),

  cerrarTicket: (id) => set((state) => {
    if (state.tickets.length === 1) {
      // Si es el único ticket, solo lo limpia pero no lo cierra
      return {
        tickets: [{ ...state.tickets[0], items: [] }],
        ticketActivo: state.tickets[0].id,
      };
    }
    const restantes = state.tickets.filter(t => t.id !== id);
    const nuevoActivo = state.ticketActivo === id
      ? restantes[restantes.length - 1].id
      : state.ticketActivo;
    return { tickets: restantes, ticketActivo: nuevoActivo };
  }),

  setTicketActivo: (id) => set({ ticketActivo: id }),

  setItemsTicket: (ticketId, items) => set((state) => ({
    tickets: state.tickets.map(t => t.id === ticketId ? { ...t, items } : t),
  })),

  limpiarTicket: (ticketId) => set((state) => ({
    tickets: state.tickets.map(t => t.id === ticketId ? { ...t, items: [] } : t),
  })),

  // ── Carrito (alias del ticket activo) ────────────────────────────────
  get carrito() {
    const state = get();
    return state.tickets.find(t => t.id === state.ticketActivo)?.items ?? [];
  },

  agregarItem: (item) => {
    const state = get();
    const items = state.tickets.find(t => t.id === state.ticketActivo)?.items ?? [];
    const existe = items.find(i => i.producto_id === item.producto_id);
    const nuevosItems = existe
      ? items.map(i => i.producto_id === item.producto_id
          ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unitario }
          : i)
      : [...items, item];
    get().setItemsTicket(state.ticketActivo, nuevosItems);
  },

  quitarItem: (producto_id) => {
    const state = get();
    const items = state.tickets.find(t => t.id === state.ticketActivo)?.items ?? [];
    get().setItemsTicket(state.ticketActivo, items.filter(i => i.producto_id !== producto_id));
  },

  cambiarCantidad: (producto_id, delta) => {
    const state = get();
    const items = state.tickets.find(t => t.id === state.ticketActivo)?.items ?? [];
    const actualizados = items
      .map(i => i.producto_id === producto_id
        ? { ...i, cantidad: i.cantidad + delta, subtotal: (i.cantidad + delta) * i.precio_unitario }
        : i)
      .filter(i => i.cantidad > 0);
    get().setItemsTicket(state.ticketActivo, actualizados);
  },

  limpiarCarrito: () => {
    get().limpiarTicket(get().ticketActivo);
  },

  // ── UI ────────────────────────────────────────────────────────────────
  paginaActual: "pos",
  setPagina: (pagina) => set({ paginaActual: pagina }),
}));