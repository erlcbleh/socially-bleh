import { useEffect, useMemo, useRef, useState } from "react";
import { LuCalendar, LuChevronLeft, LuChevronRight } from "react-icons/lu";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function monthGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function DateTimePicker({
  value,
  onChange,
  min,
  label = "Date and time",
}: {
  value: string;
  onChange: (next: string) => void;
  min?: Date;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => {
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }, [value]);

  const [cursor, setCursor] = useState(() => startOfMonth(selected ?? new Date()));

  useEffect(() => {
    if (selected) setCursor(startOfMonth(selected));
  }, [selected]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const days = useMemo(() => monthGrid(cursor), [cursor]);
  const today = new Date();

  const emit = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    onChange(new Date(date.getTime() - offset).toISOString().slice(0, 16));
  };

  const pickDay = (day: Date) => {
    const next = new Date(day);
    next.setHours(selected ? selected.getHours() : 12, selected ? selected.getMinutes() : 0, 0, 0);
    emit(next);
  };

  const setTime = (raw: string) => {
    const [hours, minutes] = raw.split(":").map(Number);
    const next = new Date(selected ?? new Date());
    next.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
    emit(next);
  };

  const display = selected
    ? `${selected.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}, ${pad(selected.getHours())}:${pad(selected.getMinutes())}`
    : "Pick a date";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        className="flex w-full items-center gap-2 rounded-lg border border-panel-border bg-transparent px-3 py-2 text-[13px] text-neutral-100 transition-colors hover:border-white/30 focus:border-white/40"
      >
        <LuCalendar className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <span className={selected ? "" : "text-neutral-500"}>{display}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-full z-50 mt-2 w-[286px] rounded-2xl border border-white/15 bg-[rgba(18,18,18,0.92)] p-3 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              aria-label="Previous month"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LuChevronLeft className="h-4 w-4" />
            </button>

            <span className="flex-1 text-center text-[13px] font-medium text-white">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>

            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              aria-label="Next month"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LuChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="py-1 text-center text-[11px] text-neutral-500">
                {weekday}
              </span>
            ))}

            {days.map((day) => {
              const outside = day.getMonth() !== cursor.getMonth();
              const isSelected = selected ? sameDay(day, selected) : false;
              const isToday = sameDay(day, today);
              const blocked = min ? day < new Date(min.getFullYear(), min.getMonth(), min.getDate()) : false;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={blocked}
                  onClick={() => pickDay(day)}
                  className={`relative h-8 rounded-lg text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                    isSelected
                      ? "bg-white font-semibold text-black"
                      : outside
                        ? "text-neutral-600 hover:bg-white/[0.06] hover:text-neutral-300"
                        : "text-neutral-200 hover:bg-white/10"
                  }`}
                >
                  {day.getDate()}
                  {isToday && !isSelected ? (
                    <span className="absolute bottom-1 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
            <label className="text-[12px] text-neutral-400" htmlFor="picker-time">
              Time
            </label>
            <input
              id="picker-time"
              type="time"
              value={selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : "12:00"}
              onChange={(event) => setTime(event.target.value)}
              className="ml-auto rounded-lg border border-white/15 bg-transparent px-2.5 py-1 text-[13px] text-white outline-none focus:border-white/40"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-black transition-colors hover:bg-neutral-200"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
