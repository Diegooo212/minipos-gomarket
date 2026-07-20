interface PageHeaderProps {
  titulo: string;
  children?: React.ReactNode;
}

export default function PageHeader({ titulo, children }: PageHeaderProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-4) var(--space-5)",
      borderBottom: "1px solid var(--border-subtle)",
      flexShrink: 0,
    }}>
      <h1 style={{
        fontSize: "var(--text-base)",
        fontWeight: 700,
        color: "var(--text-primary)",
        letterSpacing: "-0.01em",
      }}>
        {titulo}
      </h1>
      {children && (
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          {children}
        </div>
      )}
    </div>
  );
}