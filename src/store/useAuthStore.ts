import { create } from "zustand";
import { Usuario, Rol } from "../types";

interface AuthStore {
  usuario: Usuario | null;
  turnoId: number | null;
  login: (usuario: Usuario) => void;
  logout: () => void;
  setTurnoId: (id: number) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  usuario: null,
  turnoId: null,
  login: (usuario) => set({ usuario }),
  logout: () => set({ usuario: null, turnoId: null }),
  setTurnoId: (id) => set({ turnoId: id }),
}));

export const useRol = (): Rol | null => {
  return useAuthStore((s) => s.usuario?.rol ?? null);
};