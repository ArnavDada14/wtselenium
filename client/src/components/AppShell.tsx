import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Chatbot from './Chatbot';

interface NavItem {
  label: string;
  to: string;
  search?: string;  // optional query string for items like "Overdue"
}

const LIBRARIAN_NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Circulation', items: [
    { label: 'Dashboard',     to: '/dashboard' },
    { label: 'Issue Book',    to: '/issue' },
    { label: 'Active Issues', to: '/issues' },
    { label: 'Overdue',       to: '/issues', search: '?status=OVERDUE' },
  ]},
  { section: 'Catalog', items: [
    { label: 'Browse Books', to: '/catalog' },
    { label: 'Add Book',     to: '/catalog/new' },
    { label: 'Categories',   to: '/categories' },
  ]},
  { section: 'Finance', items: [
    { label: 'Fines', to: '/fines' },
  ]},
  { section: 'Administration', items: [
    { label: 'Users',     to: '/users' },
    { label: 'Audit Log', to: '/audit' },
  ]},
];

const STUDENT_NAV: { section: string; items: NavItem[] }[] = [
  { section: 'My Library', items: [
    { label: 'Browse Catalog',   to: '/catalog' },
    { label: 'My Issued Books',  to: '/my-issues' },
    { label: 'My Fines',         to: '/my-fines' },
  ]},
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const nav = user?.role === 'STUDENT' ? STUDENT_NAV : LIBRARIAN_NAV;

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-brand">LibraCMS</div>
        <div className="topbar-right">
          <div className="topbar-user">
            <span className="role-badge">{user?.role?.replace('_', ' ')}</span>
            <span className="topbar-user-name">{user?.name}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar">
        {nav.map(({ section, items }) => (
          <div className="sidebar-section" key={section}>
            <div className="sidebar-section-label">{section}</div>
            {items.map(({ label, to, search }) => {
              // Items with a search param get manual active detection
              if (search) {
                const isActive = location.pathname === to && location.search === search;
                return (
                  <button
                    key={label}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    onClick={() => navigate({ pathname: to, search })}
                  >
                    {label}
                  </button>
                );
              }
              return (
                <NavLink
                  key={label}
                  to={to}
                  end={to === '/catalog'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  {label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Content */}
      <main className="main-content">
        {children}
      </main>

      {/* Chatbot */}
      <Chatbot />
    </div>
  );
}
