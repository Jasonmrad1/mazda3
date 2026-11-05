import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, ChevronRight, X, type LucideIcon } from "lucide-react";
export function IconBox({
  icon: Icon,
  tone = "silver",
}: {
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <span className={`icon-box ${tone}`}>
      <Icon size={20} strokeWidth={1.6} />
    </span>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
export function Empty({
  icon: Icon,
  title,
  children,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <Icon size={28} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action && (
        <button className="button secondary" onClick={onAction}>
          {action}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  unit,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {label}
        {Icon && <Icon size={17} strokeWidth={1.4} />}
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{detail}</p>
    </div>
  );
}
export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-content">
        <header className="modal-header">
          <div>
            <span className="eyebrow">MY GARAGE</span>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Note({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <div className={`note ${tone}`}>{children}</div>;
}
export type ModalState = {
  type:
    | "mileage"
    | "service"
    | "fuel"
    | "expense"
    | "tire"
    | "profile"
    | "reminder"
    | "settings"
    | "documents"
    | "manual"
    | "learn"
    | "task"
    | "onboarding";
  id?: string;
  position?: number;
  subject?: string;
};
export type OpenModal = (state: ModalState) => void;
