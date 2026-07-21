import type { UserRole } from '../types';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: UserRole[];
}

export const mainNavItems: NavItem[] = [
  { path: '/', label: '대시보드', icon: '📊' },
  {
    path: '/register',
    label: '접수 등록',
    icon: '📝',
    roles: ['admin', 'registrar', 'team_leader'],
  },
  { path: '/ledger', label: '접수 대장', icon: '📋' },
  {
    path: '/receive',
    label: '공문 수취 확인',
    icon: '✅',
    roles: ['admin', 'team_leader'],
  },
];

export const adminNavItems: NavItem[] = [
  { path: '/admin/users', label: '사용자 관리', icon: '👤' },
  { path: '/admin/departments', label: '부서 관리', icon: '🏢' },
  { path: '/admin/stamp', label: '접수도장 관리', icon: '🔏' },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAdminSectionActive(pathname: string): boolean {
  return pathname.startsWith('/admin');
}
