import { useEffect, Suspense, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { CommunityBanGate } from "../shared/CommunityBanGate";
import { FlickerSpinner } from "../shared/FlickerSpinner";

export function AppLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute("content");
    if (!meta || !original) return;
    meta.setAttribute("content", `${original}, maximum-scale=1`);
    const id = requestAnimationFrame(() => meta.setAttribute("content", original));
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  return (
    <div className="mx-auto flex flex-col h-[calc(100svh_-_var(--legal-banner-h,0px))] max-w-7xl overflow-hidden sm:h-auto sm:min-h-[calc(100svh_-_var(--legal-banner-h,0px))] sm:flex-row sm:overflow-visible">
      <CommunityBanGate />
      <div className="hidden shrink-0 sm:block sm:w-64">
        <Sidebar />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden sm:overflow-visible">
        <main className="w-full min-w-0 max-w-2xl overflow-x-hidden overflow-y-auto overscroll-y-contain sm:overflow-visible sm:overscroll-y-auto">
          <TopBar />
          {children ?? (
            <Suspense
              fallback={
                <div className="flex h-64 w-full items-center justify-center">
                  <FlickerSpinner size={36} />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          )}
        </main>
        <div className="hidden w-80 shrink-0 lg:block">
          <RightPanel />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
