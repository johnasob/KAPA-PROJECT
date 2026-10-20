import { AlertCircle, Box, LoaderCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Box size={25} strokeWidth={1.8} />
      </span>
      <span>
        KAPA<span className="brand-3d">3D</span>
        {!compact && <small>ESTUDIO & GESTIÓN</small>}
      </span>
    </div>
  );
}
export function Loading({
  label = "Cargando tu espacio…",
}: {
  label?: string;
}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}
export function Notice({
  children,
  type = "error",
}: {
  children: ReactNode;
  type?: "error" | "success" | "info";
}) {
  return (
    <div
      className={`notice ${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="empty-state">
      <AlertCircle size={32} />
      <h2>No pudimos cargar los datos</h2>
      <p>{message}</p>
      <button className="button secondary" onClick={onRetry}>
        <RefreshCw size={16} /> Volver a intentar
      </button>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
