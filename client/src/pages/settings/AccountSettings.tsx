import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "../../lib/queryStore";
import { LuCamera, LuRefreshCw } from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useCommunity } from "../../lib/communityContext";
import { useUploadMedia } from "../../hooks/useMediaUpload";
import { api, apiOrigin, ApiError } from "../../lib/api";
import { Avatar } from "../../components/shared/Avatar";
import { ImageCropModal } from "../../components/shared/ImageCropModal";
import { MentionTextarea } from "../../components/shared/MentionTextarea";
import { getAllQualifiedBadges } from "../../config/badges.config";
import { SingleBadge } from "../../components/shared/UserBadges";
import type { User } from "../../types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "long" });
}

function UsernameSection({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(user.username);

  const lockedUntil = user.usernameChangeAvailableAt || null;
  const locked = !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();

  const change = useMutation({
    mutationFn: () => api.patch<{ user: User }>("/users/me/username", { username: value.trim() }),
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
    },
  });

  if (locked) {
    return (
      <p className="mt-1 text-sm text-neutral-500">
        You can change your username again on {formatDate(lockedUntil)}.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setValue(user.username);
          setOpen(true);
        }}
        className="mt-1 text-sm font-medium text-brand hover:underline"
      >
        Change username
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-neutral-500">@</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={20}
          placeholder="newhandle"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <p className="text-xs text-neutral-500">
        3-20 characters, letters, numbers and underscores. You can only change this once every 30 days, and your old
        handle is held for 30 days so nobody can take it.
      </p>
      {change.isError && <p className="text-sm text-red-500">{(change.error as Error).message}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => change.mutate()}
          disabled={change.isPending || !value.trim() || value.trim() === user.username}
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {change.isPending ? "Saving…" : "Save username"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [bannerUrl, setBannerUrl] = useState(user?.bannerUrl || "");
  const [justSaved, setJustSaved] = useState(false);

  const qualifiedBadges = getAllQualifiedBadges(user);
  const [equippedBadges, setEquippedBadges] = useState<string[]>(
    Array.isArray(user?.equippedBadges)
      ? user.equippedBadges
      : qualifiedBadges.slice(0, 3).map((b) => b.id)
  );

  const toggleBadge = (badgeId: string) => {
    setEquippedBadges((prev) => {
      if (prev.includes(badgeId)) {
        return prev.filter((id) => id !== badgeId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, badgeId];
    });
  };

  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("avatar");
    if (!result) return;

    const messages: Record<string, string> = {
      updated: "Profile picture updated from Discord.",
      unchanged: "Your Discord profile picture hasn't changed.",
      mismatch: "That Discord account doesn't match this one.",
    };
    setAvatarNotice(messages[result] || null);

    if (result === "updated") {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }

    params.delete("avatar");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [queryClient]);

function invalidateAllUserQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["me"] });
  queryClient.invalidateQueries({ queryKey: ["profile"] });
  queryClient.invalidateQueries({ queryKey: ["posts"] });
  queryClient.invalidateQueries({ queryKey: ["stories"] });
  queryClient.invalidateQueries({ queryKey: ["notifications"] });
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
  queryClient.invalidateQueries({ queryKey: ["messages"] });
  queryClient.invalidateQueries({ queryKey: ["users"] });
}

  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const syncDiscordAvatar = useMutation({
    mutationFn: () => api.post<{ user: User; avatarUrl: string; message: string }>("/users/me/sync-avatar"),
    onSuccess: (data) => {
      setAvatarUrl(data.avatarUrl);
      setSyncNotice(data.message);
      invalidateAllUserQueries(queryClient);
      setTimeout(() => setSyncNotice(null), 4000);
    },
  });

  useEffect(() => {
    if (syncDiscordAvatar.isError && syncDiscordAvatar.error) {
      const err = syncDiscordAvatar.error as ApiError;
      if (err.code === "oauth_required") {
        window.location.href = `${apiOrigin}/api/auth/discord?resync=1`;
      }
    }
  }, [syncDiscordAvatar.isError, syncDiscordAvatar.error]);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useUploadMedia();
  const uploadBanner = useUploadMedia();

  const save = useMutation({
    mutationFn: () =>
      api.patch<{ user: User }>("/users/me/account", {
        displayName,
        bio,
        bannerUrl,
        avatarUrl,
        equippedBadges,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data);
      invalidateAllUserQueries(queryClient);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    },
  });

  if (!user) return null;

  const [pendingCropFile, setPendingCropFile] = useState<{ file: File; aspect: "circle" | "banner"; target: "avatar" | "banner" } | null>(null);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingCropFile({ file, aspect: "circle", target: "avatar" });
  };

  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingCropFile({ file, aspect: "banner", target: "banner" });
  };

  const handleCroppedComplete = (croppedFile: File) => {
    if (!pendingCropFile) return;
    const target = pendingCropFile.target;
    setPendingCropFile(null);

    if (target === "avatar") {
      uploadAvatar.mutate(croppedFile, {
        onSuccess: (data) => {
          setAvatarUrl(data.url);
          api
            .patch<{ user: User }>("/users/me/account", {
              displayName,
              bio,
              bannerUrl,
              avatarUrl: data.url,
              equippedBadges,
            })
            .then((res) => {
              queryClient.setQueryData(["me"], res);
              invalidateAllUserQueries(queryClient);
            });
        },
      });
    } else {
      uploadBanner.mutate(croppedFile, {
        onSuccess: (data) => {
          setBannerUrl(data.url);
          api
            .patch<{ user: User }>("/users/me/account", {
              displayName,
              bio,
              bannerUrl: data.url,
              avatarUrl,
              equippedBadges,
            })
            .then((res) => {
              queryClient.setQueryData(["me"], res);
              invalidateAllUserQueries(queryClient);
            });
        },
      });
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar user={{ displayName, avatarUrl }} size={12} />
            {user.accountKind === "business" && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadAvatar.isPending}
                  className="absolute -bottom-1 -right-1 rounded-full bg-brand p-1.5 text-white hover:bg-brand-dark disabled:opacity-40"
                  aria-label="Change profile picture"
                >
                  <LuCamera className="h-3.5 w-3.5" />
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
              </>
            )}
          </div>
          <p className="min-w-0 truncate text-lg text-black dark:text-white">@{user.username}</p>
        </div>
        <UsernameSection user={user} />
        {user.accountKind !== "business" && (
          <>
            <p className="mt-1 text-sm text-neutral-500">
              Your profile picture is synced from Discord.
            </p>
            <button
              type="button"
              onClick={() => {
                setSyncNotice(null);
                syncDiscordAvatar.mutate();
              }}
              disabled={syncDiscordAvatar.isPending}
              className="mt-2 flex items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              <LuRefreshCw className={`h-3.5 w-3.5 ${syncDiscordAvatar.isPending ? "animate-spin" : ""}`} />
              {syncDiscordAvatar.isPending ? "Syncing..." : "Update my profile picture"}
            </button>
            {syncNotice && <p className="mt-2 text-sm font-medium text-brand">{syncNotice}</p>}
            {syncDiscordAvatar.isError && (
              <p className="mt-2 text-sm text-red-500">{(syncDiscordAvatar.error as Error).message}</p>
            )}
          </>
        )}
        {uploadAvatar.isPending && <p className="mt-1 text-sm text-neutral-500">Uploading…</p>}
        {uploadAvatar.isError && <p className="mt-1 text-sm text-red-500">{(uploadAvatar.error as Error).message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Display name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Bio</label>
        <MentionTextarea value={bio} onChange={setBio} maxLength={200} rows={3} />
        <p className="mt-1 text-right text-xs text-neutral-400">{bio.length}/200</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Banner</label>
        <div className="relative">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Banner" className="h-32 w-full rounded-xl object-cover" />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400 dark:bg-neutral-900">
              No banner set
            </div>
          )}
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadBanner.isPending}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-40"
          >
            <LuCamera className="h-3.5 w-3.5" />
            {uploadBanner.isPending ? "Uploading…" : "Change banner"}
          </button>
        </div>
        <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerFile} className="hidden" />
        {uploadBanner.isError && <p className="mt-1 text-sm text-red-500">{(uploadBanner.error as Error).message}</p>}
      </div>

      {qualifiedBadges.length > 0 && (
        <div className="space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-neutral-900 dark:text-white">
              Featured Badges
            </label>
            <span className="text-xs text-neutral-500">{equippedBadges.length}/3 selected</span>
          </div>
          <p className="text-xs text-neutral-500">
            Select up to 3 badges you have to display next to your name across Socially.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {qualifiedBadges.map((badge) => {
              const isSelected = equippedBadges.includes(badge.id);
              const disabled = !isSelected && equippedBadges.length >= 3;
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => toggleBadge(badge.id)}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                    isSelected
                      ? "border-brand bg-brand/10 text-brand dark:bg-brand/20"
                      : "border-neutral-200 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  }`}
                >
                  <SingleBadge badge={badge} className="h-4 w-4" />
                  <span>{badge.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className={`rounded-full px-5 py-2 font-medium text-white disabled:opacity-40 ${
          justSaved ? "bg-green-600" : "bg-brand"
        }`}
      >
        {save.isPending ? "Saving…" : justSaved ? "Saved" : "Save"}
      </button>

      <ImageCropModal
        open={!!pendingCropFile}
        imageFile={pendingCropFile?.file || null}
        aspect={pendingCropFile?.aspect}
        title={pendingCropFile?.target === "avatar" ? "Edit Profile Picture" : "Edit Banner"}
        onClose={() => setPendingCropFile(null)}
        onCropComplete={handleCroppedComplete}
      />
    </div>
  );
}