import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from './store/authStore';

// Pages
import { Login } from './pages/Login';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminEmployees } from './pages/admin/Employees';
import { AdminDocuments } from './pages/admin/Documents';
import { AdminImport } from './pages/admin/Import';
import { AdminReviewQueue } from './pages/admin/ReviewQueue';
import { AdminAuditLogs } from './pages/admin/AuditLogs';
import { AdminSettings } from './pages/admin/Settings';
import { AdminManageFiles } from './pages/admin/ManageFiles';
import { EmployeeDashboard } from './pages/employee/Dashboard';
import { EmployeeDocuments } from './pages/employee/Documents';
import { EmployeeDocumentViewer } from './pages/employee/DocumentViewer';
import { EmployeeYearComparison } from './pages/employee/YearComparison';

// Root route
const rootRoute = createRootRoute();

// Public routes
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      const { user } = useAuthStore.getState();
      throw redirect({ to: user?.role === 'admin' ? '/admin' : '/employee' });
    }
  },
});

const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: AdminLogin,
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      const { user } = useAuthStore.getState();
      throw redirect({ to: user?.role === 'admin' ? '/admin' : '/employee' });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/login' });
  },
});

// Admin routes
const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminDashboard,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'admin') throw redirect({ to: '/employee' });
  },
});

const adminEmployeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/employees',
  component: AdminEmployees,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'admin') throw redirect({ to: '/employee' });
  },
});

const adminDocumentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/documents',
  component: AdminDocuments,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'admin') throw redirect({ to: '/employee' });
  },
});

const adminImportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/import',
  component: AdminImport,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'admin') throw redirect({ to: '/employee' });
  },
});

const adminReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/review',
  component: AdminReviewQueue,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'admin') throw redirect({ to: '/employee' });
  },
});

const adminAuditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/audit',
  component: AdminAuditLogs,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'admin') throw redirect({ to: '/employee' });
  },
});

const adminSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/settings',
  component: AdminSettings,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'admin') throw redirect({ to: '/employee' });
  },
});

const adminManageFilesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/manage-files',
  component: AdminManageFiles,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'admin') throw redirect({ to: '/employee' });
  },
});

// Employee routes
const employeeDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employee',
  component: EmployeeDashboard,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'employee') throw redirect({ to: '/admin' });
  },
});

const employeeDocumentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employee/documents',
  component: EmployeeDocuments,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'employee') throw redirect({ to: '/admin' });
  },
});

const employeeDocumentViewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employee/documents/$id',
  component: EmployeeDocumentViewer,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'employee') throw redirect({ to: '/admin' });
  },
});

const employeeComparisonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employee/comparison',
  component: EmployeeYearComparison,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (user?.role !== 'employee') throw redirect({ to: '/admin' });
  },
});

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  adminLoginRoute,
  adminDashboardRoute,
  adminEmployeesRoute,
  adminDocumentsRoute,
  adminImportRoute,
  adminReviewRoute,
  adminAuditRoute,
  adminSettingsRoute,
  adminManageFilesRoute,
  employeeDashboardRoute,
  employeeDocumentsRoute,
  employeeDocumentViewerRoute,
  employeeComparisonRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
