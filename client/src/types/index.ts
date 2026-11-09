export type VerificationStatus = "none" | "pending" | "approved" | "rejected" | "cancelled";
export type AccountStatus = "active" | "suspended" | "banned" | "deactivated";
export type ProfessionalCategory = "Law Enforcement" | "Fire Department" | "DOT" | "Business";
export type ProfessionalStatus = "none" | "pending" | "approved" | "rejected" | "spun_off";
export type CommunityVerificationStatus = "none" | "pending" | "invited" | "approved" | "rejected";
export type AccountKind = "personal" | "professional" | "business";
export type CommunityRole = "owner" | "staff" | "member";
export type CommunityMemberStatus = "active" | "kicked" | "banned";

export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  isPrivate: boolean;
  hideFollowing: boolean;
  hideProfileMedia: boolean;
  restrictMessages: boolean;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  interests: string[];
  role: "user" | "official" | "staff" | "admin" | "developer";
  badges?: string[];
  equippedBadges?: string[];
  status: AccountStatus | "deleted";
  isDeleted?: boolean;
  deactivatedByStaff?: boolean;
  suspendedUntil?: string | null;
  suspendReason?: string | null;
  usernameChangeAvailableAt?: string | null;
  onboardingComplete: boolean;
  hasSeenPromoVideo: boolean;
  accountKind?: AccountKind;
  accountLabel?: string;
  isBusinessOwner?: boolean;
  communityRole?: CommunityRole;
  professionalCategory: ProfessionalCategory | null;
  professionalStatus: ProfessionalStatus;
  communityVerificationStatus: CommunityVerificationStatus;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  pinnedPostId?: string | null;
  discordUsername?: string;
  isFollowedByMe?: boolean;
  isFollowingMe?: boolean;
  followStatus?: "accepted" | "pending" | null;
  isBlockedByMe?: boolean;
  hasBlockedMe?: boolean;
  isMutedByMe?: boolean;
  createdAt: string;
}

export type CommunityJoinPolicy = "open" | "invite";

export interface DiscoverableCommunity {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  memberCount: number;
  myStatus: CommunityMemberStatus | null;
}

export interface InvitePreview {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  memberCount: number;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  inviteCode?: string;
  joinPolicy: CommunityJoinPolicy;
  isGlobal: boolean;
  memberCount: number;
  postCount: number;
  ownerId: string;
  myRole?: CommunityRole;
  myStatus?: CommunityMemberStatus;
  myProfessionalCategory: ProfessionalCategory | null;
  myProfessionalReason: string | null;
  myProfessionalStatus: ProfessionalStatus;
  myProfessionalProfileId: string | null;
  myBannedReason: string | null;
  myBannedUntil: string | null;
  verificationFollowerThreshold: number;
  verificationApplicationsOnly: boolean;
  hasDiscordWebhook: boolean;
  discordWebhookChannelId: string | null;
  discordWebhookChannelName: string | null;
  myVerificationStatus: CommunityVerificationStatus;
  myVerificationReason: string | null;
  myFollowersCount: number;
  createdAt: string;
}

export interface CommunityMember extends User {
  membershipStatus: CommunityMemberStatus;
  isOnline: boolean;
}

export interface LinkedAccount {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string;
  accountKind: AccountKind;
  onboardingComplete: boolean;
  professionalCommunity: { name: string; slug: string } | null;
}

export interface ProfessionalApplication {
  membershipId: string;
  user: User;
  category: ProfessionalCategory;
  reason: string | null;
  createdAt: string;
}

export interface CommunityVerificationApplication {
  membershipId: string;
  user: User;
  reason: string | null;
  createdAt: string;
}

export interface Poll {
  options: { text: string; votesCount: number }[];
  imageUrl?: string;
  totalVotes: number;
  expiresAt: string;
  isExpired: boolean;
  myVote: number | null;
}

export interface Post {
  id: string;
  shortId?: string;
  communitySlug?: string;
  author: User;
  content: string;
  gifUrl?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  poll?: Poll;
  editedAt?: string;
  deleted?: boolean;
  parentPost?: string;
  inReplyTo?: Post | null;
  quotedPost?: Post | null;
  repostOf?: Post | null;
  likesCount: number;
  repostsCount: number;
  commentsCount: number;
  impressionsCount: number;
  isLikedByMe?: boolean;
  isRepostedByMe?: boolean;
  isBookmarkedByMe?: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  actor: User | null;
  type:
    | "like"
    | "repost"
    | "comment"
    | "quote"
    | "follow"
    | "follow_request"
    | "follow_accept"
    | "verification_approved"
    | "verification_rejected"
    | "professional_approved"
    | "professional_rejected"
    | "community_verification_approved"
    | "community_verification_rejected"
    | "community_verification_invited"
    | "mention"
    | "poll_ended"
    | "report_actioned"
    | "report_dismissed"
    | "content_flagged"
    | "content_flag_dismissed"
    | "content_flag_actioned"
    | "business_approved"
    | "business_rejected";
  post?: Post | null;
  community?: { id: string; name: string; slug: string; isGlobal: boolean } | null;
  note?: string | null;
  read: boolean;
  createdAt: string;
}

export interface ReportedMessage {
  id: string;
  sender: User | null;
  content: string;
  createdAt: string;
}

