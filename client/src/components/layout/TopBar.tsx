import { communityPath, profilePath } from "../../lib/communityPath";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { useQuery } from "../../lib/queryStore";
import { LuSearch } from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useNavCommunitySlug } from "../../hooks/useCommunitySlug";
import { Avatar } from "../shared/Avatar";
import { AccountMenu } from "./AccountMenu";
import { api } from "../../lib/api";
import type { User } from "../../types";

import { CommunityDropdown } from "./Sidebar";

export function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const slug = useNavCommunitySlug();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) {
      setQuery(q);
    } else if (!location.pathname.endsWith("/explore")) {
      setQuery("");
      setOpen(false);
    }
  }, [searchParams, location.pathname]);

  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  const { data } = useQuery({
    queryKey: ["topSearch", debouncedQuery, slug],
    queryFn: () => api.get<{ users: User[] }>(`/communities/${slug}/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: !!debouncedQuery && !!slug,
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!user) return null;

  const goToExplore = () => {
    if (!slug) return;
    setOpen(false);
    navigate(communityPath(slug, `explore?q=${encodeURIComponent(query.trim())}`));
  };

  return (
    <div className="sticky top-0 z-20 bg-white/80 backdrop-blur dark:bg-black/80">
      <div className="px-3 sm:px-4">
        <div className="flex items-center gap-2 border-b border-neutral-100 py-2.5 dark:border-neutral-800">
          <div className="flex shrink-0 items-center gap-1 sm:hidden">
            <AccountMenu compact />
            <CommunityDropdown compact />
          </div>
          <div className="relative w-full flex-1">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                goToExplore();
              }}
            >
              <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-900 sm:rounded-lg sm:py-2">
                <LuSearch className="h-4 w-4 shrink-0 text-neutral-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => query.trim() && setOpen(true)}
                  placeholder="Search Socially..."
                  className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-neutral-400 sm:text-sm"
                />
                <kbd className="hidden shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:border-neutral-700 sm:block">
                  ⌘K
                </kbd>
              </div>
            </form>

            {open && query.trim() && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                  {data?.users.length === 0 && (
                    <p className="px-4 py-3 text-sm text-neutral-400">No matching people</p>
                  )}
                  {data?.users.map((u) => (
                    <Link
                      key={u.id}
                      to={profilePath(u.username)}
                      onClick={() => setOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      <Avatar user={u} size={8} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{u.displayName}</p>
                        <p className="truncate text-xs text-neutral-500">@{u.username}</p>
                      </div>
                    </Link>
                  ))}
                  <button
                    onClick={goToExplore}
                    className="block w-full border-t border-neutral-100 px-4 py-2.5 text-left text-sm font-medium text-black dark:text-white hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                  >
                    Search for "{query.trim()}"
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
