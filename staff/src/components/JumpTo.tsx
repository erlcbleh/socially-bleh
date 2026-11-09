import { LuExternalLink } from "react-icons/lu";

export function JumpTo({
  href,
  label = "Jump to",
  disabled,
  disabledReason,
  className = "",
}: {
  href: string | null;
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const blocked = disabled || !href;

  if (blocked) {
    return (
      <span
        title={disabledReason || "Not available"}
        className={`inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1 text-[12px] text-neutral-600 ${className}`}
      >
        <LuExternalLink className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      title={`${label} (opens a new tab)`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[12px] text-neutral-300 transition-colors hover:border-white/40 hover:bg-white/[0.06] hover:text-white ${className}`}
    >
      <LuExternalLink className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}
