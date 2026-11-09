const c: Console | undefined = globalThis.console;

const HEADING = [
  "font-size: 48px",
  "font-weight: 900",
  "color: #ffffff",
  "background: #dc2626",
  "padding: 12px 24px",
  "border-radius: 8px",
  "text-shadow: 0 2px 4px rgba(0,0,0,0.4)",
].join(";");

const SUBHEADING = [
  "font-size: 22px",
  "font-weight: 800",
  "color: #f59e0b",
  "line-height: 1.5",
].join(";");

const BODY = ["font-size: 15px", "color: #e5e7eb", "line-height: 1.6"].join(";");

const FOOTER = ["font-size: 13px", "color: #9ca3af", "font-style: italic"].join(";");

const REPRINT_INTERVAL_MS = 30_000;

let lastPrinted = 0;

export function printConsoleWarning(): void {
  if (!c?.log) return;

  const now = Date.now();
  if (now - lastPrinted < REPRINT_INTERVAL_MS) return;
  lastPrinted = now;

  for (let i = 0; i < 10; i++) c.log("%cSTOP!", HEADING);

  c.log(
    "%cThis console is for experienced users only.%c\n\nIf someone told you to copy and paste something here, it is likely scam.\nThey may be trying to take over your Socially account.",
    SUBHEADING,
    BODY
  );

  c.log("%c⚠ WARNING 1 — PASTING CODE HERE CAN HAND OVER YOUR ACCOUNT", SUBHEADING);
  c.log(
    "%cAnything pasted into this console runs with your full permissions. A single line\nof code can post, message, follow, delete, or change your account settings as you —\nwithout ever showing you what it did.",
    BODY
  );

  c.log("%c⚠ WARNING 2 — YOUR LOGIN TOKEN CAN BE STOLEN", SUBHEADING);
  c.log(
    "%cPasted code can read your session token and send it to an attacker's server.\nWith that token they can sign in as you from anywhere in the world — no password,\nno email code, no login alert. Changing your password may not lock them out.",
    BODY
  );

  c.log("%c⚠ WARNING 3 — NOBODY FROM SOCIALLY WILL EVER ASK YOU TO DO THIS", SUBHEADING);
  c.log(
    "%cOur staff will never ask you to paste code, run a script, or share what you see in\nthis console. Not for free features, not for verification, not for \"unbanning\" an\naccount, not for support. Anyone who asks is attacking you. Close this and report them.",
    BODY
  );

  c.log(
    "%cIf you already pasted something here, log out of all devices and change your Discord password now.",
    FOOTER
  );
}

export function initConsoleWarning(): void {
  if (typeof window === "undefined") return;

  printConsoleWarning();

  const threshold = 160;
  let wasOpen = false;

  const check = () => {
    const isOpen =
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold;

    if (isOpen && !wasOpen) printConsoleWarning();
    wasOpen = isOpen;
  };

  check();
  window.addEventListener("resize", check);
}
