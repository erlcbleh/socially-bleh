import { useMutation } from "../../lib/queryStore";
import { useAuth } from "../../lib/authContext";
import { api } from "../../lib/api";
import { Toggle } from "../../components/shared/Toggle";
import { useOptimisticToggle } from "../../hooks/useOptimisticToggle";
import type { User } from "../../types";

type PrivacyField = "isPrivate" | "hideFollowing" | "hideProfileMedia" | "restrictMessages";

function PrivacyToggleRow({
  title,
  description,
  serverValue,
  onSave,
}: {
  title: string;
  description: string;
  serverValue: boolean;
  onSave: (value: boolean) => Promise<unknown>;
}) {
  const { value, toggle, pending } = useOptimisticToggle(serverValue, onSave);

  return (
    <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="pr-4">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      <Toggle checked={value} onChange={toggle} disabled={pending} />
    </div>
  );
}

export default function PrivacySettings() {
  const { user, refetch } = useAuth();

  const updatePrivacy = useMutation({
    mutationFn: (patch: Partial<Record<PrivacyField, boolean>>) =>
      api.patch<{ user: User }>("/users/me/privacy", patch),
    onSuccess: () => refetch(),
  });

  if (!user) return null;

  return (
    <div className="max-w-lg space-y-4">
      <PrivacyToggleRow
        title="Followers-only posts"
        description="Only approved followers can see your posts. New followers must be accepted or denied."
        serverValue={user.isPrivate}
        onSave={(v) => updatePrivacy.mutateAsync({ isPrivate: v })}
      />

      <PrivacyToggleRow
        title="Hide following list"
        description="Others can see how many accounts you follow, but not who."
        serverValue={user.hideFollowing}
        onSave={(v) => updatePrivacy.mutateAsync({ hideFollowing: v })}
      />

      <PrivacyToggleRow
        title="Hide profile picture & banner"
        description="Your avatar and banner will be hidden from everyone but you."
        serverValue={user.hideProfileMedia}
        onSave={(v) => updatePrivacy.mutateAsync({ hideProfileMedia: v })}
      />

      <PrivacyToggleRow
        title="Restrict direct messages"
        description="Only accounts you follow will be able to message you."
        serverValue={user.restrictMessages}
        onSave={(v) => updatePrivacy.mutateAsync({ restrictMessages: v })}
      />

      <p className="text-sm text-neutral-500">
        Blocking and muting apply everywhere on Socially. Open someone's profile menu to block, unblock, mute, or
        unmute them.
      </p>
    </div>
  );
}
