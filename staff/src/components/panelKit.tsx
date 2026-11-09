import { createContext, useContext, type ReactNode } from "react";

export type PanelDensity = "compact" | "comfortable";

const DensityContext = createContext<PanelDensity>("compact");

export function PanelDensityProvider({
  value,
  children,
}: {
  value: PanelDensity;
  children: ReactNode;
}) {
  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function usePanelDensity(): PanelDensity {
  return useContext(DensityContext);
}

function pick<T>(density: PanelDensity, compact: T, comfortable: T): T {
  return density === "comfortable" ? comfortable : compact;
}

export function PanelShell({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col bg-panel-bg">{children}</div>;
}

export function PanelToolbar({ children }: { children: ReactNode }) {
  const density = usePanelDensity();

  return (
    <div
      className={`flex shrink-0 flex-wrap items-center border-b border-panel-border ${pick(
        density,
        "gap-1.5 px-3 py-2.5",
        "gap-2.5 px-5 py-3.5"
      )}`}
    >
      {children}
    </div>
  );
}

export function PanelTitle({ children }: { children: ReactNode }) {
  const density = usePanelDensity();
  return (
    <span className={`font-bold text-white ${pick(density, "text-[12px]", "text-[15px]")}`}>
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const density = usePanelDensity();
  return (
    <div className={`font-semibold text-neutral-500 ${pick(density, "text-[12px]", "text-[13px]")}`}>
      {children}
    </div>
  );
}

export function PanelScroll({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[] | readonly { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  const density = usePanelDensity();
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option as T, label: option } : option
  );

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-panel-border p-0.5">
      {normalized.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-full font-semibold transition-colors ${pick(
            density,
            "px-3 py-1 text-[12px]",
            "px-4 py-1.5 text-[13px]"
          )} ${
            value === option.value
              ? "bg-white text-black"
              : "text-neutral-500 hover:bg-white/10 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  label,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  label?: string;
  type?: string;
  className?: string;
}) {
  const density = usePanelDensity();

  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      className={`rounded-lg border border-panel-border bg-transparent text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/40 ${pick(
        density,
        "px-3 py-1.5 text-sm",
        "px-3.5 py-2.5 text-[15px]"
      )} ${className}`}
    />
  );
}

export function ActionButton({
  children,
  onClick,
  tone = "neutral",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "neutral" | "danger" | "primary";
  disabled?: boolean;
  title?: string;
}) {
  const density = usePanelDensity();

  const tones = {
    neutral: "border border-panel-border text-neutral-300 hover:border-white/40 hover:text-white",
    danger: "border border-severity-high/40 text-severity-high hover:border-severity-high hover:bg-severity-high/10",
    primary: "border border-white bg-white text-black hover:bg-neutral-200",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${pick(
        density,
        "px-3 py-1.5 text-[13px]",
        "px-4 py-2 text-sm"
      )} ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyLabel,
}: {
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
  emptyLabel: string;
}) {
  const density = usePanelDensity();
  const box = pick(density, "p-4 text-sm", "p-7 text-[15px]");

  if (error) {
    return (
      <div
        className={`rounded-lg border border-severity-high/40 bg-severity-high/5 text-severity-high ${pick(
          density,
          "m-3 px-3.5 py-2.5 text-sm",
          "m-5 px-5 py-3.5 text-[15px]"
        )}`}
      >
        {error.message}
      </div>
    );
  }
  if (isLoading) return <div className={`text-neutral-500 ${box}`}>Loading…</div>;
  if (isEmpty) return <div className={`text-neutral-500 ${box}`}>{emptyLabel}</div>;
  return null;
}

export function Row({
  children,
  onClick,
  selected,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  const density = usePanelDensity();

  const className = `flex w-full flex-col border-b border-white/[0.09] border-l-2 text-left transition-colors ${pick(
    density,
    "gap-1 px-3.5 py-2.5",
    "gap-1.5 px-5 py-4"
  )} ${
    selected
      ? "border-l-white bg-white/[0.07]"
      : `border-l-transparent ${onClick ? "hover:border-l-white/30 hover:bg-white/[0.04]" : ""}`
  }`;

  if (!onClick) return <div className={className}>{children}</div>;
  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function Meta({ children }: { children: ReactNode }) {
  const density = usePanelDensity();
  return (
    <div
      className={`flex flex-wrap items-center text-neutral-500 ${pick(
        density,
        "gap-2 text-[13px]",
        "gap-3 text-sm"
      )}`}
    >
      {children}
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "high" | "medium" | "low";
}) {
  const density = usePanelDensity();

  const tones = {
    neutral: "border-white/15 text-neutral-400",
    high: "border-severity-high/50 text-severity-high",
    medium: "border-white/45 text-white",
    low: "border-white/10 text-neutral-500",
  };

  return (
    <span
      className={`shrink-0 rounded-full border font-semibold ${pick(
        density,
        "px-2.5 py-[1px] text-[11px]",
        "px-3 py-[3px] text-[12px]"
      )} ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const density = usePanelDensity();

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`font-semibold text-neutral-500 ${pick(density, "text-[12px]", "text-[13px]")}`}>
        {label}
      </span>
      <span className={`break-words text-neutral-200 ${pick(density, "text-sm", "text-[15px]")}`}>
        {children}
      </span>
    </div>
  );
}

export function LoadMore({ onClick }: { onClick: () => void }) {
  const density = usePanelDensity();

  return (
    <button
      onClick={onClick}
      className={`rounded-full border border-panel-border text-neutral-400 transition-colors hover:border-white/40 hover:text-white ${pick(
        density,
        "m-3 px-3.5 py-2 text-[13px]",
        "m-5 px-4 py-2.5 text-sm"
      )}`}
    >
      Load more
    </button>
  );
}
