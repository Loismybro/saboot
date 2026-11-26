import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileDown,
  Loader2,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  decideSettlement,
  getPendingSettlements,
  getRentalById,
} from "../api/client.js";
import { downloadVerdictPdf } from "../utils/pdfReport.js";
import BlurText from "../components/reactbits/BlurText.jsx";
import CountUp from "../components/reactbits/CountUp.jsx";
import SpotlightCard from "../components/reactbits/SpotlightCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const TABS = [
  { id: "ALL", label: "All" },
  { id: "PENDING_APPROVAL", label: "Pending Approval" },
  { id: "SETTLED", label: "Settled" },
  { id: "DISPUTED", label: "Disputed" },
];

function formatInr(value) {
  const num = Number(value) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function ApprovalQueuePage({ refreshKey = 0, onDataChanged }) {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");

  const [editingId, setEditingId] = useState(null);
  const [reopeningId, setReopeningId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [notesById, setNotesById] = useState({});
  const [busyId, setBusyId] = useState("");
  const [pdfBusyId, setPdfBusyId] = useState("");
  const [actionErrors, setActionErrors] = useState({});

  const loadSettlements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getPendingSettlements("ALL");
      setSettlements(res?.settlements || []);
    } catch (err) {
      setError(err?.message || "Failed to load settlement queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements, refreshKey]);

  const tabCounts = useMemo(() => {
    const counts = {
      ALL: settlements.length,
      PENDING_APPROVAL: 0,
      SETTLED: 0,
      DISPUTED: 0,
    };
    for (const s of settlements) {
      if (s.hitlStatus === "PENDING_APPROVAL") counts.PENDING_APPROVAL++;
      else if (s.hitlStatus === "APPROVED" || s.hitlStatus === "EDITED")
        counts.SETTLED++;
      else if (s.hitlStatus === "DISPUTED") counts.DISPUTED++;
    }
    return counts;
  }, [settlements]);

  const visibleSettlements = useMemo(() => {
    if (activeTab === "ALL") return settlements;
    if (activeTab === "PENDING_APPROVAL") {
      return settlements.filter((s) => s.hitlStatus === "PENDING_APPROVAL");
    }
    if (activeTab === "SETTLED") {
      return settlements.filter(
        (s) => s.hitlStatus === "APPROVED" || s.hitlStatus === "EDITED"
      );
    }
    return settlements.filter((s) => s.hitlStatus === "DISPUTED");
  }, [settlements, activeTab]);

  async function handleDecision(settlement, action, overrideDeduction) {
    if (busyId) return;
    setActionErrors((prev) => ({ ...prev, [settlement._id]: "" }));

    if (action === "EDIT") {
      const parsed = Number(overrideDeduction);
      if (
        overrideDeduction === "" ||
        !Number.isFinite(parsed) ||
        parsed < 0 ||
        parsed > settlement.depositAmount
      ) {
        setActionErrors((prev) => ({
          ...prev,
          [settlement._id]: `Override deduction must be between ₹0 and ₹${settlement.depositAmount}.`,
        }));
        return;
      }
    }

    setBusyId(settlement._id);
    try {
      await decideSettlement(settlement._id, {
        action,
        ...(action === "EDIT"
          ? { overrideTotalDeduction: Number(overrideDeduction) }
          : {}),
        note: notesById[settlement._id] ?? settlement.finalOverrideNote ?? "",
      });
      setEditingId(null);
      setReopeningId(null);
      await loadSettlements();
      onDataChanged?.();
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [settlement._id]: err?.message || "Failed to update settlement decision.",
      }));
    } finally {
      setBusyId("");
    }
  }

  async function handleDownloadPdf(settlement) {
    const rentalObj = settlement.rentalId;
    const rentalId =
      typeof rentalObj === "object" ? rentalObj?._id : rentalObj;

    setPdfBusyId(settlement._id);
    setActionErrors((prev) => ({ ...prev, [settlement._id]: "" }));
    try {
      if (rentalId) {
        const full = await getRentalById(rentalId);
        downloadVerdictPdf({
          rental: full.rental,
          inspection: full.inspection || settlement.inspectionId,
          settlement: full.settlement || settlement,
          sealVerification: full.sealVerification,
        });
      } else {
        downloadVerdictPdf({
          rental: rentalObj,
          inspection: settlement.inspectionId,
          settlement,
          sealVerification: null,
        });
      }
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [settlement._id]: err?.message || "Failed to generate PDF report.",
      }));
    } finally {
      setPdfBusyId("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <BlurText
            as="h1"
            text="Human-in-the-Loop (HITL) Approval Queue"
            delay={55}
            stepDuration={0.3}
            blur={8}
            distance={18}
            trigger="load"
            className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
          />
          <p className="mt-1 text-sm text-slate-400">
            Audit Reviewer QA Gate verdicts, approve or deterministically
            override INR deductions, flag disputes, and export PDF verdicts.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-slate-800 bg-slate-900/90 text-slate-400 hover:border-slate-700 hover:text-white"
            }`}
          >
            <span>{tab.label}</span>
            <span className="rounded-full bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-300">
              <CountUp
                to={tabCounts[tab.id] ?? 0}
                duration={0.6}
                trigger="load"
              />
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-10 flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span>Loading settlement queue...</span>
        </div>
      ) : visibleSettlements.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 p-10 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400/70" />
          <h2 className="mt-3 text-base font-semibold text-white">
            No settlements in this filter
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Run Check-Out on a rental or click &ldquo;Seed Demo Rentals&rdquo;
            to populate an active settlement.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {visibleSettlements.map((s) => {
            const rental = typeof s.rentalId === "object" ? s.rentalId : null;
            const inspection =
              typeof s.inspectionId === "object" ? s.inspectionId : null;
            const rentalId = rental?._id || s.rentalId;
            const depositAmount = Number(s.depositAmount) || 0;
            const hasOverride =
              s.overrideTotalDeduction !== null &&
              s.overrideTotalDeduction !== undefined;
            const currentDeduction = hasOverride
              ? Number(s.overrideTotalDeduction)
              : Number(s.totalDeduction || 0);
            const isEditing = editingId === s._id;
            const editNumeric = Number(editValue);
            const editRefundPreview =
              editValue !== "" && Number.isFinite(editNumeric)
                ? Math.max(0, depositAmount - editNumeric)
                : depositAmount - currentDeduction;

            const isFlagged = s.reviewerGate?.verdict === "FLAG";
            const isPending = s.hitlStatus === "PENDING_APPROVAL";
            const showDecisionControls =
              isPending || reopeningId === s._id || isEditing;

            return (
              <SpotlightCard
                key={s._id}
                spotlightColor={isFlagged ? "#fb7185" : "#34d399"}
                borderColor={
                  isFlagged
                    ? "rgba(244, 63, 94, 0.45)"
                    : "rgba(30, 41, 59, 0.95)"
                }
                intensity={0.1}
                className="rounded-2xl p-5"
              >
                <article>
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-white">
                          {rental?.title || "Rental Settlement"}
                        </h2>
                        <StatusBadge status={s.hitlStatus} size="xs" />
                        {s.reviewerGate?.verdict && (
                          <StatusBadge
                            status={s.reviewerGate.verdict}
                            label={`QA ${s.reviewerGate.verdict} (${s.reviewerGate.confidence ?? 0}%)`}
                            size="xs"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Owner:{" "}
                        <span className="text-slate-200">
                          {rental?.ownerName || "—"}
                        </span>{" "}
                        <span className="text-slate-600">•</span> Renter:{" "}
                        <span className="text-slate-200">
                          {rental?.renterName || "—"}
                        </span>{" "}
                        <span className="text-slate-600">•</span> Category:{" "}
                        <span className="font-mono text-sky-300">
                          {rental?.category || "general"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {rentalId && (
                        <Link
                          to={`/rentals/${rentalId}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 hover:text-white"
                        >
                          <span>Inspect Photos &amp; Trace</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(s)}
                        disabled={pdfBusyId === s._id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer"
                      >
                        {pdfBusyId === s._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileDown className="h-3.5 w-3.5" />
                        )}
                        <span>Download Forensic Verdict PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Integrity + Reviewer QA Gate */}
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="space-y-3 lg:col-span-7">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {!inspection ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-slate-400">
                            NO INSPECTION RECORD
                          </span>
                        ) : inspection.hashIntegrityPassed === false ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 font-mono text-rose-300">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            SHA-256 SEAL MISMATCH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-emerald-300">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            SHA-256 SEAL VERIFIED
                          </span>
                        )}

                        {inspection?.sameObjectConfirmed === false && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 font-mono text-rose-300">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            OBJECT MISMATCH FLAGGED
                          </span>
                        )}
                      </div>

                      {s.reviewerGate?.auditReasoning && (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-300">
                          <span className="font-semibold text-slate-200">
                            Reviewer QA Reasoning:{" "}
                          </span>
                          {s.reviewerGate.auditReasoning}
                        </div>
                      )}

                      {s.reviewerGate?.flags?.length > 0 && (
                        <ul className="space-y-1.5">
                          {s.reviewerGate.flags.map((flag, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200"
                            >
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                              <span>{flag}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Line Items */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Itemized Deductions ({s.lineItems?.length || 0})
                        </p>
                        {s.lineItems?.length > 0 ? (
                          <ul className="mt-2 divide-y divide-slate-800/80 text-xs">
                            {s.lineItems.map((item, idx) => (
                              <li
                                key={idx}
                                className="flex items-center justify-between gap-3 py-2"
                              >
                                <div>
                                  <p className="font-medium text-slate-200">
                                    {item.findingDescription}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {item.type} • {item.severity} •{" "}
                                    {item.rateSourceLabel}
                                  </p>
                                </div>
                                <span className="shrink-0 font-mono font-semibold text-rose-300">
                                  {formatInr(item.deductionAmount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-emerald-300">
                            No deductions — full deposit refund recommended.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right column: Financial Split & HITL Controls */}
                    <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-4 lg:col-span-5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Settlement Ledger
                        </p>
                        <div className="mt-3 space-y-2 font-mono text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Deposit Held</span>
                            <span className="font-semibold text-white">
                              {formatInr(depositAmount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">
                              AI Proposed Deduction
                            </span>
                            <span className="text-slate-300">
                              {formatInr(s.totalDeduction)}
                            </span>
                          </div>
                          {hasOverride && (
                            <div className="flex justify-between">
                              <span className="text-amber-300">
                                HITL Override Deduction
                              </span>
                              <span className="font-semibold text-amber-300">
                                {formatInr(s.overrideTotalDeduction)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-slate-800 pt-2">
                            <span className="text-slate-300">
                              Final Deduction
                            </span>
                            <span className="font-bold text-rose-300">
                              {formatInr(currentDeduction)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="font-semibold text-emerald-300">
                              Refund to Renter
                            </span>
                            <span className="font-bold text-emerald-300">
                              {formatInr(s.refundToRenter)}
                            </span>
                          </div>
                        </div>

                        {s.finalOverrideNote && (
                          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-300">
                            <span className="text-slate-500">Note: </span>
                            {s.finalOverrideNote}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                        {!showDecisionControls ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2.5 text-xs">
                            <div className="text-slate-300">
                              <span className="font-semibold text-white">
                                Decision recorded
                              </span>
                              {s.decidedAt && (
                                <span className="block text-[11px] text-slate-400">
                                  {formatDateTime(s.decidedAt)}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setReopeningId(s._id)}
                              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-white cursor-pointer"
                            >
                              Modify Decision
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={
                                notesById[s._id] ?? s.finalOverrideNote ?? ""
                              }
                              onChange={(e) =>
                                setNotesById((prev) => ({
                                  ...prev,
                                  [s._id]: e.target.value,
                                }))
                              }
                              placeholder="Optional arbitration note..."
                              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                            />

                            {isEditing ? (
                              <div className="space-y-2.5 rounded-xl border border-amber-500/35 bg-amber-500/5 p-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-amber-300">
                                    Override Deduction (₹0 – ₹{depositAmount})
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="text-slate-400 hover:text-white cursor-pointer"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  max={depositAmount}
                                  step="1"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-amber-300 focus:border-amber-400 focus:outline-none"
                                />
                                <div className="flex items-center justify-between font-mono text-xs">
                                  <span className="text-slate-400">
                                    Live Refund Preview:
                                  </span>
                                  <span className="font-bold text-emerald-300">
                                    {formatInr(editRefundPreview)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={busyId === s._id}
                                  onClick={() =>
                                    handleDecision(s, "EDIT", editValue)
                                  }
                                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
                                >
                                  {busyId === s._id && (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  )}
                                  <span>Save Override &amp; Settle</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={busyId === s._id}
                                  onClick={() => handleDecision(s, "APPROVE")}
                                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                                >
                                  {busyId === s._id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  <span>Approve</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={busyId === s._id}
                                  onClick={() => {
                                    setEditingId(s._id);
                                    setEditValue(String(currentDeduction));
                                  }}
                                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span>Edit ₹</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={busyId === s._id}
                                  onClick={() => handleDecision(s, "DISPUTE")}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                  <span>Dispute</span>
                                </button>

                                {!isPending && (
                                  <button
                                    type="button"
                                    onClick={() => setReopeningId(null)}
                                    className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {actionErrors[s._id] && (
                          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200">
                            {actionErrors[s._id]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              </SpotlightCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
