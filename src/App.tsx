import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { RouteGuard } from './components/layout/RouteGuard';

// Pages
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { ReelsPage } from './pages/ReelsPage';
import { LearnPage } from './pages/LearnPage';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SavedPage } from './pages/SavedPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { CommunityDetailPage } from './pages/CommunityDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Main Feed */}
          <Route
            path="/"
            element={
              <RouteGuard>
                <AppShell>
                  <HomePage />
                </AppShell>
              </RouteGuard>
            }
          />
          <Route path="/home" element={<Navigate to="/" replace />} />

          {/* Explore / Discovery (Publicly accessible) */}
          <Route
            path="/explore"
            element={
              <AppShell>
                <ExplorePage />
              </AppShell>
            }
          />

          {/* Reels (Publicly accessible) */}
          <Route
            path="/reels"
            element={
              <AppShell>
                <ReelsPage />
              </AppShell>
            }
          />

          {/* Peer Learning Hub (Core Differentiator, Authenticated) */}
          <Route
            path="/learn"
            element={
              <RouteGuard>
                <AppShell>
                  <LearnPage />
                </AppShell>
              </RouteGuard>
            }
          />

          {/* Direct Messages (Authenticated) */}
          <Route
            path="/messages"
            element={
              <RouteGuard>
                <AppShell>
                  <MessagesPage />
                </AppShell>
              </RouteGuard>
            }
          />

          {/* Notifications (Authenticated) */}
          <Route
            path="/notifications"
            element={
              <RouteGuard>
                <AppShell>
                  <NotificationsPage />
                </AppShell>
              </RouteGuard>
            }
          />

          {/* Saved Bookmarks (Authenticated) */}
          <Route
            path="/saved"
            element={
              <RouteGuard>
                <AppShell>
                  <SavedPage />
                </AppShell>
              </RouteGuard>
            }
          />

          {/* Communities (Publicly discoverable) */}
          <Route
            path="/communities"
            element={
              <AppShell>
                <CommunitiesPage />
              </AppShell>
            }
          />
          <Route
            path="/communities/:communityId"
            element={
              <AppShell>
                <CommunityDetailPage />
              </AppShell>
            }
          />

          {/* User Profiles */}
          <Route
            path="/u/:username"
            element={
              <AppShell>
                <ProfilePage />
              </AppShell>
            }
          />
          <Route
            path="/profile"
            element={
              <RouteGuard>
                <AppShell>
                  <ProfilePage />
                </AppShell>
              </RouteGuard>
            }
          />

          {/* Settings & Privacy (Authenticated) */}
          <Route
            path="/settings"
            element={
              <RouteGuard>
                <AppShell>
                  <SettingsPage />
                </AppShell>
              </RouteGuard>
            }
          />

          {/* 404 Catch-All */}
          <Route
            path="*"
            element={
              <AppShell>
                <NotFoundPage />
              </AppShell>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
