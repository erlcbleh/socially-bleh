import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "../../lib/queryStore";
import { api } from "../../lib/api";
import { useCommunity } from "../../lib/communityContext";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";
import { communitySettingsPath } from "../../lib/communityPath";
import { SHARE_BASE_URL } from "../../lib/links";
import { useUploadMedia } from "../../hooks/useMediaUpload";
import { Modal } from "../../components/shared/Modal";
import { ImageCropModal } from "../../components/shared/ImageCropModal";
import { Toggle } from "../../components/shared/Toggle";
import FlickerSpinner from "../../components/shared/FlickerSpinner";
import type { Community } from "../../types";
import { LuCamera, LuCopy, LuCheck, LuPlug } from "react-icons/lu";
import { GlobalCommunityMark } from "../../components/shared/GlobalCommunityMark";

export default function CommunityGeneralSettings() {
  const queryClient = useQueryClient();
  const slug = useCommunitySlug();
  const navigate = useNavigate();
  const { community, isOwner, canManageCommunity, refetch } = useCommunity();
  const uploadMedia = useUploadMedia();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [confirmRemoveWebhook, setConfirmRemoveWebhook] = useState(false);

  const [name, setName] = useState(community?.name || "");
  const [description, setDescription] = useState(community?.description || "");
  const [customCode, setCustomCode] = useState("");
  const [threshold, setThreshold] = useState(String(community?.verificationFollowerThreshold ?? 1000));
  const [applicationsOnly, setApplicationsOnly] = useState(community?.verificationApplicationsOnly ?? true);

  const update = useMutation({
    mutationFn: (body: { name?: string; description?: string; logoUrl?: string; joinPolicy?: "open" | "invite" }) =>
      api.patch<{ community: Community }>(`/communities/${slug}`, body),
    onSuccess: (res) => {
      refetch();
      if (res.community.slug !== slug) {
        navigate(communitySettingsPath(res.community.slug), { replace: true });
      }
    },
  });

  const updateVerification = useMutation({
    mutationFn: (body: { verificationFollowerThreshold?: number; verificationApplicationsOnly?: boolean }) =>
      api.patch<{ community: Community }>(`/communities/${slug}`, body),
    onSuccess: () => refetch(),
  });

  const regenerate = useMutation({
    mutationFn: () => api.post<{ community: Community }>(`/communities/${slug}/invite-code/regenerate`),
    onSuccess: () => {
      refetch();
      setConfirmRegenOpen(false);
    },
  });

  const setCode = useMutation({
    mutationFn: (code: string) => api.post<{ community: Community }>(`/communities/${slug}/invite-code`, { code }),
    onSuccess: () => {
      refetch();
      setCustomCode("");
    },
  });

  const leave = useMutation({
    mutationFn: () => api.post(`/communities/${slug}/leave`),
    onSuccess: () => navigate("/communities"),
  });

  const deleteCommunity = useMutation({
    mutationFn: () => api.delete(`/communities/${slug}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myCommunities"] });
      navigate("/communities");
    },
  });

  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  const setWebhook = useMutation({
    mutationFn: (url: string) => api.put<{ community: Community }>(`/communities/${slug}/discord-webhook`, { webhookUrl: url }),
    onSuccess: () => {
      refetch();
      setWebhookOpen(false);
      setWebhookUrl("");
    },
  });

  const removeWebhook = useMutation({
    mutationFn: () => api.delete<{ community: Community }>(`/communities/${slug}/discord-webhook`),
    onSuccess: () => {
      refetch();
      setConfirmRemoveWebhook(false);
    },
  });

  if (!community) return null;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingCropFile(file);
  };

  const handleCroppedComplete = (croppedFile: File) => {
    uploadMedia.mutate(croppedFile, { onSuccess: (res) => update.mutate({ logoUrl: res.url }) });
    setPendingCropFile(null);
  };

  const inviteLink = community.inviteCode ? `${SHARE_BASE_URL}/invite/${community.inviteCode}` : "";

  const copyCode = () => {
    if (!community.inviteCode) return;
    navigator.clipboard.writeText(community.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  };

  if (!canManageCommunity) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent">
            {community.isGlobal ? (
              <GlobalCommunityMark className="h-8 w-8" />
            ) : community.logoUrl ? (
              <img src={community.logoUrl} alt={community.name} className="h-full w-full bg-transparent object-cover" />
            ) : null}
          </div>
          <div>
            <p className="font-medium">{community.name}</p>
            <p className="text-sm text-neutral-500">{community.memberCount} members</p>
          </div>
        </div>
        {community.description && <p className="text-sm text-neutral-500">{community.description}</p>}

        <button
          onClick={() => setConfirmLeaveOpen(true)}
          className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Leave community
        </button>

        <Modal open={confirmLeaveOpen} onClose={() => setConfirmLeaveOpen(false)} title="Leave this community?">
          <p className="text-sm text-neutral-500">You'll need a new invite code to rejoin.</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => leave.mutate()}
              disabled={leave.isPending}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {leave.isPending ? "Leaving…" : "Leave"}
            </button>
            <button
              onClick={() => setConfirmLeaveOpen(false)}
              className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Cancel
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        {community.isGlobal ? (
          <>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent">
              <GlobalCommunityMark className="h-9 w-9" />
            </div>
            <p className="text-sm text-neutral-500">Global uses the world mark.</p>
          </>
        ) : (
          <>
            <label
              className={`flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full text-xs font-medium text-neutral-500 ${
                community.logoUrl ? "bg-transparent" : "bg-neutral-100 dark:bg-neutral-800"
              }`}
            >
              {community.logoUrl ? (
                <img src={community.logoUrl} alt="Logo" className="h-full w-full bg-transparent object-cover" />
              ) : uploadMedia.isPending ? (
                <FlickerSpinner size={20} />
              ) : (
                <LuCamera className="h-5 w-5" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
            <p className="text-sm text-neutral-500">Click to change the community logo.</p>
          </>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      {update.isError && <p className="text-sm text-red-500">{(update.error as Error).message}</p>}

      <button
        onClick={() => update.mutate({ name: name.trim(), description: description.trim() })}
        disabled={!name.trim() || update.isPending || (name === community.name && description === community.description)}
        className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {update.isPending ? "Saving…" : "Save changes"}
      </button>

      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="font-medium">Discovery</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Open communities are listed in Explore and anyone can join them. Invite-only communities are hidden and
          require a code or invite link.
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-medium">List in Explore</span>
          <Toggle
            checked={community.joinPolicy === "open"}
            onChange={(v) => update.mutate({ joinPolicy: v ? "open" : "invite" })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="font-medium">Invite code</h3>
        <p className="mt-1 text-sm text-neutral-500">Anyone with this code or link can join {community.name}.</p>
        <div className="mt-3 flex gap-2">
          <code className="flex-1 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">{community.inviteCode}</code>
          <button
            onClick={copyCode}
            aria-label={copied ? "Copied" : "Copy"}
            className="shrink-0 rounded-xl border border-neutral-300 p-2 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {copied ? <LuCheck className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-2 flex gap-2">
          <code className="flex-1 truncate rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-500 dark:bg-neutral-900">
            {inviteLink}
          </code>
          <button
            onClick={copyLink}
            aria-label={linkCopied ? "Copied" : "Copy invite link"}
            className="shrink-0 rounded-xl border border-neutral-300 p-2 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {linkCopied ? <LuCheck className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
          </button>
        </div>
        <button
          onClick={() => setConfirmRegenOpen(true)}
          className="mt-2 rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Regenerate code
        </button>

        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Set a custom code</label>
          <div className="flex gap-2">
            <input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
              placeholder="eg. MYCODE"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              onClick={() => setCode.mutate(customCode)}
              disabled={customCode.length < 6 || setCode.isPending}
              className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {setCode.isPending ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-400">6-12 letters and numbers.</p>
          {setCode.isError && <p className="mt-1 text-sm text-red-500">{(setCode.error as Error).message}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="font-medium">Community verification</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Members below the follower threshold can apply for a verified badge within {community.name}. Members who meet the
          threshold can only be verified if this community's staff invites them.
        </p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Applications only</p>
            <p className="text-xs text-neutral-500">Ignore the follower threshold, everyone must apply, no invites.</p>
          </div>
          <Toggle
            checked={applicationsOnly}
            onChange={(checked) => {
              setApplicationsOnly(checked);
              updateVerification.mutate({ verificationApplicationsOnly: checked });
            }}
            disabled={updateVerification.isPending}
          />
        </div>

        <div className={`mt-3 ${applicationsOnly ? "opacity-40" : ""}`}>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Follower threshold</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              disabled={applicationsOnly}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              onClick={() => updateVerification.mutate({ verificationFollowerThreshold: Number(threshold) })}
              disabled={applicationsOnly || updateVerification.isPending || Number(threshold) === community.verificationFollowerThreshold}
              className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {updateVerification.isPending ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-400">Members with at least this many followers in {community.name} must be invited.</p>
        </div>
        {updateVerification.isError && <p className="mt-2 text-sm text-red-500">{(updateVerification.error as Error).message}</p>}
      </div>

      {isOwner && !community.isGlobal && (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-1.5 font-medium">
                <LuPlug className="h-4 w-4 text-neutral-400" /> Discord notifications
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Post new posts from {community.name} to a Discord channel.
              </p>
            </div>
            {community.hasDiscordWebhook ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  <LuCheck className="h-3.5 w-3.5" /> Connected
                </span>
                <button
                  onClick={() => setConfirmRemoveWebhook(true)}
                  disabled={removeWebhook.isPending}
                  className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => setWebhookOpen(true)}
                className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Connect
              </button>
            )}
          </div>
          {community.discordWebhookChannelName && (
            <p className="mt-2 text-xs text-neutral-400">
              Posting to <span className="font-medium text-neutral-600 dark:text-neutral-300">#{community.discordWebhookChannelName}</span>
            </p>
          )}
        </div>
      )}

      {!isOwner ? (
        <button
          onClick={() => setConfirmLeaveOpen(true)}
          className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Leave community
        </button>
      ) : !community.isGlobal && (
        <div className="rounded-xl border border-red-200 p-4 dark:border-red-900/50 dark:bg-red-950/20">
          <h3 className="font-medium text-red-600 dark:text-red-400">Danger Zone</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Permanently delete this community, all its members, posts, and data. This action cannot be undone.
          </p>
          <button
            onClick={() => setConfirmDeleteOpen(true)}
            className="mt-3 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete community
          </button>
        </div>
      )}

      <Modal open={confirmLeaveOpen} onClose={() => setConfirmLeaveOpen(false)} title="Leave this community?">
        <p className="text-sm text-neutral-500">You'll need a new invite code to rejoin.</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => leave.mutate()}
            disabled={leave.isPending}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {leave.isPending ? "Leaving…" : "Leave"}
          </button>
          <button
            onClick={() => setConfirmLeaveOpen(false)}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title={`Delete ${community.name}?`}>
        <p className="text-sm text-neutral-500">
          Are you sure you want to permanently delete <strong className="font-semibold text-neutral-900 dark:text-white">{community.name}</strong>? All posts, members, and settings will be permanently erased.
        </p>
        {deleteCommunity.isError && (
          <p className="mt-2 text-sm text-red-500">{(deleteCommunity.error as Error).message}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => deleteCommunity.mutate()}
            disabled={deleteCommunity.isPending}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            {deleteCommunity.isPending ? "Deleting…" : "Permanently Delete"}
          </button>
          <button
            onClick={() => setConfirmDeleteOpen(false)}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal open={confirmRegenOpen} onClose={() => setConfirmRegenOpen(false)} title="Regenerate invite code?">
        <p className="text-sm text-neutral-500">The old code will stop working immediately.</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {regenerate.isPending ? "Regenerating…" : "Regenerate"}
          </button>
          <button
            onClick={() => setConfirmRegenOpen(false)}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal open={webhookOpen} onClose={() => setWebhookOpen(false)} title="Connect Discord webhook">
        <p className="text-sm text-neutral-500">
          Paste a Discord webhook URL. New posts in {community.name} will be posted to that channel.
        </p>
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
        {setWebhook.isError && <p className="mt-2 text-sm text-red-500">{(setWebhook.error as Error).message}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setWebhook.mutate(webhookUrl.trim())}
            disabled={setWebhook.isPending || !webhookUrl.trim()}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {setWebhook.isPending ? "Connecting…" : "Connect"}
          </button>
          <button
            onClick={() => setWebhookOpen(false)}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal open={confirmRemoveWebhook} onClose={() => setConfirmRemoveWebhook(false)} title="Disconnect Discord webhook?">
        <p className="text-sm text-neutral-500">New posts will stop being sent to Discord.</p>
        {removeWebhook.isError && <p className="mt-2 text-sm text-red-500">{(removeWebhook.error as Error).message}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => removeWebhook.mutate()}
            disabled={removeWebhook.isPending}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {removeWebhook.isPending ? "Disconnecting…" : "Disconnect"}
          </button>
          <button
            onClick={() => setConfirmRemoveWebhook(false)}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <ImageCropModal
        open={!!pendingCropFile}
        imageFile={pendingCropFile}
        aspect="circle"
        title="Edit Community Logo"
        onClose={() => setPendingCropFile(null)}
        onCropComplete={handleCroppedComplete}
      />
    </div>
  );
}
