import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  IndianRupee,
  Loader2,
  PlusCircle,
  Radar,
  ReceiptIndianRupee,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  getRepairRates,
  listRentals,
  runOverdueScan,
} from "../api/client.js";
import StatusBadge from "../components/StatusBadge.jsx";

function formatInr(value) {
  const num = Number(value) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

const CATEGORY_LABELS = {
  electronics: "Electronics",
  camera: "Camera Gear",
  bike_gear: "Bike Gear",
  pg_room: "PG Room",
  general: "General",
};

export default function Dashboard({ refreshKey = 0, onDataChanged }) {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  const [ratesOpen, setRatesOpen] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [rates, setRates] = useState([]);
  const [rateCategoryFilter, setRateCategoryFilter] = useState("ALL");

  const loadRentals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listRentals();
      setRentals(res?.rentals || []);
    } catch (err) {
      setError(err?.message || "Failed to load rentals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRentals();
  }, [loadRentals, refreshKey]);

  const stats = useMemo(() => {
    const total = rentals.length;
    const checkedIn = rentals.filter((r) => r.status === "CHECKED_IN").length;
    const underReview = rentals.filter((r) => r.status === "UNDER_REVIEW").length;
    const totalDeposit = rentals.reduce(
      (sum, r) => sum + (Number(r.depositAmount) || 0),
      0
    );
    const overdueCount = rentals.filter((r) => r.overdueAlert?.flagged).length;

    return { total, checkedIn, underReview, totalDeposit, overdueCount };
  }, [rentals]);

  const filteredRates = useMemo(() => {
    if (rateCategoryFilter === "ALL") return rates;
    return rates.filter((r) => r.category === rateCategoryFilter);
  }, [rates, rateCategoryFilter]);

  async function handleOverdueScan() {
    if (scanning) return;
    setScanning(true);
    setScanMessage("");
    setError("");
    try {
      const res = await runOverdueScan();
      const count = res?.flaggedCount ?? 0;
      setScanMessage(
        count > 0
          ? `Overdue scan flagged ${count} rental(s) for follow-up.`
          : "Overdue scan complete: no new overdue rentals found."
      );
      await loadRentals();
      onDataChanged?.();
    } catch (err) {
      setError(err?.message || "Overdue scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function handleOpenRatesModal() {
    setRatesOpen(true);
    if (rates.length > 0) return;
    setRatesLoading(true);
    setRatesError("");
    try {
      const res = await getRepairRates();
      setRates(res?.rates || []);
    } catch (err) {
      setRatesError(err?.message || "Failed to load repair rates.");
    } finally {
      setRatesLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Rental Custody Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            SHA-256 sealed Check-In baselines, live forensic visual diffs, and
            overdue custody alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenRatesModal}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ReceiptIndianRupee className="h-4 w-4 text-emerald-400" />
            <span>View Repair Rates</span>
          </button>

          <button
            type="button"
            onClick={handleOverdueScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Radar className="h-4 w-4" />
            )}
            <span>{scanning ? "Scanning..." : "Run Overdue Scan"}</span>
          </button>

          <Link
            to="/checkin"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Check-In</span>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-400">Total Rentals</p>
          <p className="mt-2 font-mono text-2xl font-bold text-white">
            {stats.total}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-400">Checked In</p>
          <p className="mt-2 font-mono text-2xl font-bold text-sky-300">
            {stats.checkedIn}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-400">Under Review</p>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-300">
            {stats.underReview}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-400">
            Total Deposit Held
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-emerald-300">
            {formatInr(stats.totalDeposit)}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            stats.overdueCount > 0
              ? "border-amber-500/40 bg-amber-950/20"
              : "border-slate-800 bg-slate-900"
          }`}
        >
          <p className="text-xs font-medium text-slate-400">Overdue Alerts</p>
          <p
            className={`mt-2 font-mono text-2xl font-bold ${
              stats.overdueCount > 0 ? "text-amber-300" : "text-slate-300"
            }`}
          >
            {stats.overdueCount}
          </p>
        </div>
      </div>

      {scanMessage && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          <span>{scanMessage}</span>
          <button
            type="button"
            onClick={() => setScanMessage("")}
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Rentals Grid */}
      {loading ? (
        <div className="mt-10 flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span>Loading sealed rentals...</span>
        </div>
      ) : rentals.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 p-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-400/70" />
          <h2 className="mt-3 text-lg font-semibold text-white">
            No rentals sealed yet
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Click{" "}
            <span className="font-semibold text-emerald-300">
              Seed Demo Rentals
            </span>{" "}
            in the top bar for instant synthetic data, or start a new Check-In.
          </p>
          <div className="mt-5 flex justify-center">
            <Link
              to="/checkin"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create First Check-In</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {rentals.map((rental) => {
            const thumb = rental.thumbnail;
            const shortHash = rental.baselineSeal?.sha256Hash
              ? `${rental.baselineSeal.sha256Hash.slice(0, 12)}…`
              : "unsealed";
            const isOverdue = Boolean(rental.overdueAlert?.flagged);

            return (
              <Link
                key={rental._id}
                to={`/rentals/${rental._id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 hover:border-emerald-500/40 transition-all"
              >
                {/* Thumbnail */}
                <div className="relative h-44 w-full overflow-hidden border-b border-slate-800 bg-slate-950">
                  {thumb?.base64 ? (
                    <img
                      src={`data:${thumb.mimeType || "image/webp"};base64,${thumb.base64}`}
                      alt={rental.title}
                      className="h-full w-full object-contain p-2 group-hover:scale-[1.02] transition-transform"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-600">
                      No preview image
                    </div>
                  )}

                  <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md border border-slate-700 bg-slate-950/90 px-2 py-0.5 text-[11px] font-medium text-slate-200">
                      {CATEGORY_LABELS[rental.category] || rental.category}
                    </span>
                    <span className="rounded-md border border-slate-700 bg-slate-950/90 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                      {rental.imageCount ?? 0} photo
                      {rental.imageCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="absolute right-3 top-3">
                    <StatusBadge status={rental.status} size="xs" />
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  {isOverdue && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate font-medium">
                        {rental.overdueAlert?.note ||
                          "Checkout overdue — follow-up inspection required"}
                      </span>
                    </div>
                  )}

                  {rental.tamperActive && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                      <span className="font-semibold">
                        Active DB Tamper Simulation
                      </span>
                    </div>
                  )}

                  <h2 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                    {rental.title}
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Owner:{" "}
                    <span className="text-slate-200">{rental.ownerName}</span>{" "}
                    <span className="text-slate-600">→</span> Renter:{" "}
                    <span className="text-slate-200">{rental.renterName}</span>
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">
                        Deposit Held
                      </span>
                      <p className="mt-0.5 flex items-center gap-1 font-mono font-semibold text-emerald-300">
                        <IndianRupee className="h-3 w-3" />
                        {(Number(rental.depositAmount) || 0).toLocaleString(
                          "en-IN"
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">
                        Due Date
                      </span>
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-slate-200">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {formatDate(rental.dueDate)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-4 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                        rental.tamperActive
                          ? "border-rose-500/35 bg-rose-500/10 text-rose-300"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {shortHash}
                    </span>

                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                      <span>Inspect</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Repair Rates Reference Modal */}
      {ratesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => setRatesOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Deterministic Indian Repair Rate Table (MongoDB)
                </h2>
                <p className="text-xs text-slate-400">
                  All ₹ deductions are resolved deterministically from{" "}
                  <code className="text-emerald-300">repair_rates</code> — never
                  LLM-invented.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRatesOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-5 py-3">
              {["ALL", "electronics", "camera", "bike_gear", "pg_room", "general"].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setRateCategoryFilter(cat)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      rateCategoryFilter === cat
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                    }`}
                  >
                    {cat === "ALL" ? "All Categories" : CATEGORY_LABELS[cat] || cat}
                  </button>
                )
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {ratesLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  <span>Loading repair rates...</span>
                </div>
              ) : ratesError ? (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                  {ratesError}
                </p>
              ) : filteredRates.length === 0 ? (
                <p className="text-center text-sm text-slate-400">
                  No repair rates found. Click &ldquo;Seed Demo Rentals&rdquo; to
                  seed benchmark rates.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Keyword</th>
                        <th className="py-2 pr-3">Severity</th>
                        <th className="py-2 pr-3">Cost (INR)</th>
                        <th className="py-2">Benchmark Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {filteredRates.map((rate) => (
                        <tr key={rate._id} className="text-slate-300">
                          <td className="py-2 pr-3 font-mono text-[11px] text-sky-300">
                            {rate.category}
                          </td>
                          <td className="py-2 pr-3 font-medium text-white">
                            {rate.itemKeyword}
                          </td>
                          <td className="py-2 pr-3 font-mono text-[11px]">
                            {rate.severity}
                          </td>
                          <td className="py-2 pr-3 font-mono font-semibold text-emerald-300">
                            {formatInr(rate.costInr)}
                          </td>
                          <td className="py-2 text-slate-400">
                            {rate.sourceLabel}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
