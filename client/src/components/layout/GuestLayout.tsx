import { Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTheme } from "../../lib/themeContext";
import { useGuestGate } from "../../lib/guestGate";
import { FlickerSpinner } from "../shared/FlickerSpinner";

const GUEST_ALLOWED = [
  /^\/$/,
  /^\/@[^/]+\/?$/,
  /^\/@[^/]+\/post\/[^/]+\/?$/,
];

function isGuestAllowed(pathname: string) {
  return GUEST_ALLOWED.some((pattern) => pattern.test(pathname));
}

export function GuestLayout() {
  const { theme } = useTheme();
  const { pathname } = useLocation();
  const { openGuestPrompt } = useGuestGate();
  const allowed = isGuestAllowed(pathname);

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-2xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-100 bg-white/80 px-4 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-black/80">
        <Link to="/">
          <img
            src={theme === "dark" ? "/wordmark-white.svg" : "/wordmark-black.svg"}
            alt="Socially"
            className="h-7"
          />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Log in
          </Link>
          <button
            onClick={openGuestPrompt}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Sign up
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1">
        {allowed ? (
          <Suspense
            fallback={
              <div className="flex h-64 w-full items-center justify-center">
                <FlickerSpinner size={36} />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <p className="text-lg font-medium">Create an account to see this</p>
            <p className="text-sm text-neutral-500">
              This part of Socially is for members. Sign up to unlock it.
            </p>
            <button
              onClick={openGuestPrompt}
              className="mt-2 rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Sign up
            </button>
            <Link to="/" className="text-sm font-medium text-brand hover:underline">
              Back to the feed
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
