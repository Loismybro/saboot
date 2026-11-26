import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ShieldCheck,
  X,
} from "lucide-react";
import SpotlightCard from "./reactbits/SpotlightCard.jsx";

function renderDataUrl(img) {
  if (!img?.base64) return "";
  return `data:${img.mimeType || "image/webp"};base64,${img.base64}`;
}

export function PhotoGrid({ checkinImages = [], checkoutImages = [] }) {
  const [zoomIndex, setZoomIndex] = useState(null);

  const allPhotos = useMemo(
    () => [
      ...checkinImages.map((img, i) => ({
        ...img,
        side: "Check-In Sealed",
        fallbackLabel: `checkin-${i + 1}.webp`,
      })),
      ...checkoutImages.map((img, i) => ({
        ...img,
        side: "Check-Out Return",
        fallbackLabel: `checkout-${i + 1}.webp`,
      })),
    ],
    [checkinImages, checkoutImages]
  );

  const zoomedImage =
    zoomIndex !== null && allPhotos[zoomIndex] ? allPhotos[zoomIndex] : null;

  useEffect(() => {
    if (zoomIndex === null) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setZoomIndex(null);
      } else if (e.key === "ArrowRight" && allPhotos.length > 1) {
        setZoomIndex((prev) =>
          prev === null ? null : (prev + 1) % allPhotos.length
        );
      } else if (e.key === "ArrowLeft" && allPhotos.length > 1) {
        setZoomIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + allPhotos.length) % allPhotos.length
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomIndex, allPhotos.length]);

  return (
    <SpotlightCard
      spotlightColor="#38bdf8"
      intensity={0.08}
      className="rounded-2xl p-5"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-emerald-400">
            <Camera className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Side-by-Side Forensic Evidence Photos
            </h3>
            <p className="text-xs text-slate-400">
              Sealed Check-In baseline vs. Check-Out return captures (click to
              zoom)
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {/* Check-In Column */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Check-In Sealed Photos
            </span>
            <span className="font-mono text-xs text-slate-400">
              {checkinImages.length} photo{checkinImages.length === 1 ? "" : "s"}
            </span>
          </div>

          {checkinImages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-xs text-slate-500">
              No Check-In photos recorded.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {checkinImages.map((img, idx) => (
                <div
                  key={`${img.sha256 || idx}`}
                  className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 transition-colors hover:border-emerald-500/35"
                >
                  <button
                    type="button"
                    onClick={() => setZoomIndex(idx)}
                    className="group relative block w-full cursor-zoom-in overflow-hidden"
                  >
                    <img
                      src={renderDataUrl(img)}
                      alt={img.label || `Check-In ${idx + 1}`}
                      className="h-48 w-full object-contain bg-slate-950 transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <span className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-950/85 p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-3 py-2 text-[11px]">
                    <span className="truncate text-slate-300">
                      {img.label || `checkin-${idx + 1}.webp`}
                    </span>
                    <span className="shrink-0 font-mono text-emerald-400">
                      {img.sha256 ? `${img.sha256.slice(0, 12)}…` : "unhashed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Check-Out Column */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-300">
              <Camera className="h-3.5 w-3.5" />
              Check-Out Return Photos
            </span>
            <span className="font-mono text-xs text-slate-400">
              {checkoutImages.length} photo{checkoutImages.length === 1 ? "" : "s"}
            </span>
          </div>

          {checkoutImages.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center">
              <Camera className="h-6 w-6 text-slate-600" />
              <p className="mt-2 text-xs font-medium text-slate-400">
                No Check-Out photos uploaded yet
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Upload return photos in the Check-Out panel to run the visual
                diff.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {checkoutImages.map((img, idx) => (
                <div
                  key={`${img.sha256 || idx}`}
                  className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 transition-colors hover:border-sky-500/35"
                >
                  <button
                    type="button"
                    onClick={() => setZoomIndex(checkinImages.length + idx)}
                    className="group relative block w-full cursor-zoom-in overflow-hidden"
                  >
                    <img
                      src={renderDataUrl(img)}
                      alt={img.label || `Check-Out ${idx + 1}`}
                      className="h-48 w-full object-contain bg-slate-950 transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <span className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-950/85 p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-3 py-2 text-[11px]">
                    <span className="truncate text-slate-300">
                      {img.label || `checkout-${idx + 1}.webp`}
                    </span>
                    <span className="shrink-0 font-mono text-sky-400">
                      {img.sha256 ? `${img.sha256.slice(0, 12)}…` : "unhashed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          onClick={() => setZoomIndex(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-4 px-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`font-semibold ${
                    zoomedImage.side === "Check-In Sealed"
                      ? "text-emerald-400"
                      : "text-sky-400"
                  }`}
                >
                  {zoomedImage.side}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300">
                  {zoomedImage.label || zoomedImage.fallbackLabel}
                </span>
                {zoomedImage.sha256 && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      sha256:{zoomedImage.sha256.slice(0, 16)}…
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {allPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setZoomIndex(
                          (zoomIndex - 1 + allPhotos.length) % allPhotos.length
                        )
                      }
                      className="rounded-lg border border-slate-700 bg-slate-800 p-1 text-slate-300 hover:text-white cursor-pointer"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-1 font-mono text-[11px] text-slate-400">
                      {zoomIndex + 1}/{allPhotos.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setZoomIndex((zoomIndex + 1) % allPhotos.length)
                      }
                      className="rounded-lg border border-slate-700 bg-slate-800 p-1 text-slate-300 hover:text-white cursor-pointer"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setZoomIndex(null)}
                  className="rounded-lg border border-slate-700 bg-slate-800 p-1 text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Close photo preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <img
              src={renderDataUrl(zoomedImage)}
              alt={zoomedImage.label || zoomedImage.fallbackLabel}
              className="max-h-[78vh] w-auto rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </SpotlightCard>
  );
}

export default PhotoGrid;
