import { useParams, useNavigate, Link } from "react-router-dom";
import { LuLogIn } from "react-icons/lu";
import { useInvitePreview, useJoinCommunity } from "../hooks/useCommunities";
import { useAuth } from "../lib/authContext";
import { colorForCommunity } from "../lib/communityColor";
import FlickerSpinner from "../components/shared/FlickerSpinner";
import { communityPath } from "../lib/communityPath";

export default function InvitePage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data, isLoading, error } = useInvitePreview(code);
  const joinCommunity = useJoinCommunity();

  if (isLoading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <FlickerSpinner />
      </div>
    );
  }

  if (error || !data?.community) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold">Invite not found</h1>
        <p className="text-neutral-500">{(error as Error)?.message || "This invite link is invalid or has expired."}</p>
        <Link to="/" className="mt-2 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white">
          Go home
        </Link>
      </div>
    );
  }

  const community = data.community;

  const join = () => {
    joinCommunity.mutate(code, { onSuccess: (res) => navigate(communityPath(res.community.slug)) });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-transparent">
        {community.logoUrl ? (
          <img src={community.logoUrl} alt={community.name} className="h-full w-full bg-transparent object-cover" />
        ) : (
          <div className={`h-full w-full ${colorForCommunity(community.id)}`} />
        )}
      </div>

      <p className="mt-6 text-sm text-neutral-500">You've been invited to join</p>
      <h1 className="mt-1 text-3xl font-semibold">{community.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {community.memberCount} {community.memberCount === 1 ? "member" : "members"}
      </p>
      {community.description && (
        <p className="mt-4 max-w-md text-neutral-600 dark:text-neutral-400">{community.description}</p>
      )}

      {joinCommunity.isError && (
        <p className="mt-4 text-sm text-red-500">{(joinCommunity.error as Error).message}</p>
      )}

      {user ? (
        <button
          onClick={join}
          disabled={joinCommunity.isPending}
          className="mt-8 flex items-center gap-2 rounded-lg bg-brand px-8 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-40"
        >
          <LuLogIn className="h-4 w-4" />
          {joinCommunity.isPending ? "Joining…" : "Accept invite"}
        </button>
      ) : (
        <>
          <Link
            to="/login"
            className="mt-8 rounded-lg bg-brand px-8 py-3 font-medium text-white hover:bg-brand-dark"
          >
            Sign in to join
          </Link>
          <p className="mt-3 text-xs text-neutral-500">Come back to this link after signing in.</p>
        </>
      )}
    </div>
  );
}
