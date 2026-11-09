export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 focus:outline-none disabled:opacity-40 ${
        checked ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700"
      }`}
    >
      <span
        className={`h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
