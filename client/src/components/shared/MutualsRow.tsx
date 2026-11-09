import { useMutuals } from "../../hooks/useProfile";
import { Avatar } from "./Avatar";

export function MutualsRow({
  username,
  className = "",
  onClick,
}: {
  username: string;
  className?: string;
  onClick?: () => void;
}) {
  const { data } = useMutuals(username);

  if (!data || data.count === 0) return null;

  return (
    <button onClick={onClick} className={`flex items-center gap-2 ${className}`}>
      <div className="flex -space-x-2">
        {data.users.map((u) => (
          <div key={u.id} className="rounded-full ring-2 ring-white dark:ring-black">
            <Avatar user={u} size={5} />
          </div>
        ))}
      </div>
      <span className="text-xs text-neutral-500 hover:underline">
        {data.count.toLocaleString()} {data.count === 1 ? "mutual" : "mutuals"}
      </span>
    </button>
  );
}
