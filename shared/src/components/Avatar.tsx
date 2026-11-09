import { LuUser } from "react-icons/lu";

export function Avatar({
  user,
  size = 10,
}: {
  user: { displayName: string; avatarUrl?: string | null };
  size?: number;
}) {
  const dim = `${size * 4}px`;
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        decoding="async"
        loading="lazy"
        style={{ width: dim, height: dim }}
        className="rounded-full bg-transparent object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: dim, height: dim }}
      className="flex items-center justify-center rounded-full bg-neutral-200 text-neutral-300 dark:bg-neutral-700 dark:text-neutral-500"
    >
      <LuUser style={{ width: "60%", height: "60%" }} />
    </div>
  );
}
