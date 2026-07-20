import { useEffect } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/components/ui/use-toast"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ThemeProvider } from '@/lib/ThemeContext';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import FieldCollection from '@/pages/FieldCollection';
import Customers from '@/pages/Customers';
import Directory from '@/pages/Directory';
import Transactions from '@/pages/Transactions';
import Reports from '@/pages/Reports';
import AgentManagement from '@/pages/AgentManagement';
import BranchManagement from '@/pages/BranchManagement';
import SupervisorManagement from '@/pages/SupervisorManagement';
import AuditLog from '@/pages/AuditLog';
import Profile from '@/pages/Profile';
import Notifications from '@/pages/Notifications';
import PortalControl from '@/pages/PortalControl';
import PastStaff from '@/pages/PastStaff';
import InactiveCustomers from '@/pages/InactiveCustomers';
import { canManageCustomers, isOwnerAdmin, isSusuAgent } from '@/lib/roles';

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
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  // Render the main app
  return (
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
          <Route path="/past-staff" element={<RequireOwner><PastStaff /></RequireOwner>} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
