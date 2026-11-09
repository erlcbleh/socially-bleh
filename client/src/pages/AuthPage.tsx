import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { SiDiscord } from "react-icons/si";
import { LuLoaderCircle } from "react-icons/lu";
import { Dithering } from "@paper-design/shaders-react";
import { useAuth } from "../lib/authContext";
import { useTheme } from "../lib/themeContext";
import { enableGuestMode } from "../lib/guestMode";
import { api, apiOrigin } from "../lib/api";

const discordAuthHref = apiOrigin
  ? `${apiOrigin}/api/auth/discord`
  : import.meta.env.DEV
    ? "http://localhost:4000/api/auth/discord"
    : "/api/auth/discord";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [verifying, setVerifying] = useState(false);
  const [networkBlocked, setNetworkBlocked] = useState(false);

  function continueAsGuest() {
    enableGuestMode();
    navigate("/");
  }

  async function handleContinue() {
    if (verifying) return;
    setVerifying(true);
    setNetworkBlocked(false);
    try {
      const { allowed } = await api.get<{ allowed: boolean }>("/auth/verify-network");
      if (allowed) {
        window.location.href = discordAuthHref;
        return;
      }
      setNetworkBlocked(true);
      setVerifying(false);
    } catch {
      window.location.href = discordAuthHref;
    }
  }

  if (isLoading) return null;
  if (user && user.status !== "deactivated") {
    return <Navigate to={user.onboardingComplete ? "/" : "/onboarding"} replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 dark:bg-black">
      <Dithering
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 22%), radial-gradient(ellipse 60% 55% at 50% 40%, black, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 22%), radial-gradient(ellipse 60% 55% at 50% 40%, black, transparent)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
        className="pointer-events-none absolute inset-0 opacity-10 dark:opacity-15"
        colorBack={theme === "dark" ? "#000000" : "#ffffff"}
        colorFront="#1A4DFF"
        shape="warp"
        type="4x4"
        size={6}
        speed={0.15}
      />
      <div className="relative w-full max-w-sm text-center">
        <Link to="/">
          <img src={theme === "dark" ? "/wordmark-white.svg" : "/wordmark-black.svg"} alt="Socially" className="mx-auto mb-6 w-36" />
        </Link>

        {params.get("deactivated") === "staff" ? (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            Your account was deactivated by our moderation team. Contact support if you think this is a
            mistake.
          </p>
        ) : params.get("deactivated") ? (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            Your account was deactivated. Logging in with Discord will reactivate it.
          </p>
        ) : null}
        {params.get("deleted") && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            Your account has been permanently deleted.
          </p>
        )}
        {networkBlocked || params.get("error") === "anti_abuse" ? (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            We couldn't sign you in from this network. Access through VPNs, proxies, or anonymizing services is
            blocked for Anti-Spam and Anti-Abuse purposes. Disable it and try again.
          </p>
        ) : params.get("error") === "account_banned" ? (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            This account has been banned.
          </p>
        ) : params.get("error") ? (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            Something went wrong signing you in. Please try again.
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleContinue}
          disabled={verifying}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-black dark:bg-white px-6 py-3 font-medium text-white dark:text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:opacity-60"
        >
          {verifying ? (
            <>
              <LuLoaderCircle className="h-5 w-5 animate-spin" />
              Verifying
            </>
          ) : (
            <>
              <SiDiscord className="h-5 w-5" />
              Continue with Discord
            </>
          )}
        </button>

        <p className="mt-3 text-xs text-neutral-400">
          By signing up, you agree to Socially's{" "}
          <Link to="/terms" className="underline hover:text-neutral-300">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-neutral-300">
            Privacy Policy
          </Link>
          .
        </p>

        <button
          type="button"
          onClick={continueAsGuest}
          className="mt-6 text-sm font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Continue as guest
        </button>
      </div>
    </div>
  );
}
