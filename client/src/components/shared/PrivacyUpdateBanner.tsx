import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LuX, LuChevronDown } from "react-icons/lu";

const DISMISS_KEY = "socially-legal-update-banner-2026-08-11";
const HEIGHT_VAR = "--legal-banner-h";

export function PrivacyUpdateBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (dismissed || !el) {
      root.style.setProperty(HEIGHT_VAR, "0px");
      return;
    }
    const apply = () => root.style.setProperty(HEIGHT_VAR, `${el.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty(HEIGHT_VAR, "0px");
    };
  }, [dismissed]);

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div ref={ref} className="bg-black pt-[env(safe-area-inset-top)] text-white">
      <div className="relative flex items-center justify-center gap-3 px-8 py-2 text-center text-sm">
        <p>
          We updated our{" "}
          <Link to="/privacy" className="underline underline-offset-2 hover:no-underline">
            Privacy Policy
          </Link>
          .{" "}
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="underline underline-offset-2 hover:no-underline"
          >
            What changed?
            <LuChevronDown className={`ml-1 inline h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-3 rounded-full p-1 hover:bg-white/20"
        >
          <LuX className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`bg-black px-4 py-3 text-sm transition-opacity duration-300 ${
              expanded ? "opacity-100 delay-100" : "opacity-0"
            }`}
          >
            <div className="mx-auto max-w-xl space-y-3">
              <div>
                <p className="mb-1 font-medium text-white/80">Privacy Policy</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Clearer explanation of the automated content screening by OpenAI — what we send, why, and when
                    our staff may review flagged content.
                  </li>
                  <li>
                    A dedicated section on VPN/proxy checks (proxycheck.io) at sign-up and log-in, and how to ask us
                    to review a block you think is a mistake.
                  </li>
                  <li>
                    More detail on data retention and deletion, including backups, provider caches, and security
                    logs.
                  </li>
                  <li>Clearer children's-privacy, legal-bases, and international-transfer sections.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
