import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getPendingSettlements } from "./api/client.js";
import Navbar from "./components/Navbar.jsx";
import ClickSpark from "./components/reactbits/ClickSpark.jsx";
import ShapeGrid from "./components/reactbits/ShapeGrid.jsx";
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
      <div className="relative min-h-screen bg-slate-950 text-slate-100">
        {/* Ambient forensic grid backdrop from ReactBits */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <ShapeGrid
            shape="square"
            cellSize={46}
            speed={0.22}
            direction="diagonal"
            lineColor="#1e293b"
            hoverColor="#10b981"
            hoverFillColor="#10b981"
            fillOpacity={0.07}
            glow={0.25}
            fade={1}
            opacity={0.26}
            clickCascade={false}
          />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          <Navbar
            onSeeded={triggerGlobalRefresh}
            pendingCount={pendingCount}
          />

          <ClickSpark
            sparkColor={["#34d399", "#38bdf8"]}
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
