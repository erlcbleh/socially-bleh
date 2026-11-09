import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { LuSearch, LuX } from "react-icons/lu";
import { useQuery } from "@socially/shared/queryStore";
import { Avatar } from "@socially/shared/components/Avatar";
import { api } from "../lib/api";
import type { UserLookupResult } from "../types";

const INACTIVE_STATUS = new Set(["suspended", "banned", "deactivated"]);
const LIST_MAX_HEIGHT = 256;
const GAP = 4;

interface Anchor {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

export function UserPicker({
  value,
  onChange,
  placeholder = "Search accounts",
  label = "Search accounts",
  variant = "field",
  className = "",
}: {
  value: UserLookupResult | null;
  onChange: (user: UserLookupResult | null) => void;
  placeholder?: string;
  label?: string;
  variant?: "field" | "search";
  className?: string;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const fieldRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useRef(`user-picker-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => setCursor(0), [query]);

  const search = useQuery<{ users: UserLookupResult[] }>({
    queryKey: ["staff", "user-picker", query],
    queryFn: () => api.get<{ users: UserLookupResult[] }>(`/users?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });

  const results = query ? search.data?.users ?? [] : [];
  const expanded = open && query.length > 0;

  const measure = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;

    const rect = field.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < LIST_MAX_HEIGHT && rect.top > spaceBelow;

    setAnchor({
      left: rect.left,
      width: rect.width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    });
  }, []);

  useLayoutEffect(() => {
    if (expanded) measure();
  }, [expanded, measure, results.length]);

  useEffect(() => {
    if (!expanded) return;

    const reposition = () => measure();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [expanded, measure]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fieldRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const choose = (user: UserLookupResult) => {
    onChange(user);
    setInput("");
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!expanded || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[cursor]);
    }
  };

  if (value) {
    return (
      <div
        className={`flex min-w-0 items-center gap-2 rounded-full border border-white/25 bg-white/[0.06] py-1 pl-1 pr-1.5 ${className}`}
      >
        <Avatar user={value} size={6} />
        <span className="truncate text-[13px] font-medium text-neutral-100">@{value.username}</span>
        {value.role && value.role !== "user" ? (
          <span className="shrink-0 text-[11px] font-semibold text-neutral-500">{value.role}</span>
        ) : null}
        <button
          type="button"
          onClick={() => onChange(null)}
          title={`Clear @${value.username}`}
          aria-label={`Clear @${value.username}`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/15 hover:text-white"
        >
          <LuX className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const field = (
    <input
      type="text"
      role="combobox"
      aria-expanded={expanded}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={expanded && results.length ? `${listId}-${cursor}` : undefined}
      aria-label={label}
      autoComplete="off"
      value={input}
      placeholder={placeholder}
      onChange={(event) => {
        setInput(event.target.value);
        setOpen(true);
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      className={
        variant === "search"
          ? "w-full min-w-0 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
          : "w-full rounded-lg border border-panel-border bg-transparent px-3 py-1.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/40"
      }
    />
  );

  return (
    <div ref={fieldRef} className={`min-w-0 ${className}`}>
      {variant === "search" ? (
        <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-panel-border px-3 py-1.5 focus-within:border-white/40">
          <LuSearch className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          {field}
        </div>
      ) : (
        field
      )}

      {expanded && anchor
        ? createPortal(
            <div
              ref={listRef}
              style={{ position: "fixed", left: anchor.left, width: anchor.width, top: anchor.top, bottom: anchor.bottom }}
              className="z-[60] overflow-hidden rounded-squircle border border-white/20 bg-panel-raised shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)]"
            >
              {search.isLoading ? (
                <p className="px-3 py-2.5 text-[13px] text-neutral-500">Searching…</p>
              ) : search.error ? (
                <p className="px-3 py-2.5 text-[13px] text-severity-high">{search.error.message}</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2.5 text-[13px] text-neutral-500">No account matches “{query}”.</p>
              ) : (
                <ul
                  id={listId}
                  role="listbox"
                  aria-label="Matching accounts"
                  style={{ maxHeight: LIST_MAX_HEIGHT }}
                  className="overflow-y-auto"
                >
                  {results.map((user, index) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === cursor}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => choose(user)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                          index === cursor ? "bg-white/[0.09]" : "hover:bg-panel-hover"
                        }`}
                      >
                        <Avatar user={user} size={7} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-neutral-100">
                            @{user.username}
                          </span>
                          <span className="block truncate text-[12px] text-neutral-500">
                            {user.displayName}
                          </span>
                        </span>
                        {user.status && INACTIVE_STATUS.has(user.status) ? (
                          <span className="shrink-0 text-[11px] font-semibold text-severity-high">
                            {user.status}
                          </span>
                        ) : user.role && user.role !== "user" ? (
                          <span className="shrink-0 text-[11px] font-semibold text-neutral-400">
                            {user.role}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
