import { communityPath } from "../lib/communityPath";
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { LuMail, LuPin } from "react-icons/lu";
import { useAuth } from "../lib/authContext";
import { useGuestGate } from "../lib/guestGate";
import { useProfile, useProfilePosts, useProfileReplies, useProfileMentions } from "../hooks/useProfile";
import { usePost } from "../hooks/usePosts";
import { useUserStories } from "../hooks/useStories";
import { useNavCommunitySlug } from "../hooks/useCommunitySlug";
import { Avatar } from "../components/shared/Avatar";
import { UserBadges } from "../components/shared/UserBadges";
import { AccountLabel } from "../components/shared/AccountLabel";
import { FollowButton } from "../components/shared/FollowButton";
import { MutualsRow } from "../components/shared/MutualsRow";
import { MutualsModal } from "../components/shared/MutualsModal";
import { ProfileMenu } from "../components/shared/ProfileMenu";
import { FollowListModal } from "../components/shared/FollowListModal";
import FlickerSpinner from "../components/shared/FlickerSpinner";
import { PostCard, renderContent } from "../components/post/PostCard";
import { ReplyThreadPreview } from "../components/post/ReplyThreadPreview";
import { StoryRing } from "../components/story/StoryTray";
import { StoryViewer } from "../components/story/StoryViewer";
import { Modal } from "../components/shared/Modal";
import { api } from "../lib/api";
import type { ProfessionalCategory } from "../types";

const CATEGORY_DESCRIPTIONS: Record<ProfessionalCategory, string> = {
  "Law Enforcement": "This account represents a law enforcement department within this community, such as a police department.",
  "Fire Department": "This account represents a fire department within this community.",
  DOT: "This account represents a Department of Transportation within this community.",
  Business: "This account represents a business operating within this community.",
};

const FICTIONAL_CATEGORIES = new Set<ProfessionalCategory>(["Law Enforcement", "Fire Department", "DOT"]);

