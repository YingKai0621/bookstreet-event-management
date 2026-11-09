import type { AdminTab } from '../components/admin/AdminSidebar';

export const ADMIN_ROOT = '/admin';

export const ADMIN_TAB_PATHS: Record<AdminTab, string> = {
  dashboard: ADMIN_ROOT,
  users: `${ADMIN_ROOT}/users`,
  roles: `${ADMIN_ROOT}/roles`,
  badges: `${ADMIN_ROOT}/badges`,
  organizations: `${ADMIN_ROOT}/organizations`,
  payments: `${ADMIN_ROOT}/payments`,
  audit: `${ADMIN_ROOT}/audit`,
  notifications: `${ADMIN_ROOT}/notifications`,
  profile: `${ADMIN_ROOT}/profile`,
};

const PATH_TABS = new Map(Object.entries(ADMIN_TAB_PATHS).map(([tab, path]) => [path, tab as AdminTab]));

export function resolveAdminTab(pathname: string): AdminTab | null {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return PATH_TABS.get(normalized) ?? null;
}
