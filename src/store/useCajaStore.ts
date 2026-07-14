import { create } from "zustand";
import { TurnoCaja } from "../types";

interface CajaStore {
  turno: TurnoCaja | null;
  setTurno: (t: TurnoCaja | null) => void;
  ventasDelTurno: number;
  totalDelTurno: number;
  agregarVentaAlTurno: (total: number) => void;
  resetTurno: () => void;
}

export const useCajaStore = create<CajaStore>((set) => ({
  turno: null,
  setTurno: (turno) => set({ turno }),
  ventasDelTurno: 0,
  totalDelTurno: 0,
  agregarVentaAlTurno: (total) =>
    set((s) => ({
      ventasDelTurno: s.ventasDelTurno + 1,
      totalDelTurno: s.totalDelTurno + total,
    })),
  resetTurno: () =>
    set({ turno: null, ventasDelTurno: 0, totalDelTurno: 0 }),
}));