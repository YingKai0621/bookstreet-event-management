import { expect, test, type Page, type Route } from '@playwright/test';

type Role = 'participant' | 'partner' | 'organizer' | 'admin';

const rows: Record<Role, object[]> = {
  participant: [{
    notificationId: 11, type: 'EVENT_CANCELLED', title: 'Hàng đợi Participant', message: 'Chỉ Participant thấy dòng này.',
    referenceType: 'EVENT', referenceId: 501, contextEventId: 501,
    createdAt: '2026-11-05T08:00:00Z', readAt: null, read: false,
  }],
  partner: [{
    notificationId: 12, type: 'PARTNER_APPLICATION_STATUS_CHANGED', title: 'Hàng đợi Partner', message: 'Chỉ Partner thấy dòng này.',
    referenceType: 'PARTNER_APPLICATION', referenceId: 601, contextEventId: 501,
    createdAt: '2026-11-05T08:00:00Z', readAt: null, read: false,
  }],
  organizer: [{
    notificationId: 13, type: 'ORGANIZER_NEW_PARTNER_APPLICATION', title: 'Hàng đợi Organizer', message: 'Chỉ Organizer thấy dòng này.',
    referenceType: 'PARTNER_APPLICATION', referenceId: 601, contextEventId: 501,
    createdAt: '2026-11-05T08:00:00Z', readAt: null, read: false,
  }],
  admin: [],
};

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, roles: string[]) {
  const inboxRequests: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    if (path.endsWith('/auth/me')) {
      return json(route, {
        userId: 7, username: 'allroles', fullName: 'Tài khoản đa vai trò', email: 'all@example.test',
        emailVerified: true, status: 'ACTIVE', roles,
      });
    }
    if (path.endsWith('/notifications/stream')) return route.abort();
    const inbox = path.match(/\/api\/v1\/(participant|partner|organizer|admin)\/notifications(\/unread-count)?$/);
    if (inbox) {
      const role = inbox[1] as Role;
      inboxRequests.push(role);
      if (inbox[2]) return json(route, { unreadCount: rows[role].length });
      return json(route, {
        content: rows[role], page: 0, size: 20, totalElements: rows[role].length, totalPages: rows[role].length ? 1 : 0,
      });
    }
    if (path.includes('/notifications')) {
      inboxRequests.push(`unexpected:${path}`);
    }
    if (path.endsWith('/partner/organization')) {
      return json(route, {
        partnerOrganizationId: 9, name: 'NXB Đa vai trò', description: '', categoryCode: 'PUBLISHER', logoUrl: null,
        contactEmail: 'all@example.test', contactPhone: null, address: null, status: 'ACTIVE',
      });
    }
    if (path.endsWith('/admin/profile')) {
      return json(route, { id: 7, fullName: 'Tài khoản đa vai trò', email: 'all@example.test', phone: null, department: null, lastActiveAt: null });
    }
    if (path.endsWith('/auth/profile')) {
      return json(route, { id: 7, fullName: 'Tài khoản đa vai trò', email: 'all@example.test', emailVerified: true, phone: null, avatarUrl: null });
    }
    if (path.endsWith('/organizer/dashboard')) {
      return json(route, {
        activeEventCount: 0, pendingPartnerApplicationCount: 0, pendingBoothRequestCount: 0,
        eventStatusCounts: { DRAFT: 0, PUBLISHED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 },
        partnerApplicationStatusCounts: { PENDING: 0, APPROVED: 0, REJECTED: 0, WITHDRAWN: 0 }, priorityTasks: [],
      });
    }
    return json(route, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });
  return inboxRequests;
}

const expectations: Array<{ role: Role; visible: string | null; empty: string | null }> = [
  { role: 'participant', visible: 'Hàng đợi Participant', empty: null },
  { role: 'partner', visible: 'Hàng đợi Partner', empty: null },
  { role: 'organizer', visible: 'Hàng đợi Organizer', empty: null },
  { role: 'admin', visible: null, empty: 'Hiện chưa có thông báo nào dành cho Admin.' },
];

for (const { role, visible, empty } of expectations) {
  test(`multi-role account sees only the ${role} audience in the ${role} workspace`, async ({ page }) => {
    // A staff account no longer opens the reader workspace, so the reader case uses a reader-only account.
    const inboxRequests = await setup(page, role === 'participant'
      ? ['PARTICIPANT']
      : ['PARTICIPANT', 'PARTNER', 'ORGANIZER', 'ADMIN']);
    await page.goto(`/${role}/notifications`);

    if (visible) await expect(page.getByText(visible).first()).toBeVisible();
    if (empty) await expect(page.getByText(empty).first()).toBeVisible();
    for (const other of ['Hàng đợi Participant', 'Hàng đợi Partner', 'Hàng đợi Organizer'].filter(title => title !== visible)) {
      await expect(page.getByText(other)).toHaveCount(0);
    }
    expect(inboxRequests.length).toBeGreaterThan(0);
    expect(new Set(inboxRequests)).toEqual(new Set([role]));
  });
}
