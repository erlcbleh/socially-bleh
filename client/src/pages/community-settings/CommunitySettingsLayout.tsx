import { communitySettingsPath } from "../../lib/communityPath";
import { NavLink, Outlet } from "react-router-dom";
import { useCommunity } from "../../lib/communityContext";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";

export default function CommunitySettingsLayout() {
  const slug = useCommunitySlug();
  const { community, isOwner } = useCommunity();

  const tabs = [
    { to: communitySettingsPath(slug), label: "General", end: true },
    ...(isOwner ? [{ to: communitySettingsPath(slug, "staff"), label: "Staff" }] : []),
  ];

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white/80 p-3 backdrop-blur dark:bg-black/80">
        <h1 className="text-xl font-medium">{community?.name || "Community"} settings</h1>
      </div>

      <div className="flex gap-1 overflow-x-auto p-2 dark:border-neutral-800">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                isActive
                  ? "bg-brand text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="p-4">
        <Outlet />
      </div>
    </div>
  );
}
