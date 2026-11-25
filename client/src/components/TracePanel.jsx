import {
  Activity,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";

export function TracePanel({
  agentTrace = [],
  reviewerGate = null,
  sameObjectConfirmed,
  qualityWarning,
}) {
  const confidence = Math.min(
    100,
    Math.max(0, Number(reviewerGate?.confidence) || 0)
  );
  const verdict = reviewerGate?.verdict;
  const isFlagged = verdict === "FLAG";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Glass-Box Agent Execution Trace
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic SHA-256 + Two-Pass Gemini Audit Pipeline
            </p>
          </div>
        </div>
        {agentTrace.length > 0 && (
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-0.5 font-mono text-xs text-slate-300">
            {agentTrace.length} stages
          </span>
        )}
      </div>

      {sameObjectConfirmed === false && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <p className="font-semibold text-rose-300">
              Object / Visibility Verification Failed
            </p>
            <p className="mt-0.5 text-rose-200/90">
              {qualityWarning ||
                "Check-Out photos could not be confirmed as matching the sealed Check-In item."}
            </p>
          </div>
        </div>
      )}

      {sameObjectConfirmed !== false && qualityWarning && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-300">Image Quality Warning</p>
            <p className="mt-0.5 text-amber-200/90">{qualityWarning}</p>
          </div>
        </div>
      )}

      {agentTrace.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-5 text-center">
          <p className="text-sm text-slate-400">
            No Check-Out inspection trace yet.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Upload Check-Out photos to run HASH_VERIFY → FORENSIC_DIFF →
            RATE_LOOKUP → REVIEWER_QA_GATE.
          </p>
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {agentTrace.map((entry, idx) => (
            <li
              key={`${entry.step}-${idx}`}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 font-mono text-[11px] text-slate-300">
                    {idx + 1}
                  </span>
                  <span className="font-mono text-xs font-semibold text-white">
                    {entry.step}
                  </span>
                  <StatusBadge status={entry.status} size="xs" />
                </div>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" />
                  {entry.durationMs ?? 0} ms
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {entry.detail}
              </p>
            </li>
          ))}
        </ol>
      )}

      {reviewerGate && (
        <div
          className={`mt-4 rounded-xl border p-4 ${
            isFlagged
              ? "border-rose-500/40 bg-rose-500/5"
              : "border-emerald-500/30 bg-emerald-500/5"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isFlagged ? (
                <ShieldAlert className="h-4 w-4 text-rose-400" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Reviewer QA Gate (Adversarial Audit)
              </span>
            </div>
            <StatusBadge status={verdict} size="xs" />
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Auditor Confidence</span>
              <span className="font-mono font-semibold text-slate-200">
                {confidence}%
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  isFlagged ? "bg-rose-500" : "bg-emerald-500"
                }`}
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>

          {reviewerGate.flags && reviewerGate.flags.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {reviewerGate.flags.map((flag, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          )}

          {reviewerGate.auditReasoning && (
            <p className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/70 p-2.5 text-xs leading-relaxed text-slate-300">
              {reviewerGate.auditReasoning}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default TracePanel;
