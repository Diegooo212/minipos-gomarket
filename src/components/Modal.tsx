import { useEffect } from "react";

interface ModalProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  ancho?: string;
}

export default function Modal({ abierto, onCerrar, titulo, children, ancho = "w-[480px]" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    if (abierto) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div className={`bg-[#13131e] border border-[#2a2a3d] rounded-xl ${ancho} overflow-hidden shadow-2xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
          <h2 className="text-[13px] font-semibold text-white">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="text-[#3d3d5c] hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}