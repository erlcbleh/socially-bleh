import { STAFF_PANEL_URL } from "../../lib/links";
import { communityPath } from "../../lib/communityPath";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "../../lib/queryStore";
import { LuEllipsis, LuLogOut, LuSettings, LuChartBar, LuShield, LuUsers, LuCheck } from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useCommunity } from "../../lib/communityContext";
import { useNavCommunitySlug } from "../../hooks/useCommunitySlug";
import { useLinkedAccounts, useSwitchAccount } from "../../hooks/useAccounts";
import { hasPermission } from "../../config/roles.config";
import { Avatar } from "../shared/Avatar";
import { api } from "../../lib/api";
import { disableGuestMode } from "../../lib/guestMode";

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, refetch } = useAuth();
  const { community, isStaff } = useCommunity();
  const slug = useNavCommunitySlug();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: accountsData } = useLinkedAccounts(menuOpen);
  const switchAccountMutation = useSwitchAccount();

  if (!user) return null;

  const logout = async () => {
    await api.post("/auth/logout");
    disableGuestMode();
    queryClient.clear();
    refetch();
    navigate("/");
  };

  const handleSwitch = (targetUserId: string) => {
    switchAccountMutation.mutate(targetUserId, {
      onSuccess: () => {
        setMenuOpen(false);
        queryClient.clear();
        refetch();
        navigate("/");
      },
    });
  };

  const accounts = accountsData?.accounts || [];
  const isGlobalStaff = hasPermission(user.role, "access_staff_panel");
  const isBusiness = user.accountKind === "business";

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Account menu"
        className={
          compact
            ? "flex items-center rounded-full"
            : "flex w-full items-center justify-between rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-900"
        }
      >
        {compact ? (
          <Avatar user={user} size={8} />
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar user={user} size={9} />
              <div className="min-w-0">
                <p className="truncate text-left text-sm font-medium">{user.displayName}</p>
                <p className="truncate text-left text-sm text-neutral-500">@{user.username}</p>
              </div>
            </div>
            <LuEllipsis className="h-4 w-4 shrink-0 text-neutral-500" />
          </>
        )}
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div
            className={`absolute z-40 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900 ${
              compact ? "left-0 top-full mt-2" : "bottom-full left-0 mb-2"
            }`}
          >
            {accounts.length > 1 && (
              <div className="border-b border-neutral-100 dark:border-neutral-800">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSwitch(a.id)}
                    disabled={switchAccountMutation.isPending}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-neutral-50 disabled:opacity-40 dark:hover:bg-neutral-800"
                  >
                    <Avatar user={{ avatarUrl: a.avatarUrl, displayName: a.displayName }} size={7} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.displayName}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {a.accountKind === "business"
                          ? "Business"
                          : "Personal"}
                      </p>
                    </div>
                    {a.id === user.id && <LuCheck className="h-4 w-4 shrink-0 text-brand" />}
                  </button>
                ))}
              </div>
            )}

            {(isBusiness || isStaff || isGlobalStaff) && (
              <div className="border-b border-neutral-100 dark:border-neutral-800">
                {isBusiness && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(communityPath(slug, `analytics`));
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <LuChartBar className="h-4 w-4" /> Analytics
                  </button>
                )}
                {isStaff && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(communityPath(slug, `staff`));
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <LuShield className="h-4 w-4" /> Community Staff
                  </button>
                )}
                {isGlobalStaff && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      window.location.href = STAFF_PANEL_URL;
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <LuShield className="h-4 w-4" /> Socially Staff
                  </button>
                )}
              </div>
            )}

            {user.accountKind !== "professional" && user.accountKind !== "business" && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/communities");
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <LuUsers className="h-4 w-4" /> Communities
              </button>
            )}
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate("/settings");
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <LuSettings className="h-4 w-4" /> Settings
            </button>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-neutral-50 dark:text-red-400 dark:hover:bg-neutral-800"
            >
              <LuLogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
