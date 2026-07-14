import { create } from "zustand";
import { ItemVenta } from "../types";

interface Store {
  carrito: ItemVenta[];
  agregarItem: (item: ItemVenta) => void;
  quitarItem: (producto_id: number) => void;
  cambiarCantidad: (producto_id: number, delta: number) => void;
  limpiarCarrito: () => void;
  paginaActual: string;
  setPagina: (pagina: string) => void;
}

export const useStore = create<Store>((set) => ({
  carrito: [],

  agregarItem: (item) =>
    set((state) => {
      const existe = state.carrito.find((i) => i.producto_id === item.producto_id);
      if (existe) {
        return {
          carrito: state.carrito.map((i) =>
            i.producto_id === item.producto_id
              ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unitario }
              : i
          ),
        };
      }
      return { carrito: [...state.carrito, item] };
    }),

  quitarItem: (producto_id) =>
    set((state) => ({
      carrito: state.carrito.filter((i) => i.producto_id !== producto_id),
    })),

  cambiarCantidad: (producto_id, delta) =>
    set((state) => ({
      carrito: state.carrito
        .map((i) =>
          i.producto_id === producto_id
            ? { ...i, cantidad: i.cantidad + delta, subtotal: (i.cantidad + delta) * i.precio_unitario }
            : i
        )
        .filter((i) => i.cantidad > 0),
    })),

  limpiarCarrito: () => set({ carrito: [] }),

  paginaActual: "pos",
  setPagina: (pagina) => set({ paginaActual: pagina }),
}));