import { useEffect, type ReactNode } from "react";
import { Navigate, Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { communityPath } from "../../lib/communityPath";
import { useAuth } from "../../lib/authContext";
import { useQueryClient } from "../../lib/queryStore";
import { CommunityProvider, useCommunity } from "../../lib/communityContext";
import { useSwitchToPersonal } from "../../hooks/useAccounts";
import { hasPermission } from "../../config/roles.config";
import { isGuestMode } from "../../lib/guestMode";
import { GuestLayout } from "../layout/GuestLayout";
import FlickerSpinner from "./FlickerSpinner";

function deactivatedRedirect(user: { deactivatedByStaff?: boolean }) {
  return user.deactivatedByStaff ? "/login?deactivated=staff" : "/login?deactivated=1";
}

export function ProtectedRoute({
  children,
  skipOnboardingCheck,
  personalOnly,
}: {
  children: ReactNode;
  skipOnboardingCheck?: boolean;
  personalOnly?: boolean;
}) {
  const { user, isLoading, refetch } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const switchToPersonal = useSwitchToPersonal();
  const needsPersonal =
    !!personalOnly && (user?.accountKind === "professional" || user?.accountKind === "business");

  useEffect(() => {
    if (!needsPersonal || switchToPersonal.isPending) return;
    switchToPersonal.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        refetch();
        navigate("/", { replace: true });
      },
    });
  }, [needsPersonal]);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><FlickerSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "deactivated") return <Navigate to={deactivatedRedirect(user)} replace />;
  if (!user.hasSeenPromoVideo) return <Navigate to="/welcome" replace />;
  if (!skipOnboardingCheck && !user.onboardingComplete) return <Navigate to="/onboarding" replace />;
  if (skipOnboardingCheck && user.onboardingComplete) return <Navigate to="/" replace />;
  if (needsPersonal) return <div className="flex h-screen items-center justify-center"><FlickerSpinner /></div>;

  return <>{children}</>;
}

export function PromoVideoRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="flex h-screen items-center justify-center"><FlickerSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "deactivated") return <Navigate to={deactivatedRedirect(user)} replace />;
  if (user.hasSeenPromoVideo) return <Navigate to={user.onboardingComplete ? "/" : "/onboarding"} replace />;

  return <>{children}</>;
}


function CommunityGuard({ children }: { children: ReactNode }) {
  const { community, isLoading, error } = useCommunity();
  const { communitySlug } = useParams<{ communitySlug: string }>();
  const { user } = useAuth();
  const location = useLocation();

  const accountBlocked = user?.status === "suspended" || user?.status === "banned";

  if (isLoading) return <div className="flex h-screen items-center justify-center"><FlickerSpinner /></div>;
  if (accountBlocked) return null;
  if (error || !community) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-medium">This community doesn't exist, or you don't have access to it.</p>
        <p className="text-sm text-neutral-500">You'll need an invite code from a member to join.</p>
        <Link to="/communities" className="mt-2 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white">
          Back to your communities
        </Link>
      </div>
    );
  }

  if (communitySlug && community.slug !== communitySlug) {
    const rest = location.pathname.slice(`/c/${communitySlug}`.length).replace(/^\//, "");
    return <Navigate to={`${communityPath(community.slug, rest)}${location.search}`} replace />;
  }

  return <>{children}</>;
}

export function CommunityRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="flex h-screen items-center justify-center"><FlickerSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "deactivated") return <Navigate to={deactivatedRedirect(user)} replace />;
  if (!user.hasSeenPromoVideo) return <Navigate to="/welcome" replace />;
  if (!user.onboardingComplete) return <Navigate to="/onboarding" replace />;

  return (
    <CommunityProvider>
      <CommunityGuard>{children}</CommunityGuard>
    </CommunityProvider>
  );
}

export function GlobalRoute({ guest, children }: { guest: ReactNode; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="flex h-screen items-center justify-center"><FlickerSpinner /></div>;
  if (!user) {
    if (isGuestMode()) {
      return (
        <CommunityProvider>
          <GuestLayout />
        </CommunityProvider>
      );
    }
    return location.pathname === "/" ? <>{guest}</> : <Navigate to="/login" replace />;
  }
  if (user.status === "deactivated") return <Navigate to={deactivatedRedirect(user)} replace />;
  if (!user.hasSeenPromoVideo) return <Navigate to="/welcome" replace />;
  if (!user.onboardingComplete) return <Navigate to="/onboarding" replace />;

  return (
    <CommunityProvider>
      <CommunityGuard>{children}</CommunityGuard>
    </CommunityProvider>
  );
}

export function CommunitySettingsRoute({ children }: { children: ReactNode }) {
  const { community, canManageCommunity, isLoading } = useCommunity();
  if (isLoading) return <div className="flex h-screen items-center justify-center"><FlickerSpinner /></div>;
  if (community?.isGlobal) return <Navigate to="/" replace />;
  if (!canManageCommunity) return <Navigate to={communityPath(community?.slug)} replace />;
  return <>{children}</>;
}

export function CommunityStaffRoute({ children }: { children: ReactNode }) {
  const { isStaff, isLoading } = useCommunity();
  if (isLoading) return <div className="flex h-screen items-center justify-center"><FlickerSpinner /></div>;
  if (!isStaff) return <Navigate to=".." replace />;
  return <>{children}</>;
}
