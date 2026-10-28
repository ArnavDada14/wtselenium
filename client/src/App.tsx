import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import IssuePage from './pages/IssuePage';
import IssuesPage from './pages/IssuesPage';
import CatalogPage from './pages/CatalogPage';
import FinesPage from './pages/FinesPage';
import StudentPortalPage from './pages/StudentPortalPage';
import UsersPage from './pages/UsersPage';
import AddBookPage from './pages/AddBookPage';
import AuditLogPage from './pages/AuditLogPage';
import BookDetailPage from './pages/BookDetailPage';
import CategoriesPage from './pages/CategoriesPage';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 13, color: 'var(--color-text-ter)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      {/* Librarian / Admin routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute roles={['LIBRARIAN', 'SYSTEM_ADMIN']}>
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/issue" element={
        <ProtectedRoute roles={['LIBRARIAN', 'SYSTEM_ADMIN']}>
          <IssuePage />
        </ProtectedRoute>
      } />
      <Route path="/issues" element={
        <ProtectedRoute roles={['LIBRARIAN', 'SYSTEM_ADMIN']}>
          <IssuesPage />
        </ProtectedRoute>
      } />
      <Route path="/fines" element={
        <ProtectedRoute roles={['LIBRARIAN', 'SYSTEM_ADMIN']}>
          <FinesPage />
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute roles={['LIBRARIAN', 'SYSTEM_ADMIN']}>
          <UsersPage />
        </ProtectedRoute>
      } />
      <Route path="/audit" element={
        <ProtectedRoute roles={['SYSTEM_ADMIN']}>
          <AuditLogPage />
        </ProtectedRoute>
      } />
      <Route path="/catalog/new" element={
        <ProtectedRoute roles={['LIBRARIAN', 'SYSTEM_ADMIN']}>
          <AddBookPage />
        </ProtectedRoute>
      } />
      <Route path="/categories" element={
        <ProtectedRoute roles={['LIBRARIAN', 'SYSTEM_ADMIN']}>
          <CategoriesPage />
        </ProtectedRoute>
      } />

      {/* Shared catalog */}
      <Route path="/catalog" element={
        <ProtectedRoute>
          <CatalogPage />
        </ProtectedRoute>
      } />
      <Route path="/catalog/:id" element={
        <ProtectedRoute>
          <BookDetailPage />
        </ProtectedRoute>
      } />

      {/* Student routes */}
      <Route path="/my-issues" element={
        <ProtectedRoute>
          <StudentPortalPage />
        </ProtectedRoute>
      } />
      <Route path="/my-fines" element={
        <ProtectedRoute>
          <StudentPortalPage />
        </ProtectedRoute>
      } />

      {/* Default redirect by role */}
      <Route path="/" element={
        <ProtectedRoute>
          {user?.role === 'STUDENT' ? <Navigate to="/catalog" replace /> : <Navigate to="/dashboard" replace />}
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
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
