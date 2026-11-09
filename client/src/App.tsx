import type { ReactNode } from "react";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { resolveUsernameAlias } from "./lib/usernameAliases";
import { ProtectedRoute, CommunityRoute, CommunityStaffRoute, CommunitySettingsRoute, PromoVideoRoute, GlobalRoute } from "./components/shared/ProtectedRoute";
import { CommunityProvider } from "./lib/communityContext";
import { AppLayout } from "./components/layout/AppLayout";
import { FlickerSpinner } from "./components/shared/FlickerSpinner";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const CopyrightRequestPage = lazy(() => import("./pages/CopyrightRequestPage"));
const BusinessGuidelinesPage = lazy(() => import("./pages/BusinessGuidelinesPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const ErrorStatusPage = lazy(() => import("./pages/ErrorStatusPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const PromoVideoPage = lazy(() => import("./pages/PromoVideoPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const BookmarksPage = lazy(() => import("./pages/BookmarksPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const MessageThreadPage = lazy(() => import("./pages/MessageThreadPage"));
const GroupMessageThreadPage = lazy(() => import("./pages/GroupMessageThreadPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const PostDetailPage = lazy(() => import("./pages/PostDetailPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const SettingsLayout = lazy(() => import("./pages/settings/SettingsLayout"));
const AccountSettings = lazy(() => import("./pages/settings/AccountSettings"));
const PrivacySettings = lazy(() => import("./pages/settings/PrivacySettings"));
const VerificationSettings = lazy(() => import("./pages/settings/VerificationSettings"));
const MiscellaneousSettings = lazy(() => import("./pages/settings/MiscellaneousSettings"));
const BusinessSettings = lazy(() => import("./pages/settings/BusinessSettings"));
const CommunitiesPage = lazy(() => import("./pages/communities/CommunitiesPage"));
const CreateCommunityPage = lazy(() => import("./pages/communities/CreateCommunityPage"));
const CommunitySettingsLayout = lazy(() => import("./pages/community-settings/CommunitySettingsLayout"));
const CommunityGeneralSettings = lazy(() => import("./pages/community-settings/CommunityGeneralSettings"));
const CommunityStaffSettings = lazy(() => import("./pages/community-settings/CommunityStaffSettings"));
const CommunityStaffLayout = lazy(() => import("./pages/community-staff/CommunityStaffLayout"));
const CommunityVerificationQueue = lazy(() => import("./pages/community-staff/CommunityVerificationQueue"));
const CommunityMembersPage = lazy(() => import("./pages/community-staff/CommunityMembersPage"));
const CommunityAuditLog = lazy(() => import("./pages/community-staff/CommunityAuditLog"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function RedirectToGlobalProfile() {
  const { username } = useParams<{ username: string }>();
  const location = useLocation();
  if (!username?.startsWith("@")) return <NotFoundPage />;
  return <Navigate to={`/${username}${location.search}`} replace />;
}

function AtUsernameRoute({ children }: { children: ReactNode }) {
  const { username } = useParams<{ username: string }>();
  const location = useLocation();
  if (!username?.startsWith("@")) return <NotFoundPage />;

  const alias = resolveUsernameAlias(username.slice(1));
  if (alias) {
    const target = location.pathname.replace(`/${username}`, `/@${alias}`);
    return <Navigate to={`${target}${location.search}`} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-black">
          <FlickerSpinner size={48} />
        </div>
      }
    >
      <Routes>
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/copyright" element={<CopyrightRequestPage />} />
      <Route path="/business-guidelines" element={<BusinessGuidelinesPage />} />
      <Route path="/applications" element={<ApplicationsPage />} />
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route path="/error/:code" element={<ErrorStatusPage />} />
      <Route
        path="/"
        element={
          <GlobalRoute guest={<LandingPage />}>
            <AppLayout />
          </GlobalRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/group/:groupId" element={<GroupMessageThreadPage />} />
        <Route path="messages/:username" element={<MessageThreadPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path=":username" element={<AtUsernameRoute><ProfilePage /></AtUsernameRoute>} />
        <Route path=":username/post/:postId" element={<AtUsernameRoute><PostDetailPage /></AtUsernameRoute>} />
      </Route>

      <Route path="/login" element={<AuthPage />} />
      <Route
        path="/welcome"
        element={
          <PromoVideoRoute>
            <PromoVideoPage />
          </PromoVideoRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute skipOnboardingCheck>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/communities"
        element={
          <ProtectedRoute personalOnly>
            <CommunitiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/communities/new"
        element={
          <ProtectedRoute personalOnly>
            <CreateCommunityPage />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<AccountSettings />} />
          <Route path="privacy" element={<PrivacySettings />} />
          <Route path="business" element={<BusinessSettings />} />
          <Route path="verification" element={<VerificationSettings />} />
          <Route path="misc" element={<MiscellaneousSettings />} />
        </Route>

      </Route>

      <Route
        path="/c/:communitySlug"
        element={
          <CommunityRoute>
            <AppLayout />
          </CommunityRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/group/:groupId" element={<GroupMessageThreadPage />} />
        <Route path="messages/:username" element={<MessageThreadPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />

        <Route
          path="settings"
          element={
            <CommunitySettingsRoute>
              <CommunitySettingsLayout />
            </CommunitySettingsRoute>
          }
        >
          <Route index element={<CommunityGeneralSettings />} />
          <Route path="staff" element={<CommunityStaffSettings />} />
        </Route>

        <Route
          path="staff"
          element={
            <CommunityStaffRoute>
              <CommunityStaffLayout />
            </CommunityStaffRoute>
          }
        >
          <Route index element={<CommunityMembersPage />} />
          <Route path="verification" element={<CommunityVerificationQueue />} />
          <Route path="audit-log" element={<CommunityAuditLog />} />
        </Route>

        <Route path=":username" element={<RedirectToGlobalProfile />} />
        <Route path=":username/post/:postId" element={<AtUsernameRoute><PostDetailPage /></AtUsernameRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
