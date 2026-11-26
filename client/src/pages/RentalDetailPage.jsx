import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileDown,
  ImagePlus,
  Loader2,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { checkOutRental, getRentalById } from "../api/client.js";
import { downloadVerdictPdf } from "../utils/pdfReport.js";
import HashSealCard from "../components/HashSealCard.jsx";
import PhotoGrid from "../components/PhotoGrid.jsx";
import BlurText from "../components/reactbits/BlurText.jsx";
import CountUp from "../components/reactbits/CountUp.jsx";
import SpotlightCard from "../components/reactbits/SpotlightCard.jsx";
import StarBorder from "../components/reactbits/StarBorder.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import TracePanel from "../components/TracePanel.jsx";

function formatInr(value) {
  const num = Number(value) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function createSampleDamagedReturnFile(rental) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas 2D context unavailable."));
      return;
    }

    const category = rental?.category || "general";
    const missingAcc =
      rental?.baselineSeal?.accessoriesPresent?.[0] ||
      (category === "camera"
        ? "lens cap"
        : category === "bike_gear"
        ? "visor"
        : category === "pg_room"
        ? "key"
        : "charger");

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 960, 600);

    if (category === "camera") {
      // Camera body matching synthetic Sony A6400 layout
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(70, 90, 500, 340, 28);
      ctx.fill();
      ctx.stroke();

      // Lens circle
      ctx.fillStyle = "#020617";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(320, 260, 105, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Same pre-existing top-left corner scuff
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(105, 130);
      ctx.lineTo(165, 148);
      ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("PRE-EXISTING CORNER SCUFF", 90, 75);

      // New scratch/crack across center lens glass
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(260, 210);
      ctx.lineTo(380, 310);
      ctx.stroke();
      ctx.fillStyle = "#fb7185";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("NEW LENS SCRATCH / CRACK", 205, 405);
    } else {
      // General/laptop/helmet/room layout matching CheckInPage sample
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(70, 90, 500, 340, 22);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.roundRect(105, 125, 430, 270, 12);
      ctx.fill();

      // Same pre-existing top-left corner scuff
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(95, 115);
      ctx.lineTo(155, 132);
      ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("PRE-EXISTING CORNER SCUFF", 85, 75);

      // Clearly visible NEW damage scratch & mark on center surface
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(205, 220);
      ctx.lineTo(420, 295);
      ctx.stroke();
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.roundRect(215, 315, 230, 44, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 17px sans-serif";
      ctx.fillText("NEW CENTER SCRATCH", 232, 343);
    }

    // Missing accessory outline on right
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.roundRect(620, 150, 260, 210, 18);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#fb7185";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(`${missingAcc.toUpperCase()}`, 645, 245);
    ctx.fillText("MISSING AT RETURN", 645, 278);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "18px monospace";
    ctx.fillText(
      `CHECK-OUT RETURN SAMPLE | ${(rental?.title || "RENTAL ITEM").slice(0, 32)}`,
      70,
      515
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode damaged sample image."));
          return;
        }
        resolve(
          new File([blob], "sample-checkout-damaged.png", {
            type: "image/png",
          })
        );
      },
      "image/png",
      0.92
    );
  });
}

