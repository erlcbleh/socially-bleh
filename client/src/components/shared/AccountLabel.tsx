import { LuTriangleAlert } from "react-icons/lu";
import { Tooltip } from "./Tooltip";

export function AccountLabel({
  label,
  className = "h-4 w-4",
}: {
  label?: string | null;
  className?: string;
}) {
  const text = (label || "").trim();

  if (!text) return null;

  return (
    <Tooltip text={text} multiline>
      <span
        role="img"
        aria-label={text}
        tabIndex={0}
        className="inline-flex items-center justify-center text-amber-500 outline-none dark:text-amber-400"
      >
        <LuTriangleAlert className={className} />
      </span>
    </Tooltip>
  );
}
