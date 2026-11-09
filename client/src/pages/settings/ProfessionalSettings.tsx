import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "../../lib/queryStore";
import { api } from "../../lib/api";
import { useCommunity } from "../../lib/communityContext";
import { useNavCommunitySlug } from "../../hooks/useCommunitySlug";
import type { Community, ProfessionalCategory } from "../../types";

const CATEGORIES: ProfessionalCategory[] = ["Law Enforcement", "Fire Department", "DOT", "Business"];

export default function ProfessionalSettings() {
  const slug = useNavCommunitySlug();
  const { community, refetch } = useCommunity();
  const [category, setCategory] = useState<ProfessionalCategory>(community?.myProfessionalCategory || "Law Enforcement");
  const [reason, setReason] = useState(community?.myProfessionalReason || "");

  const apply = useMutation({
    mutationFn: () =>
      api.post<{ community: Community }>(`/communities/${slug}/professional/apply`, { category, reason: reason.trim() }),
    onSuccess: () => refetch(),
  });

  if (!slug || !community) {
    return (
      <div className="max-w-lg space-y-2">
        <h3 className="font-medium">Professional account</h3>
        <p className="text-sm text-neutral-500">
          Join a community to apply for a professional badge within it.{" "}
          <Link to="/communities" className="text-brand hover:underline">
            Browse communities
          </Link>
          .
        </p>
      </div>
    );
  }

  const status = community.myProfessionalStatus;

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h3 className="font-medium">Professional account</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Apply for a professional badge within {community.name}. This community's staff review and approve
          applications before the badge is granted.
        </p>
      </div>

      {status !== "none" && (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm">
            Category: <span className="font-medium">{community.myProfessionalCategory}</span>
          </p>
          <p className="mt-1 text-sm capitalize text-neutral-500">
            Status: {status === "spun_off" ? "approved" : status}
          </p>
          {community.myProfessionalReason && (
            <p className="mt-1 text-sm text-neutral-500">Reason: {community.myProfessionalReason}</p>
          )}
          {status === "spun_off" && (
            <p className="mt-2 text-sm text-neutral-500">
              Your professional profile for {community.name} has been created as a separate account. Switch to it from
              the account menu to access it and its analytics.
            </p>
          )}
        </div>
      )}

      {(status === "none" || status === "rejected") && (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProfessionalCategory)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="mb-1 mt-3 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Reason <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Tell this community's staff why you're applying..."
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
          />
          <p className="mt-1 text-right text-xs text-neutral-400">{reason.length}/500</p>

          {apply.isError && <p className="mt-2 text-sm text-red-500">{(apply.error as Error).message}</p>}

          <button
            onClick={() => apply.mutate()}
            disabled={apply.isPending}
            className="mt-1 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {apply.isPending ? "Submitting…" : status === "none" ? "Apply" : "Re-apply"}
          </button>
        </div>
      )}
    </div>
  );
}
