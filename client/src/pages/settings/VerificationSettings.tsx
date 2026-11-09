import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "../../lib/queryStore";
import { useAuth } from "../../lib/authContext";
import { api } from "../../lib/api";
import { VerifiedBadge } from "../../components/shared/VerifiedBadge";
import { useCommunity } from "../../lib/communityContext";
import { useNavCommunitySlug } from "../../hooks/useCommunitySlug";
import type { Community, VerificationApplication } from "../../types";

function CommunityVerificationSection() {
  const slug = useNavCommunitySlug();
  const { community, refetch } = useCommunity();
  const [reason, setReason] = useState(community?.myVerificationReason || "");

  const apply = useMutation({
    mutationFn: () => api.post<{ community: Community }>(`/communities/${slug}/verification/apply`, { reason: reason.trim() }),
    onSuccess: () => refetch(),
  });

  const respond = useMutation({
    mutationFn: (action: "accept" | "decline") =>
      api.post<{ community: Community }>(`/communities/${slug}/verification/invite/respond`, { action }),
    onSuccess: () => refetch(),
  });

  if (!slug || !community) {
    return (
      <div className="max-w-lg space-y-2">
        <h3 className="font-medium">Community verification</h3>
        <p className="text-sm text-neutral-500">
          Join a community to apply for a verified badge within it.{" "}
          <Link to="/communities" className="text-brand hover:underline">
            Browse communities
          </Link>
          .
        </p>
      </div>
    );
  }

  const status = community.myVerificationStatus;
  const meetsThreshold = !community.verificationApplicationsOnly && community.myFollowersCount >= community.verificationFollowerThreshold;

  if (status === "approved") {
    return (
      <div className="max-w-lg rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="flex items-center gap-1.5 font-medium">
          You're verified in {community.name} <VerifiedBadge className="h-5 w-5" kind="community" />
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Your account has been approved for community verification in {community.name}.
        </p>
      </div>
    );
  }

  if (status === "invited") {
    return (
      <div className="max-w-lg rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="font-medium">{community.name} has invited you to be verified</p>
        <p className="mt-1 text-sm text-neutral-500">You meet this community's follower threshold for verification.</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => respond.mutate("accept")}
            disabled={respond.isPending}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Accept
          </button>
          <button
            onClick={() => respond.mutate("decline")}
            disabled={respond.isPending}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium dark:border-neutral-700 disabled:opacity-40"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="max-w-lg rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="font-medium">Application pending review</p>
        <p className="mt-1 text-sm text-neutral-500">This community's staff will review your application.</p>
      </div>
    );
  }

  if (meetsThreshold) {
    return (
      <div className="max-w-lg rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="font-medium">Community verification</p>
        <p className="mt-1 text-sm text-neutral-500">
          You meet {community.name}'s follower threshold ({community.verificationFollowerThreshold}) for verification, so
          its staff can invite you directly instead of applying.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h3 className="font-medium">Community verification</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Get verified within {community.name} specifically. This is separate from Socially's global verification, is
          reviewed by this community's staff, and only shows a badge to other members of {community.name}.
        </p>
      </div>

      {status === "rejected" && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          Your last application wasn't approved. You can apply again below.
        </p>
      )}

      {apply.isError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {(apply.error as Error).message}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder={`Tell ${community.name}'s staff why you should be verified...`}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <button
        onClick={() => apply.mutate()}
        disabled={apply.isPending || !reason.trim()}
        className="rounded-full bg-brand px-5 py-2 font-medium text-white disabled:opacity-40"
      >
        {apply.isPending ? "Submitting…" : "Submit application"}
      </button>
    </div>
  );
}

function GlobalVerificationSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const { data } = useQuery({
    queryKey: ["verification", "status"],
    queryFn: () => api.get<{ application: VerificationApplication | null; cooldownDaysLeft: number }>("/verification/status"),
  });

  const cooldownDaysLeft = data?.cooldownDaysLeft ?? 0;

  const apply = useMutation({
    mutationFn: () => api.post("/verification/apply", { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verification"] });
      setReason("");
    },
  });

  if (!user) return null;

  if (user.isVerified) {
    return (
      <div className="max-w-lg rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="flex items-center gap-1.5 font-medium">
          You're verified <VerifiedBadge className="h-5 w-5" />
        </p>
        <p className="mt-1 text-sm text-neutral-500">Your account has been approved for the verification program.</p>
      </div>
    );
  }

  if (data?.application?.status === "pending") {
    return (
      <div className="max-w-lg rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="font-medium">Application pending review</p>
        <p className="mt-1 text-sm text-neutral-500">Submitted {new Date(data.application.createdAt).toLocaleDateString()}.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h3 className="font-medium">Apply for verification</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Tell us why your account should be verified. We may deny applications for any reason, there is not guarantee of approval. If your application is denied, you can apply again after 14 days.
        </p>
      </div>

      {data?.application?.status === "rejected" && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          {cooldownDaysLeft > 0
            ? `Your last application wasn't approved. You can apply again in ${cooldownDaysLeft} day${cooldownDaysLeft === 1 ? "" : "s"}.`
            : "Your last application wasn't approved. You can apply again below."}
        </p>
      )}

      {apply.isError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {(apply.error as Error).message}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <button
        onClick={() => apply.mutate()}
        disabled={apply.isPending || !reason.trim() || cooldownDaysLeft > 0}
        className="rounded-full bg-brand px-5 py-2 font-medium text-white disabled:opacity-40"
      >
        {apply.isPending ? "Submitting…" : "Submit application"}
      </button>
    </div>
  );
}

export default function VerificationSettings() {
  return (
    <div className="max-w-lg space-y-8">
      <CommunityVerificationSection />
      <div className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <GlobalVerificationSection />
      </div>
    </div>
  );
}
