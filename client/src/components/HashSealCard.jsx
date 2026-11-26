import { useEffect, useState } from "react";
import {
  AlertOctagon,
  Check,
  Copy,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { verifyRentalHash } from "../api/client.js";
import DecryptedText from "./reactbits/DecryptedText.jsx";
import SpotlightCard from "./reactbits/SpotlightCard.jsx";
import StatusBadge from "./StatusBadge.jsx";

export function HashSealCard({
  rentalId,
  baselineSeal,
  sealVerification,
  onUpdated,
}) {
  const [verification, setVerification] = useState(sealVerification || null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [verifySeq, setVerifySeq] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setVerification(sealVerification || null);
  }, [sealVerification]);

  const expectedHash =
    verification?.expectedHash || baselineSeal?.sha256Hash || "—";
  const actualHash = verification?.actualHash ?? null;
  const isValid = verification ? Boolean(verification.valid) : null;

  async function handleCopyHash() {
    if (!expectedHash || expectedHash === "—") return;
    try {
      await navigator.clipboard.writeText(expectedHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in restricted contexts
    }
  }

  async function handleVerify() {
    if (!rentalId || verifying) return;
    setVerifying(true);
    setError("");
    try {
      const res = await verifyRentalHash(rentalId);
      setVerification(res);
      setVerifySeq((s) => s + 1);
      onUpdated?.({ type: "verify", sealVerification: res });
    } catch (err) {
      setError(err?.message || "Hash seal verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <SpotlightCard
      spotlightColor={isValid === false ? "#fb7185" : "#34d399"}
      surfaceColor={
        isValid === false ? "rgba(76, 5, 25, 0.35)" : "rgba(9, 14, 28, 0.82)"
      }
      borderColor={
        isValid === false
          ? "rgba(244, 63, 94, 0.5)"
          : "rgba(51, 65, 85, 0.65)"
      }
      intensity={0.12}
      className="rounded-2xl p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              isValid === false
                ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {isValid === false ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Cryptographic Check-In Seal (SHA-256)
            </h3>
            <p className="text-xs text-slate-400">
              {baselineSeal?.sealedAt
                ? `Sealed ${new Date(baselineSeal.sealedAt).toLocaleString()}`
                : "Canonical payload + WebP buffer integrity proof"}
            </p>
          </div>
        </div>

        <StatusBadge
          status={
            isValid === true
              ? "VERIFIED"
              : isValid === false
              ? "TAMPERED"
              : "UNVERIFIED"
          }
        />
      </div>

      {isValid === false && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 p-3.5 text-xs text-rose-200">
          <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <p className="font-semibold text-rose-300">
              TAMPER DETECTED — SHA-256 Mismatch
            </p>
            <p className="mt-0.5">
              {verification?.tamperedFieldHint ||
                "Stored baseline ledger or check-in images do not match the original cryptographic seal."}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 font-mono text-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-slate-500 uppercase text-[10px]">
              Sealed Expected Hash
            </span>
            <p className="mt-0.5 break-all text-emerald-300">
              {expectedHash !== "—" ? (
                <DecryptedText
                  key={`${expectedHash}-${verifySeq}`}
                  text={expectedHash}
                  characters="0123456789abcdef"
                  animateOn="view"
                  sequential
                  speed={10}
                  maxIterations={5}
                  revealDirection="start"
                  breakAll
                  scrambleColor={isValid === false ? "#fb7185" : "#34d399"}
                />
              ) : (
                "—"
              )}
            </p>
          </div>

          {expectedHash !== "—" && (
            <button
              type="button"
              onClick={handleCopyHash}
              title="Copy SHA-256 hash"
              className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {isValid === false && (
          <div className="border-t border-slate-800 pt-2">
            <span className="text-rose-400 uppercase text-[10px]">
              Live Recomputed Hash
            </span>
            <p className="mt-0.5 break-all text-rose-300">
              {actualHash || "Mismatch before full seal recomputation"}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {verifying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          <span>{verifying ? "Verifying..." : "Verify SHA-256"}</span>
        </button>
      </div>
    </SpotlightCard>
  );
}

export default HashSealCard;
