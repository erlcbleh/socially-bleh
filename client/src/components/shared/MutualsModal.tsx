import { communityPath } from "../../lib/communityPath";
import { Link } from "react-router-dom";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { useMutuals } from "../../hooks/useProfile";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";

const MODAL_LIMIT = 100;

export function MutualsModal({
  username,
  open,
  onClose,
}: {
  username: string;
  open: boolean;
  onClose: () => void;
}) {
  const slug = useCommunitySlug();
  const { data, isLoading, error } = useMutuals(open ? username : undefined, MODAL_LIMIT);

  return (
    <Modal open={open} onClose={onClose} title="Mutuals">
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {isLoading && <p className="py-6 text-center text-neutral-400">Loading…</p>}
        {error && <p className="py-6 text-center text-red-500">{error.message}</p>}
        {data && data.users.length === 0 && <p className="py-6 text-center text-neutral-400">No mutuals yet.</p>}
        {data?.users.map((u) => (
          <Link
            key={u.id}
            to={communityPath(slug, `@${u.username}`)}
            onClick={onClose}
            className="group flex min-w-0 items-center gap-2"
          >
            <Avatar user={u} size={9} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium group-hover:underline">{u.displayName}</p>
              <p className="truncate text-sm text-neutral-500">@{u.username}</p>
            </div>
          </Link>
        ))}
      </div>
    </Modal>
  );
}
