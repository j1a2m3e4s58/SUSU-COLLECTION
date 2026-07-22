import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/components/ui/use-toast"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ThemeProvider } from '@/lib/ThemeContext';
import AppLayout from '@/components/layout/AppLayout';
import { canManageCustomers, isOwnerAdmin, isSusuAgent } from '@/lib/roles';
import SensitiveReauthDialog from '@/components/SensitiveReauthDialog';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import NetworkStatusBanner from '@/components/NetworkStatusBanner';
import PortalStartupState from '@/components/PortalStartupState';

const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const FieldCollection = lazy(() => import('@/pages/FieldCollection'));
const Customers = lazy(() => import('@/pages/Customers'));
const Directory = lazy(() => import('@/pages/Directory'));
const Transactions = lazy(() => import('@/pages/Transactions'));
const Reports = lazy(() => import('@/pages/Reports'));
const AgentManagement = lazy(() => import('@/pages/AgentManagement'));
const BranchManagement = lazy(() => import('@/pages/BranchManagement'));
const SupervisorManagement = lazy(() => import('@/pages/SupervisorManagement'));
const AuditLog = lazy(() => import('@/pages/AuditLog'));
const Profile = lazy(() => import('@/pages/Profile'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const PortalControl = lazy(() => import('@/pages/PortalControl'));
const PastStaff = lazy(() => import('@/pages/PastStaff'));
const InactiveCustomers = lazy(() => import('@/pages/InactiveCustomers'));
const OwnerOperations = lazy(() => import('@/pages/OwnerOperations'));
const AccountStatus = lazy(() => import('@/pages/AccountStatus'));
const PageNotFound = lazy(() => import('./lib/PageNotFound'));

const RouteLoadingState = () => (
  <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center p-6">
    <div className="text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" aria-hidden="true" />
      <p className="mt-3 text-sm text-muted-foreground">Loading page...</p>
    </div>
  </div>
);

const RequireAdmin = ({ children }) => {
  const { user } = useAuth();
  const allowed = isOwnerAdmin(user);
  return allowed ? children : <Navigate to="/" replace />;
};

const RequireOwner = ({ children }) => {
  const { user } = useAuth();
  return isOwnerAdmin(user) ? children : <Navigate to="/" replace />;
};

const RequireSusuAgent = ({ children }) => {
  const { user } = useAuth();
  const allowed = isSusuAgent(user);
  return allowed ? children : <Navigate to="/" replace />;
};

const RequireCustomerManager = ({ children }) => {
  const { user } = useAuth();
  const allowed = canManageCustomers(user);
  return allowed ? children : <Navigate to="/" replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, bootstrapError, retryBootstrap } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <PortalStartupState onRetry={retryBootstrap} />;
  }

  if (bootstrapError) return <PortalStartupState error={bootstrapError} onRetry={retryBootstrap} />;

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<RouteLoadingState />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/field-collection" element={<RequireSusuAgent><FieldCollection /></RequireSusuAgent>} />
          <Route path="/customers" element={<RequireCustomerManager><Customers /></RequireCustomerManager>} />
          <Route path="/inactive-customers" element={<RequireCustomerManager><InactiveCustomers /></RequireCustomerManager>} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/agents" element={<RequireCustomerManager><AgentManagement /></RequireCustomerManager>} />
          <Route path="/branches" element={<RequireAdmin><BranchManagement /></RequireAdmin>} />
          <Route path="/supervisor-management" element={<RequireAdmin><SupervisorManagement /></RequireAdmin>} />
          <Route path="/audit-log" element={<RequireAdmin><AuditLog /></RequireAdmin>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/portal-control" element={<RequireOwner><PortalControl /></RequireOwner>} />
          <Route path="/owner-operations" element={<RequireOwner><OwnerOperations /></RequireOwner>} />
          <Route path="/account-status" element={<RequireOwner><AccountStatus /></RequireOwner>} />
          <Route path="/past-staff" element={<RequireOwner><PastStaff /></RequireOwner>} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {
  useEffect(() => {
    const handlePortalToast = (event) => {
      const detail = event.detail || {};
      toast({
        variant: detail.variant || "default",
        title: detail.title || "Notice",
        description: detail.description || "",
        duration: detail.duration || 5000,
      });
    };
    window.addEventListener("portal-toast", handlePortalToast);
    return () => window.removeEventListener("portal-toast", handlePortalToast);
  }, []);

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ScrollToTop />
              <AuthenticatedApp />
              <SensitiveReauthDialog />
              <NetworkStatusBanner />
            </Router>
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </AuthProvider>
    </AppErrorBoundary>
  )
}

export default App
