import { useEffect } from "react";

export function useScanner(onScan: (codigo: string) => void) {
  useEffect(() => {
    let buffer = "";
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (buffer.length >= 3) onScan(buffer.trim());
        buffer = "";
        clearTimeout(timer);
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buffer = ""; }, 100);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onScan]);
}