type BadgeVariant = "admin" | "supervisor" | "cajero" | "activo" | "inactivo" | "warning" | "info";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export default function Badge({ children, variant = "info" }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}`}>{children}</span>
  );
}