import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RegisterPage from './pages/RegisterPage';
import LedgerPage from './pages/LedgerPage';
import ReceivePage from './pages/ReceivePage';
import DepartmentManagementPage from './pages/DepartmentManagementPage';
import UserManagementPage from './pages/UserManagementPage';
import StampSettingsPage from './pages/StampSettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">로딩 중...</p>
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="receive" element={<ReceivePage />} />
        <Route path="admin/users" element={<UserManagementPage />} />
        <Route path="admin/departments" element={<DepartmentManagementPage />} />
        <Route path="admin/stamp" element={<StampSettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
