import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/settings", label: "Account", end: true },
  { to: "/settings/privacy", label: "Privacy" },
  { to: "/settings/business", label: "Business" },
  { to: "/settings/verification", label: "Verification" },
  { to: "/settings/misc", label: "Miscellaneous" },
];

export default function SettingsLayout() {
  return (
    <div>
      <div className="sticky top-0 z-10 bg-white/80 p-3 backdrop-blur dark:bg-black/80">
        <h1 className="text-xl font-medium">Settings</h1>
      </div>

      <div className="flex gap-1 overflow-x-auto p-2 dark:border-neutral-800">
        {TABS.map((tab) => (
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
