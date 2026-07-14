import { useEffect } from "react";

type Atajos = Record<string, () => void>;

export function useKeyboard(atajos: Atajos, deps: any[] = []) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key;
      if (atajos[key]) {
        e.preventDefault();
        atajos[key]();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, deps);
}