import { getQualifiedBadges, BadgeDef, UserLike } from "../../config/badges.config";

export function SingleBadge({ badge, className = "h-4 w-4" }: { badge: BadgeDef; className?: string }) {
  return (
    <span className="group relative inline-flex items-center justify-center">
      {badge.iconType === "react-icon" && badge.icon ? (
        <badge.icon aria-label={badge.tooltip} className={`${badge.colorClass || ""} ${className}`} />
      ) : (
        <img src={badge.src} alt={badge.tooltip} className={className} />
      )}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-black opacity-0 shadow-lg transition-opacity delay-150 group-hover:opacity-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
        {badge.tooltip}
      </span>
    </span>
  );
}

export function UserBadges({
  user,
  className = "h-4 w-4",
  showCosmetic = false,
}: {
  user: UserLike | undefined | null;
  className?: string;
  showCosmetic?: boolean;
}) {
  let badges = getQualifiedBadges(user);

  if (Array.isArray(user?.equippedBadges)) {
    const equippedSet = new Set(user.equippedBadges);
    badges = badges.filter((badge) => equippedSet.has(badge.id));
  } else if (!showCosmetic) {
    badges = badges.filter((badge) => badge.category === "role" || badge.category === "verification");
  }

  if (badges.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1">
      {badges.map((badge) => (
        <SingleBadge key={badge.id} badge={badge} className={className} />
      ))}
    </span>
  );
}
