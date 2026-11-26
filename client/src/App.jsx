import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getPendingSettlements } from "./api/client.js";
import Navbar from "./components/Navbar.jsx";
import ClickSpark from "./components/reactbits/ClickSpark.jsx";
import MicroSlats from "./components/reactbits/MicroSlats.jsx";
import ApprovalQueuePage from "./pages/ApprovalQueuePage.jsx";
import CheckInPage from "./pages/CheckInPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import RentalDetailPage from "./pages/RentalDetailPage.jsx";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const res = await getPendingSettlements("PENDING_APPROVAL");
      setPendingCount(res?.count ?? res?.settlements?.length ?? 0);
    } catch {
      // Keep previous count silently if backend is waking up
    }
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount, refreshKey]);

  function triggerGlobalRefresh() {
    setRefreshKey((prev) => prev + 1);
  }

  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-black text-slate-100">
        {/* Full-viewport interactive MicroSlats WebGL background */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <MicroSlats
            preset="swell"
            color="#085166"
            glintColor="#7c3aed"
            backgroundColor="#000000"
            slatWidth={10}
            slatHeight={25}
            gap={3}
            roundness={0.75}
            interactive
            cursorStrength={1}
            cursorSize={40}
            swirl={0}
            trail={1.4}
            lean={0}
            intro
            scale={1.5}
            speed={0}
            direction={250}
            chop={0.55}
            stretch={0}
            glint={0.7}
            contrast={1.25}
            perspective={0.55}
            fog={0.35}
            introDuration={1.5}
            paused={false}
          />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          <Navbar pendingCount={pendingCount} />

          <ClickSpark
            sparkColor={["#34d399", "#7c3aed"]}
            sparkCount={6}
            sparkRadius={18}
            sparkSize={9}
            duration={360}
            glow={0.3}
            className="flex-1"
          >
            <main className="pb-12">
              <Routes>
                <Route
                  path="/"
                  element={
                    <Dashboard
                      refreshKey={refreshKey}
                      onDataChanged={triggerGlobalRefresh}
                    />
                  }
                />
                <Route
                  path="/checkin"
                  element={<CheckInPage onDataChanged={triggerGlobalRefresh} />}
                />
                <Route
                  path="/rentals/:id"
                  element={
                    <RentalDetailPage
                      refreshKey={refreshKey}
                      onDataChanged={triggerGlobalRefresh}
                    />
                  }
                />
                <Route
                  path="/approvals"
                  element={
                    <ApprovalQueuePage
                      refreshKey={refreshKey}
                      onDataChanged={triggerGlobalRefresh}
                    />
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </ClickSpark>
        </div>
      </div>
    </BrowserRouter>
  );
}
