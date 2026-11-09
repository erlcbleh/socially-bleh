import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "../../lib/queryStore";
import { LuCamera, LuX } from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useSwitchAccount } from "../../hooks/useAccounts";
import { useUploadMedia } from "../../hooks/useMediaUpload";
import { api } from "../../lib/api";
import { Avatar } from "../../components/shared/Avatar";
import { ImageCropModal } from "../../components/shared/ImageCropModal";
import { useConfirm } from "../../components/shared/ConfirmDialog";
import FlickerSpinner from "../../components/shared/FlickerSpinner";
import type { User } from "../../types";

interface DiscordServerInfo {
  inviteUrl: string;
  guildId: string | null;
  guildName: string;
  guildIconUrl: string;
  memberCount: number;
  presenceCount: number;
  checkedAt?: string | null;
}

interface BusinessRequirement {
  id: string;
  label: string;
}

interface BusinessApplication {
  id: string;
  name: string;
  bio: string;
  logoUrl: string;
  bannerUrl: string;
  status: "pending" | "approved" | "rejected";
  staffNote: string;
  businessUserId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  discord: DiscordServerInfo;
  guidelinesAcceptedAt: string | null;
}

interface BusinessStatusResponse {
  application: BusinessApplication | null;
  businesses: BusinessSummary[];
  minMembers: number;
  requirements: BusinessRequirement[];
}

interface BusinessSummary {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string;
  bannerUrl: string;
  bio: string;
}

interface CollaboratorRow {
  id: string;
  role: string;
  createdAt: string;
  user: User;
}

function InviteGate({
  minMembers,
  requirements,
  onVerified,
}: {
  minMembers: number;
  requirements: BusinessRequirement[];
  onVerified: (invite: string, server: DiscordServerInfo) => void;
}) {
  const [invite, setInvite] = useState("");

  const check = useMutation({
    mutationFn: () =>
      api.post<{ discord: DiscordServerInfo }>("/business/check-invite", { discordInvite: invite.trim() }),
    onSuccess: (data) => onVerified(invite.trim(), data.discord),
  });

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div>
        <h4 className="text-sm font-medium text-black dark:text-white">Start with your Discord invite</h4>
        <p className="mt-1 text-sm text-neutral-500">
          Business accounts are for ERLC communities. Paste a permanent invite to your server and we&apos;ll check
          it against the requirements before you fill anything else in.
        </p>
      </div>

      <ul className="space-y-1.5 text-sm text-neutral-500">
        <li>&bull; Related to ERLC content</li>
        <li>&bull; At least {minMembers} members (we check this from your invite)</li>
        {requirements
          .filter((r) => r.id !== "erlcRelated")
          .map((r) => (
            <li key={r.id}>&bull; {r.label}</li>
          ))}
      </ul>

      <Link to="/business-guidelines" className="inline-block text-sm text-brand hover:underline">
        Read the Business Guidelines
      </Link>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Discord invite link
        </label>
        <input
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
          placeholder="https://discord.gg/yourserver"
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Use an invite set to never expire, with unlimited uses.
        </p>
      </div>

      {check.isError && <p className="text-sm text-red-500">{(check.error as Error).message}</p>}

      <button
        type="button"
        onClick={() => check.mutate()}
        disabled={check.isPending || invite.trim().length < 4}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {check.isPending ? "Checking server…" : "Verify server"}
      </button>
    </div>
  );
}

