export type StaffRank = "staff" | "admin" | "developer" | "owner";
export type PlatformRole = "user" | "official" | StaffRank;
export type AssignableRole = "user" | "staff" | "admin" | "developer";

export const RANK_LEVEL: Record<string, number> = {
  user: 0,
  official: 0,
  staff: 1,
  admin: 2,
  developer: 3,
  owner: 4,
};

export interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: PlatformRole;
}

export interface StaffContext {
  role: PlatformRole;
  isGlobalStaff: boolean;
  isAdmin: boolean;
  canViewPrivateData: boolean;
  canViewDiscordIdentity: boolean;
  assignableRoles: AssignableRole[];
  communityRoles: Record<string, "owner" | "staff">;
}

export interface StaffSessionResponse {
  user: StaffUser;
  staff: StaffContext;
}

export interface ReportTargetUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified?: boolean;
  accountLabel?: string;
}

export interface ReportSnapshot {
  kind: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  gifUrl: string | null;
  pollOptions: string[];
  authorId?: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  postedAt: string | null;
}

export interface ReportPost {
  id: string;
  content: string;
  mediaUrl?: string | null;
  author: ReportTargetUser | null;
  createdAt: string;
}

export interface ReportMessage {
  id: string;
  sender: ReportTargetUser | null;
  content: string;
  createdAt: string;
}