export interface ReportSnapshot {
  kind: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  gifUrl?: string | null;
  pollOptions?: string[];
  authorId?: string;
  authorUsername?: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  postedAt?: string | null;
}

export interface Report {
  id: string;
  reporter?: User | null;
  communitySlug?: string | null;
  targetType: "post" | "user" | "message";
  targetId: string;
  targetPost?: Post | null;
  targetUser?: User | null;
  targetMessage?: ReportedMessage | null;
  contentSnapshot?: string | null;
  snapshot?: ReportSnapshot | null;
  reason: string;
  details: string;
  status: "pending" | "actioned" | "dismissed";
  actionTaken?: string;
  staffNote?: string;
  createdAt: string;
}

export interface VerificationApplication {
  id: string;
  user: User;
  reason: string;
  status: VerificationStatus;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  staff: User | null;
  action: string;
  targetType: "report" | "post" | "user" | "copyright_request" | "verification_application";
  targetUser: User | null;
  targetLabel: string;
  communitySlug?: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface CopyrightRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  copyrightedWork: string;
  infringingUrls: string[];
  details: string;
  signature: string;
  status: "pending" | "resolved" | "dismissed";
  staffNote: string;
  createdAt: string;
}

export interface StaffApplication {
  id: string;
  discordUsername: string;
  position: string;
  department: string | null;
  motivation: string;
  experience: string;
  scenarioResponses: { question: string; answer: string }[];
  status: "pending" | "accepted" | "rejected";
  staffNote: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  profileViews: number;
  impressions: number;
  clicks: number;
  series: { date: string; profileViews: number; impressions: number; clicks: number }[];
}

export interface ConversationSummary {
  id: string;
  isGroup: boolean;
  otherUser: User | null;
  groupName: string | null;
  groupParticipants: User[] | null;
  blockedByOther?: boolean;
  lastMessageText: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface GroupConversation {
  id: string;
  isGroup: true;
  name: string;
  iconUrl: string;
  createdBy: string | null;
  isCreator: boolean;
  participants: User[];
  lastMessageText: string;
  lastMessageAt: string | null;
}

export interface SharedStoryRef {
  id: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
}

export type MessageStatus = "sent" | "delivered" | "read";

export interface Message {
  id: string;
  sender: string;
  status?: MessageStatus;
  content: string;
  sharedPost?: Post | null;
  sharedPostUnavailable?: boolean;
  sharedStory?: SharedStoryRef | null;
  sharedStoryUnavailable?: boolean;
  mediaUrl?: string | null;
  gifUrl?: string | null;
  reactions?: MessageReaction[];
  editedAt?: string | null;
  deleted?: boolean;
  moderation?: "pending" | "clear" | "blocked";
  moderationReason?: string | null;
  createdAt: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface TypingUser {
  id: string;
  username: string;
  displayName: string;
}

export interface TrendingTag {
  tag: string;
  count: number;
}

export interface Story {
  id: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  createdAt: string;
  expiresAt: string;
  isViewedByMe: boolean;
}

export interface StoryGroup {
  author: User;
  hasUnviewed: boolean;
  stories: Story[];
}


export interface StaffUserDetails {
  user: User;
  account: {
    id: string;
    discordId: string;
    discordUsername: string;
    createdAt: string;
    updatedAt: string;
    lastActiveAt: string | null;
    onboardingComplete: boolean;
    accountKind: AccountKind;
    professionalCommunity: { id: string; name: string; slug: string } | null;
    isPrivate: boolean;
    restrictMessages: boolean;
    hideFollowing: boolean;
    hideProfileMedia: boolean;
    isVerified: boolean;
    verificationStatus: VerificationStatus;
    interests: string[];
    tokenVersion: number;
    suspendedUntil: string | null;
    suspendReason: string | null;
  };
  stats: {
    postsTotal: number;
    postsDeleted: number;
    originalPosts: number;
    replies: number;
    reposts: number;
    likesGiven: number;
    stories: number;
    messagesSent: number;
    conversations: number;
    followers: number;
    following: number;
    followRequestsPending: number;
    blocksMade: number;
    likesReceived: number;
    repostsReceived: number;
    commentsReceived: number;
    impressions: number;
    firstPostAt: string | null;
    lastPostAt: string | null;
    lastMessageAt: string | null;
  };
  moderation: {
    reportsFiled: number;
    reportsAgainst: number;
    reportsAgainstPosts: number;
    suspensions: {
      id: string;
      kind: "suspend" | "ban";
      reason: string;
      until: string | null;
      active: boolean;
      issuedBy: string | null;
      liftedAt: string | null;
      liftedBy: string | null;
      createdAt: string;
    }[];
  };
  communities: {
    id: string;
    name: string;
    slug: string;
    role: CommunityRole;
    status: CommunityMemberStatus;
    postsCount: number;
    professionalCategory: ProfessionalCategory | null;
    professionalStatus: ProfessionalStatus;
    verificationStatus: CommunityVerificationStatus;
    joinedAt: string;
  }[];
}

export interface MutualUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface MutualsSummary {
  count: number;
  users: MutualUser[];
}

export interface PollOptionVoters {
  index: number;
  text: string;
  votesCount: number;
  voters: User[];
}

export interface PollVoters {
  options: PollOptionVoters[];
  truncated: boolean;
}
