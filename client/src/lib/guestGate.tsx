import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { SiDiscord } from "react-icons/si";
import { LuLoaderCircle } from "react-icons/lu";
import { Modal } from "../components/shared/Modal";
import { api, apiOrigin } from "./api";
import { useAuth } from "./authContext";

const discordAuthHref = apiOrigin
  ? `${apiOrigin}/api/auth/discord`
  : import.meta.env.DEV
    ? "http://localhost:4000/api/auth/discord"
    : "/api/auth/discord";

interface GuestGateContextValue {
  openGuestPrompt: () => void;
  requireAccount: () => boolean;
}

const GuestGateContext = createContext<GuestGateContextValue | undefined>(undefined);

export function GuestGateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const openGuestPrompt = useCallback(() => setOpen(true), []);

  const requireAccount = useCallback(() => {
    if (user) return false;
    setOpen(true);
    return true;
  }, [user]);

  async function handleSignUp() {
    if (verifying) return;
    setVerifying(true);
    try {
      const { allowed } = await api.get<{ allowed: boolean }>("/auth/verify-network");
      if (allowed) {
        window.location.href = discordAuthHref;
        return;
      }
      window.location.href = "/login?error=anti_abuse";
    } catch {
      window.location.href = discordAuthHref;
    }
  }

  return (
    <GuestGateContext.Provider value={{ openGuestPrompt, requireAccount }}>
      {children}
      <Modal open={open} onClose={() => setOpen(false)} size="sm">
        <div className="text-center">
          <h2 className="text-xl font-medium text-black dark:text-white">
            Join the others in Socially and make an account
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Sign up to follow accounts, like posts, reply and more.
          </p>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={verifying}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-black px-6 py-3 font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {verifying ? (
              <>
                <LuLoaderCircle className="h-5 w-5 animate-spin" />
                Verifying
              </>
            ) : (
              <>
                <SiDiscord className="h-5 w-5" />
                Sign up with Discord
              </>
            )}
          </button>
        </div>
      </Modal>
    </GuestGateContext.Provider>
  );
}

export function useGuestGate() {
  const ctx = useContext(GuestGateContext);
  if (!ctx) throw new Error("useGuestGate must be used within GuestGateProvider");
  return ctx;
}
