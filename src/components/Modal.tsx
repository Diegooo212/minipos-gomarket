import { useEffect } from "react";

interface ModalProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  ancho?: string;
}

export default function Modal({
  abierto, onCerrar, titulo, subtitulo, children, ancho = "360px"
}: ModalProps) {
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
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onCerrar()}
    >
      <div className="modal" style={{ width: ancho }}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>
              {titulo}
            </div>
            {subtitulo && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                {subtitulo}
              </div>
            )}
          </div>
          <button
            onClick={onCerrar}
            className="btn btn-icon"
            style={{ flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}