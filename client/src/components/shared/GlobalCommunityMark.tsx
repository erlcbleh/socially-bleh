import { LuGlobe } from "react-icons/lu";

export function GlobalCommunityMark({ className = "h-5 w-5" }: { className?: string }) {
  return <LuGlobe className={`text-neutral-600 dark:text-neutral-300 ${className}`} aria-label="Global" />;
}
