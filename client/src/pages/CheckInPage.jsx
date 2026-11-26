import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Loader2,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { checkInRental } from "../api/client.js";
import BlurText from "../components/reactbits/BlurText.jsx";
import SpotlightCard from "../components/reactbits/SpotlightCard.jsx";
import StarBorder from "../components/reactbits/StarBorder.jsx";

function defaultDueDateInput() {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export default function CheckInPage({ onDataChanged }) {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("electronics");
  const [ownerName, setOwnerName] = useState("");
  const [renterName, setRenterName] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDateInput);

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urls = files.map((file) => ({
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      url: URL.createObjectURL(file),
    }));
    setPreviews(urls);

    return () => {
      urls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [files]);

  function addFiles(incoming) {
    setError("");
    const incomingArr = Array.from(incoming || []);
    const imagesOnly = incomingArr.filter(
      (f) => f.type && f.type.startsWith("image/")
    );

    if (imagesOnly.length < incomingArr.length) {
      setError("Only image files (PNG, JPEG, WebP) are allowed.");
    }

    setFiles((prev) => {
      const merged = [...prev, ...imagesOnly];
      if (merged.length > 4) {
        setError("Maximum 4 check-in photos allowed.");
        return merged.slice(0, 4);
      }
      return merged;
    });
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (!title.trim() || !ownerName.trim() || !renterName.trim()) {
      setError("Title, owner name, and renter name are required.");
      return;
    }
    const depositNum = Number(depositAmount);
    if (
      depositAmount === "" ||
      !Number.isFinite(depositNum) ||
      depositNum < 0
    ) {
      setError("Please enter a valid non-negative security deposit.");
      return;
    }
    const parsedDate = new Date(dueDate);
    if (!dueDate || Number.isNaN(parsedDate.getTime())) {
      setError("Please select a valid return due date.");
      return;
    }
    if (files.length === 0) {
      setError("Please upload at least 1 Check-In condition photo.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await checkInRental({
        title: title.trim(),
        category,
        ownerName: ownerName.trim(),
        renterName: renterName.trim(),
        depositAmount: depositNum,
        dueDate: parsedDate.toISOString(),
        photos: files,
      });
      onDataChanged?.();
      navigate(`/rentals/${res.rental._id}`);
    } catch (err) {
      setError(err?.message || "Check-In submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <BlurText
          as="h1"
          text="New Check-In Baseline Seal"
          delay={60}
          stepDuration={0.32}
          blur={8}
          distance={20}
          trigger="load"
          className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
        />
        <p className="mt-1 text-sm text-slate-400">
          Compress up to 4 condition photos into WebP, extract pre-existing flaws
          and accessories via Gemini, and lock the canonical baseline with
          SHA-256.
        </p>
      </div>

      <SpotlightCard
        spotlightColor="#38bdf8"
        intensity={0.08}
        className="rounded-2xl p-6"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300">
                Rental Item Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sony A6400 Mirrorless Kit"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="electronics">Electronics</option>
                <option value="camera">Camera Gear</option>
                <option value="bike_gear">Bike Gear</option>
                <option value="pg_room">PG Room</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Security Deposit (₹ INR)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 font-mono text-sm text-emerald-300 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Owner Name
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner full name"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Renter Name
              </label>
              <input
                type="text"
                required
                value={renterName}
                onChange={(e) => setRenterName(e.target.value)}
                placeholder="Renter full name"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Return Due Date
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2.5 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Multi-Photo Upload */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-300">
                Check-In Photos ({files.length}/4 max)
              </label>
              {files.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                dragActive
                  ? "border-emerald-400 bg-emerald-500/10"
                  : "border-slate-700 bg-slate-950/60 hover:border-slate-600"
              }`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-emerald-400">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="mt-2.5 text-sm font-medium text-slate-200">
                Drop photos here, click to browse, or capture with camera
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Up to 4 images (max 8 MB each) — auto-compressed to WebP
                &le;1024px
              </p>
            </label>

            {previews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {previews.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      className="h-28 w-full object-contain bg-slate-950"
                    />
                    <div className="flex items-center justify-between gap-1 border-t border-slate-800 px-2.5 py-1.5 text-[11px]">
                      <span className="truncate text-slate-300" title={item.name}>
                        {item.sizeKb} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="rounded p-0.5 text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        title="Remove photo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Camera className="h-4 w-4 text-emerald-400" />
              <span>
                Gemini extracts pre-existing flaws &rarr; SHA-256 locks the seal
              </span>
            </div>

            <StarBorder
              type="submit"
              disabled={submitting}
              color="#34d399"
              trailColor="#10b981"
              backgroundColor="#10b981"
              textColor="#020617"
              borderColor="rgba(52, 211, 153, 0.65)"
              radius={12}
              duration={3.5}
              className="px-5 py-2.5 text-sm font-semibold hover:brightness-110 transition-all"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              <span>
                {submitting
                  ? "Analyzing & Sealing Baseline..."
                  : "Seal Check-In Baseline"}
              </span>
            </StarBorder>
          </div>
        </form>
      </SpotlightCard>
    </div>
  );
}