function ApplyForm({
  minMembers,
  requirements,
  onSubmitted,
}: {
  minMembers: number;
  requirements: BusinessRequirement[];
  onSubmitted: () => void;
}) {
  const [invite, setInvite] = useState("");
  const [server, setServer] = useState<DiscordServerInfo | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const uploadLogo = useUploadMedia();
  const uploadBanner = useUploadMedia();
  const [pendingCropFile, setPendingCropFile] = useState<{ file: File; aspect: "circle" | "banner"; target: "logo" | "banner" } | null>(null);

  const allConfirmed = requirements.length > 0 && requirements.every((r) => checked[r.id]);

  const apply = useMutation({
    mutationFn: () =>
      api.post<{ application: BusinessApplication }>("/business/apply", {
        discordInvite: invite,
        requirements: checked,
        name: name.trim(),
        bio: bio.trim(),
        logoUrl,
        bannerUrl,
      }),
    onSuccess: () => onSubmitted(),
  });

  if (!server) {
    return (
      <InviteGate
        minMembers={minMembers}
        requirements={requirements}
        onVerified={(verifiedInvite, verifiedServer) => {
          setInvite(verifiedInvite);
          setServer(verifiedServer);
        }}
      />
    );
  }

  const handleCroppedComplete = (croppedFile: File) => {
    if (!pendingCropFile) return;
    if (pendingCropFile.target === "logo") {
      uploadLogo.mutate(croppedFile, { onSuccess: (data) => setLogoUrl(data.url) });
    } else {
      uploadBanner.mutate(croppedFile, { onSuccess: (data) => setBannerUrl(data.url) });
    }
    setPendingCropFile(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          {server.guildIconUrl ? (
            <img src={server.guildIconUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-black dark:text-white">{server.guildName}</p>
            <p className="text-xs text-neutral-500">
              {server.memberCount.toLocaleString()} members &middot; {server.presenceCount.toLocaleString()} online
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setServer(null);
              setChecked({});
            }}
            className="shrink-0 text-xs text-neutral-500 underline underline-offset-2 hover:text-brand"
          >
            Change server
          </button>
        </div>
        <p className="mt-2 text-xs text-green-600 dark:text-green-500">
          Verified. Server meets the {minMembers}-member requirement.
        </p>

        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Confirm each requirement
          </p>
          {requirements.map((requirement) => (
            <label key={requirement.id} className="flex cursor-pointer items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={!!checked[requirement.id]}
                onChange={(e) => setChecked((current) => ({ ...current, [requirement.id]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
              />
              <span>{requirement.label}</span>
            </label>
          ))}
          <p className="pt-1 text-xs text-neutral-400">
            Staff verify these during review.{" "}
            <Link to="/business-guidelines" className="text-brand hover:underline">
              Business Guidelines
            </Link>
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="relative h-28 bg-neutral-100 dark:bg-neutral-800">
        {bannerUrl ? <img src={bannerUrl} alt="" className="h-full w-full object-cover" /> : null}
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          disabled={uploadBanner.isPending}
          className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-40"
        >
          {uploadBanner.isPending ? "Uploading…" : "Banner"}
        </button>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setPendingCropFile({ file, aspect: "banner", target: "banner" });
          }}
        />
      </div>

      <div className="px-4 pb-4">
        <div className="relative -mt-10 w-fit">
          <div className="rounded-full border-4 border-white dark:border-black">
            <Avatar user={{ displayName: name || "Business", avatarUrl: logoUrl }} size={20} />
          </div>
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadLogo.isPending}
            className="absolute bottom-1 right-1 rounded-full bg-brand p-1.5 text-white hover:bg-brand-dark disabled:opacity-40"
            aria-label="Upload logo"
          >
            <LuCamera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setPendingCropFile({ file, aspect: "circle", target: "logo" });
            }}
          />
        </div>
        <p className="mt-2 text-sm text-neutral-500">Logo and banner are optional but recommended.</p>

        <label className="mb-1 mt-4 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Business name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder="Acme Co"
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />

        <label className="mb-1 mt-3 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={160}
          rows={3}
          placeholder="What does your business do?"
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
        <p className="mt-1 text-right text-xs text-neutral-400">{bio.length}/160</p>

        {apply.isError && <p className="mt-2 text-sm text-red-500">{(apply.error as Error).message}</p>}

        <button
          type="button"
          onClick={() => apply.mutate()}
          disabled={apply.isPending || name.trim().length < 2 || !allConfirmed}
          className="mt-2 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {apply.isPending ? "Submitting…" : "Apply"}
        </button>
        {!allConfirmed && (
          <p className="mt-2 text-xs text-neutral-400">Confirm every requirement above to submit.</p>
        )}

        <ImageCropModal
          open={!!pendingCropFile}
          imageFile={pendingCropFile?.file || null}
          aspect={pendingCropFile?.aspect}
          title={pendingCropFile?.target === "logo" ? "Edit Business Logo" : "Edit Banner"}
          onClose={() => setPendingCropFile(null)}
          onCropComplete={handleCroppedComplete}
        />
      </div>
      </div>
    </div>
  );
}

function CollaboratorManager() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["business", "collaborators"],
    queryFn: () => api.get<{ collaborators: CollaboratorRow[] }>("/business/collaborators"),
  });

  const { data: searchData } = useQuery({
    queryKey: ["business", "collaboratorSearch", debounced],
    queryFn: () => api.get<{ users: User[] }>(`/business/collaborators/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 1,
  });

  const add = useMutation({
    mutationFn: (username: string) => api.post("/business/collaborators", { username }),
    onSuccess: () => {
      setQuery("");
      queryClient.invalidateQueries({ queryKey: ["business", "collaborators"] });
    },
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.delete(`/business/collaborators/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business", "collaborators"] }),
  });

  const { confirm, dialog } = useConfirm(remove.isPending);
  const collaborators = data?.collaborators || [];
  const existingIds = new Set(collaborators.map((c) => c.user.id));

  return (
    <div className="space-y-4">
      {dialog}
      <div>
        <h3 className="font-medium">Collaborators</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Collaborators can switch into this business account and use it like you. Only you can manage this list.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Add by username
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search username…"
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
        {add.isError && <p className="mt-2 text-sm text-red-500">{(add.error as Error).message}</p>}
        {debounced.length >= 1 && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            {(searchData?.users || [])
              .filter((u) => !existingIds.has(u.id))
              .map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => add.mutate(u.username)}
                  disabled={add.isPending}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 disabled:opacity-40 dark:hover:bg-neutral-800"
                >
                  <Avatar user={u} size={7} />
                  <span className="min-w-0 truncate font-medium">{u.displayName}</span>
                  <span className="min-w-0 truncate text-neutral-500">@{u.username}</span>
                </button>
              ))}
            {searchData && searchData.users.filter((u) => !existingIds.has(u.id)).length === 0 && (
              <p className="px-3 py-2 text-sm text-neutral-500">No users found.</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="flex justify-center p-4">
            <FlickerSpinner />
          </div>
        )}
        {!isLoading && collaborators.length === 0 && (
          <p className="text-sm text-neutral-500">No collaborators yet.</p>
        )}
        {collaborators.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800"
          >
            <Avatar user={c.user} size={8} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.user.displayName}</p>
              <p className="truncate text-xs text-neutral-500">@{c.user.username}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                confirm({
                  title: `Remove @${c.user.username}?`,
                  description: "They will lose access to switch into this business account.",
                  confirmLabel: "Remove",
                  tone: "danger",
                  onConfirm: () => remove.mutate(c.user.id),
                })
              }
              disabled={remove.isPending}
              className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-800"
              aria-label={`Remove @${c.user.username}`}
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BusinessSettings() {
  const { user, refetch: refetchAuth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const switchAccountMutation = useSwitchAccount();
  const isBusiness = user?.accountKind === "business";
  const isOwner = !!user?.isBusinessOwner;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["business", "status"],
    queryFn: () => api.get<BusinessStatusResponse>("/business/status"),
    enabled: !isBusiness,
  });

  const deleteBizMutation = useMutation({
    mutationFn: (businessId: string) => api.delete(`/business/${businessId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "status"] });
      refetch();
    },
  });

  const cancelAppMutation = useMutation({
    mutationFn: (applicationId: string) => api.delete(`/business/application/${applicationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "status"] });
      refetch();
    },
  });

  const { confirm, dialog } = useConfirm(deleteBizMutation.isPending || cancelAppMutation.isPending);

  if (!user) return null;

  if (isBusiness) {
    if (!isOwner) {
      return (
        <div className="max-w-lg space-y-2">
          <h3 className="font-medium">Business account</h3>
          <p className="text-sm text-neutral-500">
            You&apos;re using this business account as a collaborator. Only the owner can manage collaborators.
          </p>
        </div>
      );
    }
    return (
      <div className="max-w-lg">
        <CollaboratorManager />
      </div>
    );
  }

  const application = data?.application;
  const businesses = data?.businesses || [];
  const canApply = !application || application.status === "rejected";

  return (
    <div className="max-w-lg space-y-6">
      {dialog}
      <div>
        <h3 className="font-medium text-black dark:text-white">Business account</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Apply for a dedicated business account. Socially staff review applications. Once approved, switch to it from
          the account menu and invite collaborators. Read the{" "}
          <Link to="/business-guidelines" className="text-brand hover:underline">
            Business Guidelines
          </Link>{" "}
          before you apply.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center p-6">
          <FlickerSpinner />
        </div>
      )}

      {/* Active Business Accounts List */}
      {businesses.length > 0 && (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium">Your business accounts</p>
          <ul className="mt-3 space-y-3">
            {businesses.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar user={{ displayName: b.displayName, avatarUrl: b.avatarUrl }} size={9} />
                  <div className="min-w-0">
                    <p className="font-medium truncate text-neutral-900 dark:text-white">{b.displayName}</p>
                    {b.username ? <p className="text-xs text-neutral-500 truncate">@{b.username}</p> : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      switchAccountMutation.mutate(b.id, {
                        onSuccess: () => {
                          queryClient.clear();
                          refetchAuth();
                          navigate("/");
                        },
                      });
                    }}
                    disabled={switchAccountMutation.isPending}
                    className="rounded-full bg-brand px-3.5 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors"
                  >
                    Switch to account
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      confirm({
                        title: `Delete ${b.displayName}?`,
                        description: "This will permanently remove this business account and all collaborator access. This cannot be undone.",
                        confirmLabel: "Delete business",
                        tone: "danger",
                        onConfirm: () => deleteBizMutation.mutate(b.id),
                      })
                    }
                    className="rounded-full bg-red-600 px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pending / Rejected Application Card */}
      {application && (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar user={{ displayName: application.name, avatarUrl: application.logoUrl }} size={8} />
              <span className="font-medium text-black dark:text-white">{application.name}</span>
            </div>
            <span
              className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
                application.status === "pending"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
              }`}
            >
              Status: {application.status}
            </span>
          </div>

          {application.status === "pending" && (
            <p className="text-sm text-neutral-500">Staff are reviewing your application.</p>
          )}
          {application.status === "rejected" && (
            <p className="text-sm text-neutral-500">
              Your application was not approved.
              {application.staffNote ? ` ${application.staffNote}` : ""} You can submit a new application below.
            </p>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() =>
                confirm({
                  title: "Withdraw application?",
                  description: "Are you sure you want to cancel this application?",
                  confirmLabel: "Withdraw",
                  tone: "danger",
                  onConfirm: () => cancelAppMutation.mutate(application.id),
                })
              }
              className="text-xs text-neutral-500 hover:text-red-500 underline underline-offset-2 transition-colors"
            >
              Withdraw application
            </button>
          </div>
        </div>
      )}

      {/* Application Form */}
      {canApply && !isLoading && (
        <ApplyForm
          minMembers={data?.minMembers ?? 500}
          requirements={data?.requirements ?? []}
          onSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: ["business", "status"] });
            refetch();
          }}
        />
      )}
    </div>
  );
}
