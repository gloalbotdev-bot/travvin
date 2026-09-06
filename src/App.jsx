import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Landing from '@/pages/Landing';
import Welcome from '@/pages/Welcome';
import CustomerChat from '@/pages/CustomerChat';
import Promotions from '@/pages/Promotions';
import OwnerPanel from '@/pages/OwnerPanel';
import SuperAdminPanel from '@/pages/SuperAdminPanel';
import JoinAsOwner from '@/pages/JoinAsOwner';
import AccountSettings from '@/pages/AccountSettings';
import CustomerPortal from '@/pages/CustomerPortal';
import AdminLogin from '@/pages/AdminLogin';
import DesktopSearch from '@/pages/DesktopSearch';
import Discover from '@/pages/Discover';
import OwnerProfile from '@/pages/OwnerProfile';
import RoleGate from '@/components/auth/RoleGate';

const PUBLIC_PATHS = ['/', '/welcome', '/admin-login', '/discover'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  // Public pages — render immediately without auth checks (including the whole /discover area)
  if (PUBLIC_PATHS.includes(location.pathname) || location.pathname.startsWith('/discover')) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/discover/owner/:ownerId" element={<OwnerProfile />} />
        <Route path="/CustomerChat" element={<Navigate to="/chat" replace />} />
        <Route path="/customer-chat" element={<Navigate to="/chat" replace />} />
        <Route path="/CustomerPortal" element={<Navigate to="/customer-portal" replace />} />
        <Route path="/DesktopSearch" element={<Navigate to="/desktop-search" replace />} />
      </Routes>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#ECE5DD]">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-[#25D366] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/discover" element={<Discover />} />
      <Route path="/discover/owner/:ownerId" element={<OwnerProfile />} />
      <Route path="/chat" element={<RoleGate allow={['user']} allowGuest><CustomerChat /></RoleGate>} />
      <Route path="/promotions" element={<RoleGate allow={['user']} allowGuest><Promotions /></RoleGate>} />
      <Route path="/owner" element={<RoleGate allow={['owner']}><OwnerPanel /></RoleGate>} />
      <Route path="/superadmin" element={<SuperAdminPanel />} />
      <Route path="/join" element={<JoinAsOwner />} />
      <Route path="/account-settings" element={<AccountSettings />} />
      <Route path="/customer-portal" element={<RoleGate allow={['user']}><CustomerPortal /></RoleGate>} />
      <Route path="/desktop-search" element={<RoleGate allow={['user']} allowGuest><div className="h-screen"><DesktopSearch /></div></RoleGate>} />
      <Route path="/CustomerChat" element={<Navigate to="/chat" replace />} />
      <Route path="/customer-chat" element={<Navigate to="/chat" replace />} />
      <Route path="/CustomerPortal" element={<Navigate to="/customer-portal" replace />} />
      <Route path="/DesktopSearch" element={<Navigate to="/desktop-search" replace />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  )
}

export default App