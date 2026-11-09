import { communityPath, profilePath } from "../../lib/communityPath";
import { NavLink } from "react-router-dom";
import type { IconType } from "react-icons";
import { LuHouse, LuSearch, LuBell, LuMail, LuUser, LuPlus, LuSettings } from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useCompose } from "../post/ComposeContext";
import { useUnreadCount } from "../../hooks/useNotifications";
import { useMessagesUnreadCount } from "../../hooks/useMessages";
import { useNavCommunitySlug } from "../../hooks/useCommunitySlug";

function TabItem({ to, icon: Icon, label, badge, end }: { to: string; icon: IconType; label: string; badge?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        `flex flex-1 items-center justify-center py-3 ${isActive ? "text-brand" : "text-neutral-500 dark:text-neutral-400"}`
      }
    >
      <span className="relative">
        <Icon className="h-6 w-6" />
        {!!badge && (
          <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-medium text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
    </NavLink>
  );
}

export function BottomNav() {
  const { user } = useAuth();
  const slug = useNavCommunitySlug();
  const { openCompose } = useCompose();
  const { data: notifData } = useUnreadCount();
  const { data: msgData } = useMessagesUnreadCount();

  if (!user) return null;

  return (
    <div className="relative z-30 shrink-0 touch-none overscroll-none sm:hidden">
      <nav className="flex border-t border-neutral-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-black/95">
        <TabItem to={slug ? communityPath(slug) : "/communities"} icon={LuHouse} label="Home" end />
        {slug && (
          <>
            <TabItem to={communityPath(slug, `explore`)} icon={LuSearch} label="Explore" />
            <TabItem to={communityPath(slug, `notifications`)} icon={LuBell} label="Notifications" badge={notifData?.count} />
            <button
              onClick={() => openCompose()}
              aria-label="Create post"
              className="flex flex-1 items-center justify-center py-3 text-neutral-500 dark:text-neutral-400"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white">
                <LuPlus className="h-5 w-5" />
              </span>
            </button>
            <TabItem to={communityPath(slug, `messages`)} icon={LuMail} label="Messages" badge={msgData?.count} />
            <TabItem to={profilePath(user.username)} icon={LuUser} label="Profile" />
          </>
        )}
        <TabItem to="/settings" icon={LuSettings} label="Settings" />
      </nav>
    </div>
  );
}
