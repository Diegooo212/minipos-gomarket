import { useOffline } from "../hooks/useOffline";

export default function OfflineIndicator() {
  const offline = useOffline();

  if (!offline) return (
    <div className="flex items-center gap-1.5 text-[11px] text-[#3d5c3d]">
      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
      <span className="text-green-600">Sincronizado</span>
    </div>
  );

  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
      <span className="text-yellow-500">Sin conexión — modo offline</span>
    </div>
  );
}