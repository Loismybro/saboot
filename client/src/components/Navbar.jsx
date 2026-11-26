import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  CheckSquare,
  LayoutDashboard,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { getHealth } from "../api/client.js";
import ShinyText from "./reactbits/ShinyText.jsx";

export function Navbar({ pendingCount = 0 }) {
  const [health, setHealth] = useState({
    state: "waking",
    model: "",
    dbState: "",
  });

  async function refreshHealth() {
    setHealth((prev) => ({ ...prev, state: "waking" }));
    try {
      const data = await getHealth();
      setHealth({
        state: data?.ok && data?.dbState === "connected" ? "online" : "degraded",
        model: data?.model || "gemini-3.5-flash-lite",
        dbState: data?.dbState || "unknown",
      });
    } catch {
      setHealth({
        state: "offline",
        model: "",
        dbState: "unreachable",
      });
    }
  }

  useEffect(() => {
    refreshHealth();
  }, []);

  const dotCls =
    health.state === "online"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
      : health.state === "waking" || health.state === "degraded"
      ? "bg-amber-400 animate-pulse"
      : "bg-rose-500";

  const statusText =
    health.state === "online"
      ? health.model || "Online"
      : health.state === "waking"
      ? "Waking API..."
      : health.state === "degraded"
      ? `DB: ${health.dbState}`
      : "API Offline";

  const navLinkCls = ({ isActive }) =>
    `inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
      isActive
        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shadow-[0_0_16px_-6px_rgba(16,185,129,0.5)]"
        : "text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-black/65 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:shadow-[0_0_18px_-4px_rgba(16,185,129,0.5)] transition-all">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">
                  SABOOT
                </span>
                <span className="hidden rounded border border-emerald-500/25 bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider sm:inline-flex">
                  <ShinyText
                    text="SHA-256 + AI"
                    color="#34d399"
                    shineColor="#ecfdf5"
                    speed={2.4}
                    delay={1.4}
                  />
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none">
                Forensic Visual-Diff Rental Arbitration
              </p>
            </div>
          </NavLink>

          <nav className="flex items-center gap-1.5 overflow-x-auto">
            <NavLink to="/" end className={navLinkCls}>
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/checkin" className={navLinkCls}>
              <PlusCircle className="h-4 w-4" />
              <span>New Check-In</span>
            </NavLink>
            <NavLink to="/approvals" className={navLinkCls}>
              <CheckSquare className="h-4 w-4" />
              <span>Approval Queue</span>
              {pendingCount > 0 && (
                <span className="ml-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] text-amber-300 border border-amber-500/30">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={refreshHealth}
            title={`Backend DB: ${health.dbState || "checking"} — click to recheck /health`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-mono text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            <span className={`h-2 w-2 rounded-full ${dotCls}`} />
            <span>{statusText}</span>
            <RefreshCw
              className={`h-3 w-3 text-slate-500 ${
                health.state === "waking" ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
