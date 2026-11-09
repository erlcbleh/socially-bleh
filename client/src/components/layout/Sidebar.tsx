import { useLayoutEffect, useRef, useState } from "react";
import { communityPath, communitySettingsPath, profilePath } from "../../lib/communityPath";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  LuHouse,
  LuSearch,
  LuBell,
  LuMail,
  LuBookmark,
  LuUser,
  LuChartBar,
  LuSettings,
  LuShield,
  LuPlus,
  LuSettings2,
} from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useCommunity } from "../../lib/communityContext";
import { useNavCommunitySlug } from "../../hooks/useCommunitySlug";
import { useMyCommunities } from "../../hooks/useCommunities";
import { useTheme } from "../../lib/themeContext";
import { useCompose } from "../post/ComposeContext";
import { colorForCommunity } from "../../lib/communityColor";
import { useUnreadCount } from "../../hooks/useNotifications";
import { useMessagesUnreadCount } from "../../hooks/useMessages";
import { AccountMenu } from "./AccountMenu";
import { GlobalCommunityMark } from "../shared/GlobalCommunityMark";

function NavItem({ to, icon: Icon, label, badge, end }: { to: string; icon: IconType; label: string; badge?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex items-center gap-4 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
          isActive
            ? "font-medium text-brand"
            : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
        }`
      }
    >
      <span className="relative">
        <Icon className="h-5 w-5" />
        {!!badge && (
          <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

import { LuChevronDown, LuCheck, LuPin } from "react-icons/lu";

export function CommunityDropdown({ compact }: { compact?: boolean }) {
  const slug = useNavCommunitySlug();
  const navigate = useNavigate();
  const { data } = useMyCommunities();
  const rawCommunities = data?.communities ?? [];
  const [open, setOpen] = useState(false);
  const [pinnedSlugs, setPinnedSlugs] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("socially_pinned_communities");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const togglePin = (e: React.MouseEvent, communitySlug: string) => {
    e.stopPropagation();
    setPinnedSlugs((prev) => {
      const next = prev.includes(communitySlug)
        ? prev.filter((s) => s !== communitySlug)
        : [...prev, communitySlug];
      try {
        localStorage.setItem("socially_pinned_communities", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const sortedCommunities = [...rawCommunities].sort((a, b) => {
    if (a.isGlobal || a.slug === "global") return -1;
    if (b.isGlobal || b.slug === "global") return 1;
    const aPinned = pinnedSlugs.includes(a.slug);
    const bPinned = pinnedSlugs.includes(b.slug);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return a.name.localeCompare(b.name);
  });

  const currentCommunity = sortedCommunities.find((c) => c.slug === slug) || sortedCommunities[0];

  const switchTo = (targetSlug: string) => {
    setOpen(false);
    if (targetSlug === slug) return;
    navigate(communityPath(targetSlug));
  };

  return (
    <div className={`relative ${compact ? "" : "mb-3 border-b border-neutral-100 pb-3 dark:border-neutral-900"}`}>
      <button
        onClick={() => setOpen((v: boolean) => !v)}
        aria-label="Select community"
        className={`flex items-center gap-1 rounded-full transition ${
          compact
            ? "p-1 hover:bg-neutral-100 dark:hover:bg-neutral-900"
            : "w-full justify-between rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-900"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white">
            {currentCommunity?.isGlobal ? (
              <GlobalCommunityMark className="h-4 w-4" />
            ) : currentCommunity?.logoUrl ? (
              <img src={currentCommunity.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className={`h-full w-full ${currentCommunity ? colorForCommunity(currentCommunity.id) : ""}`} />
            )}
          </div>
          {!compact && (
            <span className="truncate text-sm font-medium text-neutral-900 dark:text-white">
              {currentCommunity?.name || "Select Community"}
            </span>
          )}
        </div>
        <LuChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={`z-40 max-h-72 flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-black ${
              compact ? "fixed left-4 right-4 top-14" : "absolute left-0 right-0 top-full mt-1"
            }`}
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {sortedCommunities.map((c) => {
                const isSelected = c.slug === slug;
                const isPinned = pinnedSlugs.includes(c.slug);
                const isGlobal = c.isGlobal || c.slug === "global";

                return (
                  <div
                    key={c.id}
                    onClick={() => switchTo(c.slug)}
                    className="group flex w-full cursor-pointer items-center justify-between gap-2.5 px-4 py-2.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-xs font-medium dark:bg-neutral-900">
                        {c.isGlobal ? (
                          <GlobalCommunityMark className="h-3.5 w-3.5" />
                        ) : c.logoUrl ? (
                          <img src={c.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className={`h-full w-full ${colorForCommunity(c.id)}`} />
                        )}
                      </div>
                      <span className={`truncate text-sm ${isSelected ? "font-medium text-brand" : "text-neutral-700 dark:text-neutral-300"}`}>
                        {c.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!isGlobal && (
                        <button
                          type="button"
                          onClick={(e) => togglePin(e, c.slug)}
                          title={isPinned ? "Unpin community" : "Pin community"}
                          className={`rounded p-1 transition-opacity ${
                            isPinned
                              ? "text-brand opacity-100 hover:text-brand-dark"
                              : "text-neutral-400 opacity-0 hover:text-neutral-600 dark:hover:text-neutral-200 group-hover:opacity-100"
                          }`}
                        >
                          <LuPin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
                        </button>
                      )}
                      {isSelected && <LuCheck className="h-4 w-4 shrink-0 text-brand" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-neutral-100 dark:border-neutral-900">
              <Link
                to="/communities"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
              >
                <LuPlus className="h-4 w-4 text-brand" />
                <span>Explore Communities</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type NavIndicator = { top: number; height: number } | null;

let lastNavIndicator: NavIndicator = null;

export function Sidebar() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { community, isStaff, canManageCommunity } = useCommunity();
  const slug = useNavCommunitySlug();
  const { openCompose } = useCompose();
  const { data: notifData } = useUnreadCount();
  const { data: msgData } = useMessagesUnreadCount();
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const [indicator, setIndicator] = useState<NavIndicator>(() => lastNavIndicator);
  const hasMounted = useRef(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = () => {
      const active = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      lastNavIndicator = active ? { top: active.offsetTop, height: active.offsetHeight } : null;
      setIndicator(lastNavIndicator);
    };

    let frame = 0;
    const resumingFromRemount = !hasMounted.current && !!lastNavIndicator;
    if (resumingFromRemount) {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(measure);
      });
    } else {
      measure();
    }
    hasMounted.current = true;

    let ignoreInitialObservation = true;
    const observer = new ResizeObserver(() => {
      if (ignoreInitialObservation) {
        ignoreInitialObservation = false;
        return;
      }
      measure();
    });
    observer.observe(nav);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  if (!user) return null;

  return (
    <div className="sticky top-0 flex h-[calc(100svh_-_var(--legal-banner-h,0px))] flex-col justify-between p-3">
      <div>
        <CommunityDropdown />
        <Link to={slug ? communityPath(slug) : "/communities"} className="mb-4 inline-flex items-center gap-2 px-1 py-2">
          <img src={theme === "dark" ? "/wordmark-white.svg" : "/wordmark-black.svg"} alt="Socially" className="h-8" />
        </Link>

        <nav ref={navRef} className="relative flex flex-col gap-1">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 rounded-lg bg-brand/10 transition-[transform,height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              transform: `translateY(${indicator?.top ?? 0}px)`,
              height: indicator?.height ?? 0,
              opacity: indicator ? 1 : 0,
            }}
          />
          <NavItem to={slug ? communityPath(slug) : "/communities"} icon={LuHouse} label="Home" end />
          {slug && (
            <>
              <NavItem to={communityPath(slug, `explore`)} icon={LuSearch} label="Explore" />
              <NavItem to={communityPath(slug, `notifications`)} icon={LuBell} label="Notifications" badge={notifData?.count} />
              <NavItem to={communityPath(slug, `messages`)} icon={LuMail} label="Messages" badge={msgData?.count} />
              <NavItem to={communityPath(slug, `bookmarks`)} icon={LuBookmark} label="Bookmarks" />
              <NavItem to={profilePath(user.username)} icon={LuUser} label="Profile" />
              {community?.myProfessionalStatus === "approved" && (
                <NavItem to={communityPath(slug, `analytics`)} icon={LuChartBar} label="Analytics" />
              )}
              {canManageCommunity && (
                <NavItem to={communitySettingsPath(slug)} icon={LuSettings2} label="Community Settings" />
              )}
            </>
          )}
          <NavItem to="/settings" icon={LuSettings} label="Settings" />
          {slug && isStaff && (
            <NavItem to={communityPath(slug, `staff`)} icon={LuShield} label="Community Staff" />
          )}
        </nav>

        {slug && (
          <button
            onClick={() => openCompose()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark"
          >
            <LuPlus className="h-5 w-5" />
            <span>Create Post</span>
          </button>
        )}
      </div>

      <AccountMenu />
    </div>
  );
}
