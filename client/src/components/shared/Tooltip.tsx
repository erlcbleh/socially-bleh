import type { ReactNode } from "react";

export function Tooltip({
  text,
  children,
  position = "top",
  align = "center",
  multiline = false,
}: {
  text: string;
  children: ReactNode;
  position?: "top" | "bottom";
  align?: "left" | "right" | "center";
  multiline?: boolean;
}) {
  let alignClass = "left-1/2 -translate-x-1/2";
  if (align === "right") alignClass = "right-0 translate-x-0";
  if (align === "left") alignClass = "left-0 translate-x-0";

  const widthClass = multiline ? "w-max max-w-[15rem] leading-snug" : "whitespace-nowrap";

  return (
    <div className="group relative inline-flex items-center justify-center">
      {children}
      <div
        className={`pointer-events-none absolute z-[120] rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-black opacity-0 shadow-lg transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white ${widthClass} ${alignClass} ${
          position === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
