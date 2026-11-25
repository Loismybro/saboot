import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getPendingSettlements } from "./api/client.js";
import Navbar from "./components/Navbar.jsx";
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
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navbar
          onSeeded={triggerGlobalRefresh}
          pendingCount={pendingCount}
        />

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
      </div>
    </BrowserRouter>
  );
}
