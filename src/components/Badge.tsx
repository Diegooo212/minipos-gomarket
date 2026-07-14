interface BadgeProps {
  children: React.ReactNode;
  color?: "blue" | "green" | "red" | "yellow" | "gray" | "purple";
}

const colores = {
  blue:   "bg-blue-500/15 text-blue-400 border-blue-500/20",
  green:  "bg-green-500/15 text-green-400 border-green-500/20",
  red:    "bg-red-500/15 text-red-400 border-red-500/20",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  gray:   "bg-white/10 text-gray-400 border-white/10",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

export default function Badge({ children, color = "gray" }: BadgeProps) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${colores[color]}`}>
      {children}
    </span>
  );
}