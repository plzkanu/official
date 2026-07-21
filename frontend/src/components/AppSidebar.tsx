import { Link, useLocation } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import {
  adminNavItems,
  isAdminSectionActive,
  isNavActive,
  mainNavItems,
} from '../lib/nav';
import { ROLE_LABELS } from '../types';

function NavLink({ path, label, icon, nested = false }: {
  path: string;
  label: string;
  icon: string;
  nested?: boolean;
}) {
  const location = useLocation();
  const active = isNavActive(location.pathname, path);

  return (
    <Link
      to={path}
      className={`relative flex items-center gap-2.5 rounded-lg py-2.5 text-[13px] transition ${
        nested ? 'pl-7 pr-3' : 'px-3'
      } ${
        active
          ? 'bg-[#1E5FD4]/25 font-medium text-white'
          : 'text-white/65 hover:bg-white/6 hover:text-white'
      }`}
    >
      {active && (
        <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r bg-[#1E5FD4]" />
      )}
      <span aria-hidden>{icon}</span>
      {label}
    </Link>
  );
}

export default function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const visibleMainNav = mainNavItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );
  const showAdminMenu = user?.role === 'admin';
  const adminSectionActive = isAdminSectionActive(location.pathname);

  const initial = user?.name?.charAt(0) ?? '?';

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col bg-[#0F2645]">
      <div className="border-b border-white/10 px-4 py-4">
        <BrandLogo variant="sidebar" />
        <p className="mt-3 px-1 text-[13px] text-white/60">공문접수 관리 시스템</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.08em] text-white/40">메뉴</p>
        {visibleMainNav.map((item) => (
          <NavLink key={item.path} path={item.path} label={item.label} icon={item.icon} />
        ))}

        {showAdminMenu && (
          <div className="pt-3">
            <p
              className={`mb-2 px-3 text-[10px] uppercase tracking-[0.08em] ${
                adminSectionActive ? 'text-white/70' : 'text-white/40'
              }`}
            >
              관리자메뉴
            </p>
            {adminNavItems.map((item) => (
              <NavLink
                key={item.path}
                path={item.path}
                label={item.label}
                icon={item.icon}
                nested
              />
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E5FD4] text-sm font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-white/50">
              {user ? ROLE_LABELS[user.role] : ''} · {user?.username}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
