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
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  getRepairRates,
  listRentals,
  runOverdueScan,
} from "../api/client.js";
import BlurText from "../components/reactbits/BlurText.jsx";
import CountUp from "../components/reactbits/CountUp.jsx";
import SpotlightCard from "../components/reactbits/SpotlightCard.jsx";
import StarBorder from "../components/reactbits/StarBorder.jsx";
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

const STATUS_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "CHECKED_IN", label: "Checked In" },
  { id: "UNDER_REVIEW", label: "Under Review" },
  { id: "SETTLED", label: "Settled" },
  { id: "DISPUTED", label: "Disputed" },
];

export default function Dashboard({ refreshKey = 0, onDataChanged }) {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    setRates([]);
  }, [refreshKey]);

  useEffect(() => {
    if (!ratesOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setRatesOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ratesOpen]);

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

  const filteredRentals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rentals.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(r.title || "").toLowerCase().includes(q) ||
        String(r.ownerName || "").toLowerCase().includes(q) ||
        String(r.renterName || "").toLowerCase().includes(q) ||
        String(r.category || "").toLowerCase().includes(q)
      );
    });
  }, [rentals, statusFilter, searchQuery]);

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
          <BlurText
            as="h1"
            text="Rental Custody Dashboard"
            delay={65}
            stepDuration={0.32}
            blur={8}
            distance={20}
            trigger="load"
            className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
          />
          <p className="mt-1 text-sm text-slate-400">
            SHA-256 sealed Check-In baselines, live forensic visual diffs, and
            overdue custody alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenRatesModal}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/85 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-colors cursor-pointer"
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

          <StarBorder
            as={Link}
            to="/checkin"
            color="#34d399"
            trailColor="#10b981"
            backgroundColor="#10b981"
            textColor="#020617"
            borderColor="rgba(52, 211, 153, 0.55)"
            radius={12}
            duration={3.8}
            className="px-4 py-2 text-xs font-semibold hover:brightness-110 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Check-In</span>
          </StarBorder>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SpotlightCard
          spotlightColor="#94a3b8"
          intensity={0.12}
          className="rounded-2xl p-4"
        >
          <p className="text-xs font-medium text-slate-400">Total Rentals</p>
          <p className="mt-2 font-mono text-2xl font-bold text-white">
            <CountUp to={stats.total} duration={0.9} trigger="load" />
          </p>
        </SpotlightCard>

        <SpotlightCard
          spotlightColor="#38bdf8"
          intensity={0.15}
          className="rounded-2xl p-4"
        >
          <p className="text-xs font-medium text-slate-400">Checked In</p>
          <p className="mt-2 font-mono text-2xl font-bold text-sky-300">
            <CountUp to={stats.checkedIn} duration={0.9} trigger="load" />
          </p>
        </SpotlightCard>

        <SpotlightCard
          spotlightColor="#fbbf24"
          intensity={0.15}
          className="rounded-2xl p-4"
        >
          <p className="text-xs font-medium text-slate-400">Under Review</p>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-300">
            <CountUp to={stats.underReview} duration={0.9} trigger="load" />
          </p>
        </SpotlightCard>

        <SpotlightCard
          spotlightColor="#34d399"
          intensity={0.16}
          className="rounded-2xl p-4"
        >
          <p className="text-xs font-medium text-slate-400">
            Total Deposit Held
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-emerald-300">
            <CountUp
              to={stats.totalDeposit}
              prefix="₹"
              locale="en-IN"
              duration={1.1}
              trigger="load"
            />
          </p>
        </SpotlightCard>

        <SpotlightCard
          spotlightColor="#f59e0b"
          surfaceColor={
            stats.overdueCount > 0
              ? "rgba(69, 26, 3, 0.45)"
              : "rgba(9, 14, 28, 0.82)"
          }
          borderColor={
            stats.overdueCount > 0
              ? "rgba(245, 158, 11, 0.45)"
              : "rgba(51, 65, 85, 0.65)"
          }
          intensity={0.16}
          className="rounded-2xl p-4"
        >
          <p className="text-xs font-medium text-slate-400">Overdue Alerts</p>
          <p
            className={`mt-2 font-mono text-2xl font-bold ${
              stats.overdueCount > 0 ? "text-amber-300" : "text-slate-300"
            }`}
          >
            <CountUp to={stats.overdueCount} duration={0.9} trigger="load" />
          </p>
        </SpotlightCard>
      </div>

      {/* Filter & Search Bar */}
      {rentals.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/75 px-4 py-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === f.id
                    ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border border-transparent text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by item, owner, renter..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-1.5 pl-8 pr-8 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {scanMessage && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200 backdrop-blur-sm">
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
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 backdrop-blur-sm">
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
        <SpotlightCard
          spotlightColor="#34d399"
          intensity={0.1}
          className="mt-8 rounded-2xl p-10 text-center"
        >
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-400/80" />
          <h2 className="mt-3 text-lg font-semibold text-white">
            No rentals sealed yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            Start a new Check-In to inspect condition photos, catalog existing
            flaws and accessories, and seal the baseline with SHA-256.
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
        </SpotlightCard>
      ) : filteredRentals.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center backdrop-blur-md">
          <p className="text-sm font-medium text-slate-300">
            No rentals match the current filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("ALL");
              setSearchQuery("");
            }}
            className="mt-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredRentals.map((rental) => {
            const thumb = rental.thumbnail;
            const shortHash = rental.baselineSeal?.sha256Hash
              ? `${rental.baselineSeal.sha256Hash.slice(0, 12)}…`
              : "unsealed";
            const isOverdue = Boolean(rental.overdueAlert?.flagged);
            const cardSpotlight =
              rental.status === "DISPUTED"
                ? "#fb7185"
                : rental.status === "UNDER_REVIEW" || isOverdue
                ? "#fbbf24"
                : rental.status === "CHECKED_IN"
                ? "#38bdf8"
                : "#34d399";

            return (
              <SpotlightCard
                key={rental._id}
                spotlightColor={cardSpotlight}
                intensity={0.13}
                borderGlow={0.75}
                className="group rounded-2xl p-0 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <Link
                  to={`/rentals/${rental._id}`}
                  className="flex h-full flex-col"
                >
                  {/* Thumbnail */}
                  <div className="relative h-44 w-full overflow-hidden border-b border-slate-800 bg-slate-950/90">
                    {thumb?.base64 ? (
                      <img
                        src={`data:${thumb.mimeType || "image/webp"};base64,${thumb.base64}`}
                        alt={rental.title}
                        className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
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

                    <h2 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                      {rental.title}
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      Owner:{" "}
                      <span className="text-slate-200">{rental.ownerName}</span>{" "}
                      <span className="text-slate-600">→</span> Renter:{" "}
                      <span className="text-slate-200">
                        {rental.renterName}
                      </span>
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/75 p-2.5 text-xs">
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
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
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
              </SpotlightCard>
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
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
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
                aria-label="Close repair rates modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-5 py-3">
              {[
                "ALL",
                "electronics",
                "camera",
                "bike_gear",
                "pg_room",
                "general",
              ].map((cat) => (
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
              ))}
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
                  No repair benchmark rates available in this category.
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
