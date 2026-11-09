import { openUserPeek } from "../lib/userPeek";

export function UserName({
  username,
  className = "",
  prefix = true,
  fallback = "unknown",
}: {
  username?: string | null;
  className?: string;
  prefix?: boolean;
  fallback?: string;
}) {
  if (!username) {
    return <span className={`text-neutral-500 ${className}`}>{fallback}</span>;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        openUserPeek(username);
      }}
      title={`View @${username}`}
      className={`truncate rounded underline-offset-2 transition-colors hover:text-white hover:underline ${className}`}
    >
      {prefix ? `@${username}` : username}
    </button>
  );
}
