import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

const STATUS_STYLES = {
  PASS: {
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    Icon: CheckCircle2,
  },
  APPROVED: {
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    Icon: CheckCircle2,
  },
  SETTLED: {
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    Icon: CheckCircle2,
  },
  VALID: {
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    Icon: ShieldCheck,
  },
  VERIFIED: {
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    Icon: ShieldCheck,
  },
  CHECKED_IN: {
    cls: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    Icon: ShieldCheck,
  },
  UNDER_REVIEW: {
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    Icon: Scale,
  },
  PENDING_APPROVAL: {
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    Icon: Clock,
  },
  WARN: {
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    Icon: AlertTriangle,
  },
  EDITED: {
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    Icon: Scale,
  },
  OVERDUE: {
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    Icon: AlertTriangle,
  },
  FLAG: {
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    Icon: ShieldAlert,
  },
  DISPUTED: {
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    Icon: ShieldAlert,
  },
  ERROR: {
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    Icon: ShieldAlert,
  },
  TAMPERED: {
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    Icon: ShieldAlert,
  },
  INVALID: {
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    Icon: ShieldAlert,
  },
};

export function StatusBadge({ status, label, size = "sm", className = "" }) {
  const key = String(status || "UNKNOWN").trim().toUpperCase();
  const style = STATUS_STYLES[key] || {
    cls: "border-slate-700 bg-slate-800/80 text-slate-300",
    Icon: Clock,
  };
  const { Icon } = style;

  const sizeCls =
    size === "xs"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";

  const displayLabel = label || key.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center rounded-full border font-mono font-medium tracking-wide uppercase ${sizeCls} ${style.cls} ${className}`}
    >
      <Icon className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span>{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