export default function ProfilePage() {
  const { username: usernameParam } = useParams();
  const username = usernameParam?.startsWith("@") ? usernameParam.slice(1) : undefined;
  const { user: me } = useAuth();
  const { requireAccount } = useGuestGate();
  const navigate = useNavigate();
  const slug = useNavCommunitySlug();
  const { data, isLoading } = useProfile(username);
  const isOwnProfile = me?.username === username;
  const blockedByThem = !!data?.user.hasBlockedMe && !isOwnProfile;
  const blockedByMe = !!data?.user.isBlockedByMe && !isOwnProfile;
  const isBlockedAny = blockedByThem || blockedByMe;
  const locked = (data?.user.isPrivate && !data.user.isFollowedByMe && !isOwnProfile) || isBlockedAny;
  const [tab, setTab] = useState<"posts" | "replies" | "mentions">("posts");
  const accessibleUsername = locked ? undefined : username;
  const { data: postsData } = useProfilePosts(tab === "posts" ? accessibleUsername : undefined);
  const { data: repliesData } = useProfileReplies(tab === "replies" ? accessibleUsername : undefined);
  const { data: mentionsData } = useProfileMentions(tab === "mentions" ? accessibleUsername : undefined);
  const { data: pinnedData } = usePost(data?.user.pinnedPostId ?? undefined);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const [mutualsModalOpen, setMutualsModalOpen] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [categoryInfoOpen, setCategoryInfoOpen] = useState(false);
  const { data: storiesData } = useUserStories(locked ? undefined : username);
  const stories = storiesData?.stories ?? [];

  useEffect(() => {
    setTab("posts");
  }, [username]);

  useEffect(() => {
    if (username && !isOwnProfile) {
      api.post(`/communities/${slug}/analytics/profile-view/${username}`).catch(() => {});
    }
  }, [username, isOwnProfile, slug]);

  useEffect(() => {
    if (data?.user) {
      document.title = `${data.user.displayName} (@${data.user.username}) | Socially`;
    }
  }, [data?.user?.displayName, data?.user?.username]);

  if (isLoading) return <div className="flex justify-center p-6"><FlickerSpinner /></div>;
  if (!data?.user) return <p className="p-6 text-center text-neutral-400">This account doesn't exist.</p>;

  const profile = data.user;

  return (
    <div>
      <div className="h-32 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-700">
        {profile.bannerUrl && <img src={profile.bannerUrl} alt="Banner" className="h-full w-full rounded-md object-cover" />}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="-mt-16 rounded-full border-4 border-white bg-white dark:border-black dark:bg-black">
            {stories.length > 0 ? (
              <button onClick={() => setStoryViewerOpen(true)} aria-label="View story">
                <StoryRing active={stories.some((s) => !s.isViewedByMe) ? "unviewed" : "viewed"}>
                  <Avatar user={profile} size={24} />
                </StoryRing>
              </button>
            ) : (
              <Avatar user={profile} size={24} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {me && !isOwnProfile && <ProfileMenu user={profile} />}
            {isOwnProfile ? (
              <Link
                to="/settings"
                className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Edit profile
              </Link>
            ) : isBlockedAny ? null : (
              <>
                <button
                  onClick={() => {
                    if (requireAccount()) return;
                    navigate(communityPath(slug, `messages/${profile.username}`));
                  }}
                  className="rounded-full border border-neutral-300 p-2 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  aria-label="Message"
                >
                  <LuMail className="h-4 w-4" />
                </button>
                <FollowButton user={profile} />
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <h2 className="text-xl font-medium">{profile.displayName}</h2>
          <UserBadges user={profile} showCosmetic={true} />
          <AccountLabel label={profile.accountLabel} className="h-[18px] w-[18px]" />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-neutral-500">@{profile.username}</p>
          {!isOwnProfile && profile.isFollowingMe && (
            <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Follows you
            </span>
          )}
        </div>

        {profile.professionalStatus === "approved" && profile.professionalCategory && (
          <button
            onClick={() => setCategoryInfoOpen(true)}
            className="mt-2 inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            {profile.professionalCategory}
          </button>
        )}

        {profile.bio && <p className="mt-2 whitespace-pre-wrap text-[15px]">{renderContent(profile.bio, slug)}</p>}

        <div className="mt-3 flex gap-4 text-sm">
          <button onClick={() => setFollowModal("following")} className="hover:underline">
            <span className="font-medium">{profile.followingCount}</span> <span className="text-neutral-500">Following</span>
          </button>
          <button onClick={() => setFollowModal("followers")} className="hover:underline">
            <span className="font-medium">{profile.followersCount}</span> <span className="text-neutral-500">Followers</span>
          </button>
        </div>

        {!isOwnProfile && !isBlockedAny && (
          <MutualsRow username={profile.username} className="mt-2" onClick={() => setMutualsModalOpen(true)} />
        )}
      </div>

      {blockedByMe ? (
        <div className="p-10 text-center text-neutral-500">
          <p className="text-lg font-medium">You have blocked @{profile.username}</p>
          <p className="mt-1 text-sm">You must unblock this account to view their posts.</p>
        </div>
      ) : blockedByThem ? (
        <div className="p-10 text-center text-neutral-500">
          <p className="text-lg font-medium">You can't view this profile</p>
        </div>
      ) : locked ? (
        <div className="p-10 text-center text-neutral-500">
          <p className="text-lg font-medium">This account is private</p>
          <p className="mt-1 text-sm">Follow @{profile.username} to see their posts.</p>
        </div>
      ) : (
        <>
          <div className="relative flex border-b border-neutral-200 dark:border-neutral-800">
            {(["posts", "replies", "mentions"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-center text-sm font-medium capitalize transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900 ${
                  tab === t ? "text-black dark:text-white" : "text-neutral-500"
                }`}
              >
                {t}
              </button>
            ))}
            <div
              className="absolute bottom-0 left-0 h-0.5 w-1/3 rounded-full bg-brand transition-transform duration-300 ease-out"
              style={{ transform: `translateX(${["posts", "replies", "mentions"].indexOf(tab) * 100}%)` }}
            />
          </div>

          <div key={tab} className="motion-safe:animate-fade-in">
            {tab === "posts" && (
              <>
                {pinnedData?.post && (
                  <div>
                    <div className="flex items-center gap-1.5 px-4 pt-3 text-sm text-neutral-500">
                      <LuPin className="h-3.5 w-3.5" /> Pinned
                    </div>
                    <PostCard post={pinnedData.post} />
                  </div>
                )}
                {postsData?.posts.length === 0 && (
                  <p className="p-6 text-center text-neutral-400">
                    No posts in this community yet.
                  </p>
                )}
                {postsData?.posts
                  .filter((post) => post.id !== profile.pinnedPostId)
                  .map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
              </>
            )}

            {tab === "replies" && (
              <>
                {repliesData?.posts.length === 0 && (
                  <p className="p-6 text-center text-neutral-400">
                    No replies in this community yet.
                  </p>
                )}
                {repliesData?.posts.map((post) =>
                  post.inReplyTo ? (
                    <ReplyThreadPreview key={post.id} reply={post} />
                  ) : (
                    <PostCard key={post.id} post={post} />
                  )
                )}
              </>
            )}

            {tab === "mentions" && (
              <>
                {mentionsData?.posts.length === 0 && (
                  <p className="p-6 text-center text-neutral-400">
                    No mentions in this community yet.
                  </p>
                )}
                {mentionsData?.posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </>
            )}
          </div>
        </>
      )}

      {username && <FollowListModal username={username} mode={followModal} onClose={() => setFollowModal(null)} />}

      {username && (
        <MutualsModal username={username} open={mutualsModalOpen} onClose={() => setMutualsModalOpen(false)} />
      )}

      {profile.professionalCategory && (
        <Modal open={categoryInfoOpen} onClose={() => setCategoryInfoOpen(false)} title={profile.professionalCategory}>
          <p className="text-sm text-neutral-500">{CATEGORY_DESCRIPTIONS[profile.professionalCategory]}</p>
          {FICTIONAL_CATEGORIES.has(profile.professionalCategory) && (
            <p className="mt-2 text-sm text-neutral-500">
              This is a fictional roleplay account and is not affiliated with any real law enforcement, fire, or
              government agency.
            </p>
          )}
        </Modal>
      )}

      {storyViewerOpen && stories.length > 0 && (
        <StoryViewer
          groups={[{ author: profile, hasUnviewed: stories.some((s) => !s.isViewedByMe), stories }]}
          initialGroupIndex={0}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}
    </div>
  );
}
