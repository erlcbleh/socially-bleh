import { UserBadges, SingleBadge } from "./UserBadges";
import { BADGES } from "../../config/badges.config";
import { UserLike } from "../../config/badges.config";

export function VerifiedBadge({ className = "h-4 w-4", kind = "global" }: { className?: string; kind?: "global" | "community" | "professional" | "business" }) {
  const badgeId =
    kind === "business"
      ? "business_verified"
      : kind === "professional"
        ? "professional_verified"
        : kind === "community"
          ? "community_verified"
          : "global_verified";
  const badge = BADGES[badgeId];
  if (!badge) return null;
  return <SingleBadge badge={badge} className={className} />;
}

export function UserVerifiedBadge({
  user,
  className,
}: {
  user: UserLike;
  className?: string;
}) {
  return <UserBadges user={user} className={className} />;
}