export interface StaffReport {
  id: string;
  reporter: ReportTargetUser | null;
  source: "user" | "ai";
  communitySlug: string | null;
  communityName: string | null;
  targetType: "post" | "user" | "message";
  targetId: string;
  targetPost: ReportPost | null;
  targetUser: ReportTargetUser | null;
  targetMessage: ReportMessage | null;
  contentSnapshot: string | null;
  snapshot: ReportSnapshot | null;
  reason: string;
  details: string;
  status: "pending" | "actioned" | "dismissed";
  actionTaken: string;
  staffNote: string;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ReportPage {
  items: StaffReport[];
  nextCursor: string | null;
}

export interface Mailbox {
  key: string;
  label: string;
  address: string;
  compose?: boolean;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

export interface EmailMessage {
  id: string;
  messageId: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html?: string;
  text?: string;
  headers: Record<string, any>;
  read: boolean;
  deliveryStatus: string;
  receivedAt?: string;
  sentAt?: string;
  createdAt: string;
  attachments: EmailAttachment[];
}

export interface InternalNote {
  id: string;
  conversationId: string;
  author: StaffUser;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDraft {
  id: string;
  conversationId: string;
  author: StaffUser;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailConversation {
  id: string;
  subject: string;
  status: "open" | "claimed" | "pending_staff" | "waiting_customer" | "resolved" | "closed";
  mailbox?: string;
  customerEmail: string;
  claimedBy?: StaffUser | null;
  claimedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  emailCount?: number;
  notesCount?: number;
  unreadCount?: number;
  hasAttachments?: boolean;
  lastMessageAt?: string;
  emails?: EmailMessage[];
  internalNotes?: InternalNote[];
  drafts?: EmailDraft[];
}

export interface QueueCounts {
  reports: {
    pending: number;
    aiPending: number;
    actioned: number;
    dismissed: number;
  };
  verification: { pending: number };
  copyright: { pending: number };
  staffApplications: { pending: number };
  businessApplications: { pending: number };
}

export interface UserPostsPage {
  items: {
    id: string;
    content: string;
    communitySlug: string | null;
    deleted: boolean;
    moderationStatus: string | null;
    hasMedia: boolean;
    isReply: boolean;
    isRepost: boolean;
    likesCount: number;
    commentsCount: number;
    createdAt: string;
  }[];
  nextCursor: string | null;
}

export interface UserReportsPage {
  direction: "against" | "filed";
  items: {
    id: string;
    source: string;
    targetType: string;
    targetId: string;
    reason: string;
    status: string;
    actionTaken: string;
    content: string;
    targetAuthor: string | null;
    targetCommunitySlug: string | null;
    targetDeleted: boolean;
    reporter: StaffUser | null;
    reviewedBy: StaffUser | null;
    createdAt: string;
  }[];
  nextCursor: string | null;
}

export interface SavedSearch {
  id: string;
  name: string;
  panelId: string;
  query: Record<string, unknown>;
  isShared: boolean;
  owner: StaffUser | null;
  updatedAt: string;
}

export interface SavedSearchesResponse {
  searches: SavedSearch[];
  shared: SavedSearch[];
}

export interface StaffNoteEntry {
  id: string;
  body: string;
  targetType: string | null;
  targetId: string | null;
  pinned: boolean;
  author: StaffUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffNotesResponse {
  notes: StaffNoteEntry[];
}

export interface AiCategoryResponse {
  days: number;
  total: number;
  categories: {
    category: string;
    total: number;
    pending: number;
    actioned: number;
    dismissed: number;
    falsePositiveRate: number | null;
  }[];
  verdicts: { verdict: string; count: number }[];
}

export interface AiFalsePositivePage {
  items: {
    id: string;
    verdict: string;
    categories: string[];
    reason: string;
    content: string;
    targetType: string;
    targetId: string;
    communityName: string | null;
    reviewedBy: StaffUser | null;
    reviewedAt: string | null;
    staffNote: string;
    stillLive: boolean | null;
    createdAt: string;
  }[];
  nextCursor: string | null;
}

export interface AiStuckResponse {
  total: number;
  maxAttempts: number;
  oldestPendingAt: string | null;
  byAttempt: { attempts: number; count: number; exhausted: boolean }[];
  items: {
    id: string;
    content: string;
    author: StaffUser | null;
    attempts: number;
    exhausted: boolean;
    hasMedia: boolean;
    createdAt: string;
  }[];
}

export interface StaffActivityResponse {
  days: number;
  total: number;
  staff: {
    staff: StaffUser | null;
    staffId: string;
    count: number;
    lastActionAt: string | null;
    actions: { action: string; count: number }[];
  }[];
  actions: { action: string; count: number }[];
}

export interface SelectionFocus {
  channel: string;
  id: string;
}

export interface PresenceEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  connections: number;
  focus: SelectionFocus | null;
  since: number;
}

export interface StaffClaim {
  resource: string;
  userId: string;
  username: string;
  claimedAt: number;
  expiresAt: number;
}

export interface PresenceSnapshot {
  staff: PresenceEntry[];
  claims: StaffClaim[];
  at: number;
}

export interface StaffMember extends ReportTargetUser {
  role: PlatformRole;
}

export interface UserLookupResult extends ReportTargetUser {
  role?: PlatformRole;
  status?: string;
}

export interface BannedIp {
  id: string;
  ipHash: string;
  handle: string;
  reason: string;
  bannedBy: ReportTargetUser | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface SecurityFlagGroup {
  key: string;
  label: string;
  user: ReportTargetUser | null;
  isBanned: boolean;
  count: number;
  lastSeenAt: string;
}

export interface SecurityFlagDetail {
  id: string;
  type: string;
  network: string;
  path: string;
  method: string;
  userAgent: string | null;
  user: ReportTargetUser | null;
  meta: unknown;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  staff: ReportTargetUser | null;
  action: string;
  targetType: string;
  targetId: string | null;
  targetUser: ReportTargetUser | null;
  targetLabel: string;
  meta: unknown;
  important: boolean;
  undoable?: boolean;
  undone?: boolean;
  createdAt: string;
}

export interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
}

export interface StaffSessionRow {
  id: string;
  jti: string;
  user: ReportTargetUser | null;
  network: string;
  userAgent: string;
  lastSeenAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
  revokedBy: ReportTargetUser | null;
  isActive: boolean;
  isCurrent: boolean;
  createdAt: string;
}

export interface VerificationApplication {
  id: string;
  user: ReportTargetUser;
  reason: string;
  status: string;
  createdAt: string;
}

export interface VerificationPage {
  applications: VerificationApplication[];
  nextCursor: string | null;
}

export interface ScenarioResponse {
  question: string;
  answer: string;
}

export interface StaffApplicationRow {
  id: string;
  discordUsername: string;
  position: string;
  department: string | null;
  motivation: string;
  experience: string;
  scenarioResponses: ScenarioResponse[];
  status: string;
  staffNote: string;
  createdAt: string;
}

export interface BusinessApplicationRow {
  id: string;
  name: string;
  bio: string;
  logoUrl: string;
  bannerUrl: string;
  status: string;
  staffNote: string;
  businessUserId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  applicant: ReportTargetUser;
  discord: {
    inviteUrl: string;
    guildId: string | null;
    guildName: string;
    guildIconUrl: string;
    memberCount: number;
    presenceCount: number;
    checkedAt: string | null;
  };
  guidelinesAcceptedAt: string | null;
}

export interface BusinessAccountRow {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  createdAt: string;
  accountLabel: string;
  owner: ReportTargetUser | null;
  postsCount: number;
  followersCount: number;
  collaboratorCount: number;
}

export interface DeletedBusinessRow {
  id: string;
  businessUserId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  ownerId: string | null;
  ownerUsername: string;
  collaborators: { id: string; username: string; displayName: string; role: string }[];
  discord: {
    inviteUrl: string;
    guildId: string | null;
    guildName: string;
    memberCount: number;
  };
  postsCount: number;
  followersCount: number;
  approvedAt: string | null;
  accountCreatedAt: string | null;
  reason: string;
  deletedByUsername: string;
  deletedAt: string;
}

export interface CopyrightRequestRow {
  id: string;
  requesterName: string;
  requesterEmail: string;
  copyrightedWork: string;
  infringingUrls: string[];
  details: string;
  signature: string;
  status: string;
  staffNote: string;
  createdAt: string;
}

export interface SuspensionRow {
  id: string;
  kind: string;
  reason: string | null;
  until: string | null;
  active: boolean;
  issuedBy: string | null;
  liftedAt: string | null;
  liftedBy: string | null;
  createdAt: string;
}

export interface DiscordIdentity {
  id: string;
  username: string;
  profileUrl: string;
  accountCreatedAt: string | null;
  isOwner: boolean;
  ban: {
    reason: string;
    createdAt: string;
    bannedBy: string | null;
  } | null;
  linkedAccounts: {
    id: string;
    username: string;
    displayName: string;
    status: string;
    accountKind: string;
    createdAt: string;
  }[];
}

export interface UserDossierResponse {
  user: ReportTargetUser & { role: string; status: string; badges?: string[] };
  discord: DiscordIdentity | null;
  account: {
    id: string;
    discordId?: string;
    discordUsername?: string;
    createdAt: string;
    lastActiveAt: string | null;
    verificationStatus: string;
    suspendedUntil: string | null;
    suspendReason: string | null;
  };
  stats: {
    postsTotal: number;
    postsDeleted: number;
    replies: number;
    reposts: number;
    followers: number;
    following: number;
    messagesSent: number;
    impressions: number;
  };
  moderation: {
    reportsFiled: number;
    reportsAgainst: number;
    reportsAgainstPosts: number;
    suspensions: SuspensionRow[];
  };
  communities: {
    id: string;
    name: string;
    slug: string;
    role: string;
    status: string;
    postsCount: number;
  }[];
}
