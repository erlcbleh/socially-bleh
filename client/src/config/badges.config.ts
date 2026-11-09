import React from "react";
import { VscVerifiedFilled } from "react-icons/vsc";
import { LuCodeXml, LuHeartHandshake, LuBug, LuClapperboard, LuDollarSign, LuCrown, LuShieldCheck } from "react-icons/lu";

export type BadgeCategory = "role" | "verification" | "cosmetic";

export interface UserLike {
  role?: string;
  accountKind?: string;
  isVerified?: boolean;
  professionalStatus?: string;
  communityVerificationStatus?: string;
  badges?: string[];
  equippedBadges?: string[];
  communityRole?: string;
}

export interface BadgeDef {
  id: string;
  name: string;
  category: BadgeCategory;
  tooltip: string;
  iconType: "react-icon" | "image";
  icon?: React.ComponentType<{ className?: string; "aria-label"?: string }>;
  src?: string;
  colorClass?: string;
  isQualified: (user: UserLike) => boolean;
}

export const BADGES: Record<string, BadgeDef> = {
  owner: {
    id: "owner",
    name: "Socially Owner",
    category: "role",
    tooltip: "Socially Owner",
    iconType: "react-icon",
    icon: LuCrown,
    colorClass: "text-amber-500 dark:text-amber-400",
    isQualified: (u) => u.role === "owner",
  },
  developer: {
    id: "developer",
    name: "Socially Developer",
    category: "role",
    tooltip: "Socially Developer",
    iconType: "react-icon",
    icon: LuCodeXml,
    colorClass: "text-brand",
    isQualified: (u) => u.role === "developer",
  },
  admin: {
    id: "admin",
    name: "Socially Admin",
    category: "role",
    tooltip: "Socially Admin",
    iconType: "image",
    src: "/logo-blue.svg",
    isQualified: (u) => u.role === "admin",
  },
  staff: {
    id: "staff",
    name: "Socially Staff",
    category: "role",
    tooltip: "Socially Staff",
    iconType: "image",
    src: "/logo-blue.svg",
    isQualified: (u) => u.role === "staff",
  },
  official: {
    id: "official",
    name: "Socially Official",
    category: "role",
    tooltip: "Socially Official",
    iconType: "image",
    src: "/logo-blue.svg",
    isQualified: (u) => u.role === "official",
  },
  community_owner: {
    id: "community_owner",
    name: "Community Owner",
    category: "role",
    tooltip: "Community Owner",
    iconType: "react-icon",
    icon: LuCrown,
    colorClass: "text-amber-500 dark:text-amber-400",
    isQualified: (u) => u.communityRole === "owner",
  },
  community_moderator: {
    id: "community_moderator",
    name: "Community Moderator",
    category: "role",
    tooltip: "Community Moderator",
    iconType: "react-icon",
    icon: LuShieldCheck,
    colorClass: "text-blue-500 dark:text-blue-400",
    isQualified: (u) => u.communityRole === "staff" || u.communityRole === "moderator",
  },
  business_verified: {
    id: "business_verified",
    name: "Business Account",
    category: "verification",
    tooltip: "Business account",
    iconType: "react-icon",
    icon: VscVerifiedFilled,
    colorClass: "text-amber-500",
    isQualified: (u) => u.accountKind === "business",
  },
  professional_verified: {
    id: "professional_verified",
    name: "Verified Professional",
    category: "verification",
    tooltip: "Verified professional account",
    iconType: "react-icon",
    icon: VscVerifiedFilled,
    colorClass: "text-amber-500",
    isQualified: (u) => u.professionalStatus === "approved",
  },
  global_verified: {
    id: "global_verified",
    name: "Verified Account",
    category: "verification",
    tooltip: "Verified account",
    iconType: "react-icon",
    icon: VscVerifiedFilled,
    colorClass: "text-brand",
    isQualified: (u) => !!u.isVerified,
  },
  community_verified: {
    id: "community_verified",
    name: "Community Verified",
    category: "verification",
    tooltip: "Verified in this community",
    iconType: "react-icon",
    icon: VscVerifiedFilled,
    colorClass: "text-black dark:text-white",
    isQualified: (u) => u.communityVerificationStatus === "approved",
  },
  early_supporter: {
    id: "early_supporter",
    name: "Early Supporter",
    category: "cosmetic",
    tooltip: "Early Supporter",
    iconType: "react-icon",
    icon: LuHeartHandshake,
    colorClass: "text-purple-500 dark:text-purple-400",
    isQualified: (u) => u.badges?.includes("early_supporter") || false,
  },
  bug_hunter: {
    id: "bug_hunter",
    name: "Bug Hunter",
    category: "cosmetic",
    tooltip: "Bug Hunter",
    iconType: "react-icon",
    icon: LuBug,
    colorClass: "text-emerald-500 dark:text-emerald-400",
    isQualified: (u) => u.badges?.includes("bug_hunter") || false,
  },
  contributor: {
    id: "contributor",
    name: "Contributor",
    category: "cosmetic",
    tooltip: "Contributor",
    iconType: "react-icon",
    icon: LuDollarSign,
    colorClass: "text-green-500 dark:text-green-400",
    isQualified: (u) => u.badges?.includes("contributor") || false,
  },
  content_creator: {
    id: "content_creator",
    name: "Content Creator",
    category: "cosmetic",
    tooltip: "Content Creator",
    iconType: "react-icon",
    icon: LuClapperboard,
    colorClass: "text-rose-500 dark:text-rose-400",
    isQualified: (u) => u.badges?.includes("content_creator") || u.badges?.includes("creator") || false,
  },
};

const BADGE_PRIO: Record<string, number> = {
  owner: 10,
  developer: 20,
  admin: 30,
  staff: 40,
  official: 50,
  community_owner: 60,
  community_moderator: 70,
  global_verified: 80,
  business_verified: 90,
  professional_verified: 100, // do we need to delete all professional stuff? since businesses. if so, rm all this stuff
  community_verified: 110,
  early_supporter: 120,
  bug_hunter: 130,
  contributor: 140,
  content_creator: 150,
};

export function sortBadgesByPrio(badges: BadgeDef[]): BadgeDef[] {
  return [...badges].sort((a, b) => {
    const pA = BADGE_PRIO[a.id] ?? 999;
    const pB = BADGE_PRIO[b.id] ?? 999;
    return pA - pB;
  });
}

export function getAllQualifiedBadges(user: UserLike | undefined | null): BadgeDef[] {
  if (!user) return [];
  const qualified = Object.values(BADGES).filter((badge) => badge.isQualified(user));
  return sortBadgesByPrio(qualified);
}

export function getQualifiedBadges(user: UserLike | undefined | null): BadgeDef[] {
  if (!user) return [];
  const allQualified = getAllQualifiedBadges(user);

  const alwaysShow = allQualified.filter(
    (b) =>
      b.id === "community_owner" ||
      b.id === "community_moderator" ||
      b.id === "business_verified"
  );
  const alwaysShowIds = new Set(alwaysShow.map((b) => b.id));
  const selectable = allQualified.filter((b) => !alwaysShowIds.has(b.id));

  let selected: BadgeDef[] = [];

  if (Array.isArray(user.equippedBadges)) {
    const equipped = user.equippedBadges
      .map((id) => selectable.find((b) => b.id === id))
      .filter((b): b is BadgeDef => b !== undefined);

    selected = sortBadgesByPrio(equipped).slice(0, 3);
  } else {
    selected = sortBadgesByPrio(selectable).slice(0, 3);
  }

  return sortBadgesByPrio([...alwaysShow, ...selected]);
}