export default function RentalDetailPage({ refreshKey = 0, onDataChanged }) {
  const { id } = useParams();

  const [rental, setRental] = useState(null);
  const [inspection, setInspection] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [sealVerification, setSealVerification] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [checkoutFiles, setCheckoutFiles] = useState([]);
  const [checkoutPreviews, setCheckoutPreviews] = useState([]);
  const [checkoutDragActive, setCheckoutDragActive] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const fetchRental = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const res = await getRentalById(id);
      setRental(res.rental);
      setInspection(res.inspection || null);
      setSettlement(res.settlement || null);
      setSealVerification(res.sealVerification || null);
    } catch (err) {
      setLoadError(err?.message || "Failed to load rental details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRental();
  }, [fetchRental, refreshKey]);

  useEffect(() => {
    const urls = checkoutFiles.map((file) => ({
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      url: URL.createObjectURL(file),
    }));
    setCheckoutPreviews(urls);

    return () => {
      urls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [checkoutFiles]);

  function addCheckoutFiles(incoming) {
    setCheckoutError("");
    const incomingArr = Array.from(incoming || []);
    const imagesOnly = incomingArr.filter(
      (f) => f.type && f.type.startsWith("image/")
    );
    if (imagesOnly.length < incomingArr.length) {
      setCheckoutError("Only image files (PNG, JPEG, WebP) are allowed.");
    }
    setCheckoutFiles((prev) => {
      const merged = [...prev, ...imagesOnly];
      if (merged.length > 4) {
        setCheckoutError("Maximum 4 check-out photos allowed.");
        return merged.slice(0, 4);
      }
      return merged;
    });
  }

  async function handleAttachSampleDamaged() {
    setCheckoutError("");
    if (checkoutFiles.length >= 4) {
      setCheckoutError("Maximum 4 check-out photos already attached.");
      return;
    }
    try {
      const file = await createSampleDamagedReturnFile(rental);
      addCheckoutFiles([file]);
    } catch (err) {
      setCheckoutError(err?.message || "Failed to generate sample return photo.");
    }
  }

  async function handleRunCheckout(e) {
    e.preventDefault();
    if (checkoutBusy || !rental) return;
    if (checkoutFiles.length === 0) {
      setCheckoutError(
        'Upload at least 1 Check-Out photo (or click "Attach Sample Damaged Return Photo").'
      );
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      const res = await checkOutRental(rental._id, checkoutFiles);
      setRental(res.rental);
      setInspection(res.inspection);
      setSettlement(res.settlement);
      setSealVerification(res.sealVerification);
      setCheckoutFiles([]);
      onDataChanged?.();
    } catch (err) {
      setCheckoutError(err?.message || "Check-Out forensic inspection failed.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  function handleSealUpdated(event) {
    if (event?.rental) {
      setRental(event.rental);
    }
    if (event?.sealVerification) {
      setSealVerification(event.sealVerification);
    }
    if (event?.type === "tamper" || event?.type === "restore") {
      onDataChanged?.();
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-20 text-sm text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        <span>Loading rental case &amp; cryptographic seal...</span>
      </div>
    );
  }

  if (loadError || !rental) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-rose-400" />
          <h2 className="mt-3 text-lg font-semibold text-white">
            Unable to load rental
          </h2>
          <p className="mt-1 text-sm text-rose-200">
            {loadError || "Rental not found."}
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const baselineFlaws = rental.baselineSeal?.preExistingFlaws || [];
  const accessories = rental.baselineSeal?.accessoriesPresent || [];
  const ignoredFlaws = inspection?.preExistingIgnored || [];
  const lineItems = settlement?.lineItems || [];
  const newFindings = inspection?.newFindings || [];

  const depositAmount = Number(
    settlement?.depositAmount ?? rental.depositAmount ?? 0
  );
  const hasOverride =
    settlement?.overrideTotalDeduction !== null &&
    settlement?.overrideTotalDeduction !== undefined;
  const effectiveDeduction = settlement
    ? hasOverride
      ? Number(settlement.overrideTotalDeduction)
      : Number(settlement.totalDeduction || 0)
    : 0;
  const refundToRenter = settlement
    ? Number(
        settlement.refundToRenter ?? Math.max(0, depositAmount - effectiveDeduction)
      )
    : depositAmount;
  const deductionPct =
    depositAmount > 0
      ? Math.min(100, Math.round((effectiveDeduction / depositAmount) * 100))
      : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={rental.status} />
          {settlement?.hitlStatus && (
            <StatusBadge status={settlement.hitlStatus} />
          )}
          {settlement && (
            <button
              type="button"
              onClick={() =>
                downloadVerdictPdf({
                  rental,
                  inspection,
                  settlement,
                  sealVerification,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download Forensic Verdict PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Case Hero Summary */}
      <SpotlightCard
        spotlightColor="#34d399"
        intensity={0.11}
        className="mb-6 rounded-2xl p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] uppercase text-sky-300">
                {rental.category}
              </span>
              <span className="font-mono text-xs text-slate-500">
                ID: {rental._id}
              </span>
            </div>
            <BlurText
              as="h1"
              key={rental._id}
              text={rental.title}
              delay={50}
              stepDuration={0.3}
              blur={8}
              distance={18}
              trigger="load"
              className="mt-2 text-2xl font-bold text-white"
            />
            <p className="mt-1 text-sm text-slate-400">
              Owner: <span className="text-slate-200">{rental.ownerName}</span>{" "}
              <span className="text-slate-600">•</span> Renter:{" "}
              <span className="text-slate-200">{rental.renterName}</span>{" "}
              <span className="text-slate-600">•</span> Due:{" "}
              <span className="font-mono text-slate-200">
                {formatDate(rental.dueDate)}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">
              Escrow Deposit Held
            </span>
            <p className="mt-0.5 font-mono text-2xl font-bold text-emerald-300">
              <CountUp
                to={depositAmount}
                prefix="₹"
                locale="en-IN"
                duration={0.8}
                trigger="load"
              />
            </p>
          </div>
        </div>

        {rental.overdueAlert?.flagged && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              {rental.overdueAlert.note ||
                "Checkout overdue — follow-up inspection required."}
            </span>
          </div>
        )}
      </SpotlightCard>

      {/* Split-Screen Hero Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN (7 cols): Evidence, Seal, Ignored Flaws, New Damage, Deposit Split */}
        <div className="space-y-6 lg:col-span-7">
          <PhotoGrid
            checkinImages={rental.checkinImages || []}
            checkoutImages={inspection?.checkoutImages || []}
          />

          <HashSealCard
            rentalId={rental._id}
            baselineSeal={rental.baselineSeal}
            sealVerification={sealVerification}
            onUpdated={handleSealUpdated}
          />

          {/* Sealed Summary & Accessories */}
          <SpotlightCard
            spotlightColor="#34d399"
            intensity={0.08}
            className="rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <PackageCheck className="h-4 w-4 text-emerald-400" />
              <span>Sealed Check-In Baseline Summary &amp; Accessories</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {rental.baselineSeal?.summary || "No baseline summary recorded."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {accessories.length > 0 ? (
                accessories.map((item, idx) => (
                  <span
                    key={`${item}-${idx}`}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs text-emerald-300"
                  >
                    ✓ {item}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">
                  No accessories recorded at Check-In.
                </span>
              )}
            </div>
          </SpotlightCard>

          {/* Green Card: Pre-Existing Flaws Ignored (₹0) */}
          <SpotlightCard
            spotlightColor="#10b981"
            surfaceColor="rgba(2, 44, 34, 0.25)"
            borderColor="rgba(16, 185, 129, 0.35)"
            intensity={0.12}
            className="rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-emerald-200">
                  Pre-Existing Flaws Ignored (₹0)
                </h3>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-300">
                ₹0 Renter Liability
              </span>
            </div>

            {ignoredFlaws.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {ignoredFlaws.map((flaw, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl border border-emerald-500/25 bg-slate-950/70 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-emerald-300">
                        [{flaw.zone}]
                      </span>
                      <span className="font-mono text-emerald-400">₹0</span>
                    </div>
                    <p className="mt-1 text-slate-200">{flaw.description}</p>
                    <p className="mt-1 text-[11px] text-emerald-300/80">
                      {flaw.reason}
                    </p>
                  </li>
                ))}
              </ul>
            ) : baselineFlaws.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {baselineFlaws.map((flaw, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl border border-emerald-500/25 bg-slate-950/70 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-emerald-300">
                        [{flaw.zone}] • {flaw.severity}
                      </span>
                      <span className="font-mono text-emerald-400">
                        Sealed ₹0
                      </span>
                    </div>
                    <p className="mt-1 text-slate-200">{flaw.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                No pre-existing flaws recorded at Check-In.
              </p>
            )}
          </SpotlightCard>

          {/* Red Card: New Damage / Missing Accessories */}
          <SpotlightCard
            spotlightColor={
              lineItems.length > 0 || newFindings.length > 0
                ? "#fb7185"
                : "#34d399"
            }
            surfaceColor={
              lineItems.length > 0 || newFindings.length > 0
                ? "rgba(76, 5, 25, 0.2)"
                : "#0f172a"
            }
            borderColor={
              lineItems.length > 0 || newFindings.length > 0
                ? "rgba(244, 63, 94, 0.4)"
                : "rgba(30, 41, 59, 0.95)"
            }
            intensity={0.12}
            className="rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`h-5 w-5 ${
                    lineItems.length > 0 ? "text-rose-400" : "text-slate-400"
                  }`}
                />
                <h3 className="text-sm font-semibold text-white">
                  New Damage / Missing Accessories Ledger
                </h3>
              </div>
              {settlement && (
                <span className="font-mono text-xs font-semibold text-rose-300">
                  {formatInr(effectiveDeduction)} total
                </span>
              )}
            </div>

            {!inspection ? (
              <p className="mt-3 text-xs text-slate-400">
                Awaiting Check-Out inspection. Upload return photos on the right
                to detect new damage or missing accessories.
              </p>
            ) : lineItems.length === 0 ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>
                  Clean return! Zero new damage or missing accessories detected
                  (₹0 deduction).
                </span>
              </div>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {lineItems.map((item, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl border border-rose-500/30 bg-slate-950/80 p-3.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] uppercase text-rose-300">
                          {item.type}
                        </span>
                        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] uppercase text-slate-300">
                          {item.severity}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold text-rose-300">
                        -{formatInr(item.deductionAmount)}
                      </span>
                    </div>
                    <p className="mt-2 font-medium text-white">
                      {item.findingDescription}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Rate Source: {item.rateSourceLabel || "Benchmark"}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {/* Deposit Split Bar */}
            {settlement && (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">
                    Deterministic Deposit Split
                    {hasOverride ? " (HITL Overridden)" : ""}
                  </span>
                  <span className="font-mono text-slate-300">
                    {deductionPct}% Deducted / {100 - deductionPct}% Refunded
                  </span>
                </div>

                <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-emerald-500/25">
                  <div
                    className="h-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${deductionPct}%` }}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${100 - deductionPct}%` }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500">
                      Deposit
                    </span>
                    <p className="text-white font-semibold">
                      {formatInr(depositAmount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500">
                      Deduction
                    </span>
                    <p className="text-rose-300 font-semibold">
                      {formatInr(effectiveDeduction)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-slate-500">
                      Refund to Renter
                    </span>
                    <p className="text-emerald-300 font-semibold">
                      {formatInr(refundToRenter)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </SpotlightCard>
        </div>

        {/* RIGHT COLUMN (5 cols): Check-Out Upload, TracePanel, HITL & PDF Actions */}
        <div className="space-y-6 lg:col-span-5">
          {/* Check-Out Upload Form */}
          <SpotlightCard
            spotlightColor="#38bdf8"
            intensity={0.1}
            className="rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {rental.status === "CHECKED_IN"
                      ? "Check-Out Return Inspection"
                      : "Re-Run Check-Out Inspection"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upload up to 4 return photos for two-pass forensic diff
                  </p>
                </div>
              </div>
            </div>

            {rental.status === "SETTLED" ? (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                This rental is <strong>SETTLED</strong>. Check-Out inspection is
                locked; download the Forensic Verdict PDF or inspect the audit
                trace below.
              </div>
            ) : (
              <form onSubmit={handleRunCheckout} className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    Selected: {checkoutFiles.length}/4 photo(s)
                  </span>
                  <div className="flex items-center gap-2">
                    {checkoutFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCheckoutFiles([])}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAttachSampleDamaged}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      <span>Attach Sample Damaged Return Photo</span>
                    </button>
                  </div>
                </div>

                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setCheckoutDragActive(true);
                  }}
                  onDragLeave={() => setCheckoutDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setCheckoutDragActive(false);
                    addCheckoutFiles(e.dataTransfer.files);
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                    checkoutDragActive
                      ? "border-emerald-400 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-950/60 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      addCheckoutFiles(e.target.files);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                  <UploadCloud className="h-6 w-6 text-sky-400" />
                  <p className="mt-2 text-xs font-medium text-slate-200">
                    Drop or click to select Check-Out photos (max 4, 8 MB each)
                  </p>
                </label>

                {checkoutPreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {checkoutPreviews.map((item, idx) => (
                      <div
                        key={`${item.name}-${idx}`}
                        className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          className="h-24 w-full object-contain bg-slate-950"
                        />
                        <div className="flex items-center justify-between border-t border-slate-800 px-2 py-1 text-[11px]">
                          <span className="truncate text-slate-400">
                            {item.sizeKb} KB
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCheckoutFiles((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {checkoutError && (
                  <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {checkoutError}
                  </p>
                )}

                <StarBorder
                  type="submit"
                  disabled={checkoutBusy}
                  color="#34d399"
                  trailColor="#10b981"
                  backgroundColor="#10b981"
                  textColor="#020617"
                  borderColor="rgba(52, 211, 153, 0.65)"
                  radius={12}
                  duration={3.5}
                  className="flex w-full px-4 py-2.5 text-sm font-semibold hover:brightness-110 transition-all"
                >
                  {checkoutBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span>
                    {checkoutBusy
                      ? "Running 4-Stage Forensic Diff..."
                      : "Run Check-Out Forensic Diff"}
                  </span>
                </StarBorder>
              </form>
            )}
          </SpotlightCard>

          {/* Glass-Box TracePanel */}
          <TracePanel
            agentTrace={inspection?.agentTrace || []}
            reviewerGate={settlement?.reviewerGate || null}
            sameObjectConfirmed={inspection?.sameObjectConfirmed}
            qualityWarning={inspection?.qualityWarning}
          />

          {/* HITL & Verdict Actions */}
          {settlement && (
            <SpotlightCard
              spotlightColor="#fbbf24"
              intensity={0.1}
              className="rounded-2xl p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">
                  HITL Settlement &amp; Verdict Export
                </h3>
                <StatusBadge status={settlement.hitlStatus} size="xs" />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Review AI findings, edit deduction amounts if needed, or export
                the cryptographic Forensic Verdict PDF.
              </p>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <Link
                  to="/approvals"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
                >
                  <span>Open Approval Queue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={() =>
                    downloadVerdictPdf({
                      rental,
                      inspection,
                      settlement,
                      sealVerification,
                    })
                  }
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </SpotlightCard>
          )}
        </div>
      </div>
    </div>
  );
}
