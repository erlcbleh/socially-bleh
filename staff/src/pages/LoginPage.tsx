import { staffLoginUrl } from "../lib/api";

const ERRORS: Record<string, string> = {
  oauth: "Discord sign-in failed or expired. Try again.",
  not_staff: "That Discord account holds no moderation authority.",
  account_inactive: "That account is suspended, banned, or deactivated.",
  wrong_host: "Sign-in landed on the wrong host. Try again from this page.",
  not_configured: "The staff panel is not configured on this deployment.",
};

export function LoginPage() {
  const error = new URLSearchParams(window.location.search).get("error");
  const message = error ? ERRORS[error] || "Sign-in failed. Try again." : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel-bg px-6 py-16">
      <main className="w-full max-w-[19rem] animate-fade-in text-center">
        <h1>
          <img src="/wordmark-white.svg" alt="Socially Staff" className="mx-auto h-auto w-44" />
        </h1>

        <p className="mt-7 text-[15px] leading-relaxed text-neutral-300">
          No unauthorized access. Staff permitted past this point only.
        </p>

        {message ? (
          <p
            role="alert"
            className="mt-6 rounded-squircle border border-severity-high/30 bg-severity-high/[0.06] px-4 py-3 text-[13px] leading-relaxed text-severity-high"
          >
            {message}
          </p>
        ) : null}

        <a
          href={staffLoginUrl}
          className="mt-8 flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-[15px] font-semibold text-black transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
        >
          Continue with Discord
        </a>

        <p className="mt-8 border-t border-panel-border pt-5 text-[13px] leading-relaxed text-neutral-600">
          Separate from your socially.lol account.
        </p>
      </main>
    </div>
  );
}
