import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  ImagePlus,
  Loader2,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { checkInRental } from "../api/client.js";
import BlurText from "../components/reactbits/BlurText.jsx";
import SpotlightCard from "../components/reactbits/SpotlightCard.jsx";
import StarBorder from "../components/reactbits/StarBorder.jsx";

const PRESETS = [
  {
    label: "Laptop Kit",
    category: "electronics",
    title: "MacBook Air M2 Laptop Kit",
    depositAmount: "5000",
    accessoryText: "USB-C Charger + Cable",
  },
  {
    label: "DSLR Camera",
    category: "camera",
    title: "Sony A6400 Mirrorless Kit",
    depositAmount: "3000",
    accessoryText: "Lens Cap + Battery",
  },
  {
    label: "Bike Helmet",
    category: "bike_gear",
    title: "Axor Apex Riding Helmet",
    depositAmount: "2000",
    accessoryText: "Clear Visor + Strap",
  },
  {
    label: "PG Room",
    category: "pg_room",
    title: "Koramangala PG Room #204",
    depositAmount: "10000",
    accessoryText: "Room Key + AC Remote",
  },
];

function defaultDueDateInput() {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function createSampleDeskPhotoFile(title, category) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas 2D context unavailable."));
      return;
    }

    // Dark desk background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 960, 600);

    // Desk mat grid
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(70, 90, 500, 340, 22);
    ctx.fill();
    ctx.stroke();

    // Inner device / item body
    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.roundRect(105, 125, 430, 270, 12);
    ctx.fill();

    // Pre-existing minor scuff on top-left corner
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

    // Included accessory box
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(620, 150, 260, 210, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#34d399";
    ctx.font = "bold 20px sans-serif";
    const accLabel =
      category === "camera"
        ? "Lens Cap + Battery"
        : category === "bike_gear"
        ? "Helmet Visor + Key"
        : category === "pg_room"
        ? "Room Key + Remote"
        : "USB-C Charger + Cable";
    ctx.fillText("INCLUDED ACCESSORY:", 640, 235);
    ctx.fillText(accLabel, 640, 270);

    // Footer metadata
    ctx.fillStyle = "#94a3b8";
    ctx.font = "18px monospace";
    ctx.fillText(
      `CHECK-IN BASELINE SAMPLE | ${(title || "RENTAL ITEM").slice(0, 32)}`,
      70,
      515
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode sample canvas image."));
          return;
        }
        resolve(
          new File([blob], "sample-checkin-baseline.png", {
            type: "image/png",
          })
        );
      },
      "image/png",
      0.92
    );
  });
}

export default function CheckInPage({ onDataChanged }) {
  const navigate = useNavigate();

  const [title, setTitle] = useState("MacBook Air M2 Laptop Kit");
  const [category, setCategory] = useState("electronics");
  const [ownerName, setOwnerName] = useState("Ananya Verma (Demo)");
  const [renterName, setRenterName] = useState("Rohan Kulkarni (Demo)");
  const [depositAmount, setDepositAmount] = useState("5000");
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

  const activePreset = PRESETS.find((p) => p.category === category);

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

  async function handleAttachSample() {
    setError("");
    if (files.length >= 4) {
      setError("Maximum 4 photos already attached.");
      return;
    }
    try {
      const sampleFile = await createSampleDeskPhotoFile(title, category);
      addFiles([sampleFile]);
    } catch (err) {
      setError(err?.message || "Failed to generate sample photo.");
    }
  }

  function applyPreset(preset) {
    setTitle(preset.title);
    setCategory(preset.category);
    setDepositAmount(preset.depositAmount);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (!title.trim() || !ownerName.trim() || !renterName.trim()) {
      setError("Title, owner name, and renter name are required.");
      return;
    }
    const parsedDate = new Date(dueDate);
    if (!dueDate || Number.isNaN(parsedDate.getTime())) {
      setError("Please select a valid return due date.");
      return;
    }
    if (files.length === 0) {
      setError(
        'Please upload at least 1 Check-In photo (or click "Attach Sample Desk Photo").'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await checkInRental({
        title: title.trim(),
        category,
        ownerName: ownerName.trim(),
        renterName: renterName.trim(),
        depositAmount: Number(depositAmount),
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

      {/* Category Presets */}
      <SpotlightCard
        spotlightColor="#34d399"
        intensity={0.09}
        className="mb-6 rounded-2xl p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Quick Demo Presets
          </p>
          {activePreset && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] text-emerald-300">
              <PackageCheck className="h-3 w-3" />
              Expected Accessories: {activePreset.accessoryText}
            </span>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                category === preset.category
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600 hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </SpotlightCard>

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
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
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
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-emerald-300 focus:border-emerald-500 focus:outline-none"
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
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
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
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
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
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Multi-Photo Upload + 1-click Sample Canvas Generator */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-300">
                Check-In Photos ({files.length}/4 max)
              </label>
              <div className="flex items-center gap-2">
                {files.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAttachSample}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition-colors cursor-pointer"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>Attach Sample Desk Photo</span>
                </button>
              </div>
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
