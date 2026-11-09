import { LuCheck, LuMinus } from "react-icons/lu";

export function Checkbox({
  checked,
  onChange,
  label,
  indeterminate = false,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const on = checked || indeterminate;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on
          ? "border-white bg-white text-black"
          : "border-white/25 bg-transparent text-transparent hover:border-white/60 hover:bg-white/[0.06]"
      } ${className}`}
    >
      {indeterminate ? (
        <LuMinus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      ) : (
        <LuCheck
          className={`h-3.5 w-3.5 transition-opacity ${checked ? "opacity-100" : "opacity-0"}`}
          strokeWidth={3}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
