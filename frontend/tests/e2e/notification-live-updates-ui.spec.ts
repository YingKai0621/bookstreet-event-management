import { expect, test, type Page, type Route } from '@playwright/test';

type Role = 'participant' | 'partner' | 'organizer';

const samples: Record<Role, object> = {
  participant: { type: 'EVENT_CANCELLED', referenceType: 'EVENT', referenceId: 501 },
  partner: { type: 'PARTNER_EVENT_PUBLISHED', referenceType: 'EVENT', referenceId: 501 },
  organizer: { type: 'ORGANIZER_NEW_BOOTH_REQUEST', referenceType: 'BOOTH_REQUEST', referenceId: 701 },
};

async function json(route: Route, body: unknown) {
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, role: Role | 'admin') {
  const rows: object[] = [];
  await page.addInitScript(() => {
    class FakeEventSource {
      closed = false;
      listeners: Array<() => void> = [];
      onopen: (() => void) | null = null;
      constructor(public url: string) {
        (window as unknown as { sources: FakeEventSource[] }).sources.push(this);
        setTimeout(() => this.onopen?.(), 0);
      }
      addEventListener(_name: string, listener: () => void) { this.listeners.push(listener); }
      close() { this.closed = true; }
    }
    (window as unknown as { sources: unknown[] }).sources = [];
    (window as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    if (path.endsWith('/auth/me')) {
      return json(route, {
        userId: 7, username: 'live', fullName: 'Người dùng', email: 'live@example.test', emailVerified: true,
        status: 'ACTIVE',
        // A staff account no longer opens the reader workspace.
        roles: role === 'participant' ? ['PARTICIPANT'] : ['PARTICIPANT', 'PARTNER', 'ORGANIZER', 'ADMIN'],
      });
    }
    if (path.endsWith('/auth/profile')) {
      return json(route, { id: 7, fullName: 'Người dùng', email: 'live@example.test', emailVerified: true, phone: null, avatarUrl: null });
    }
    if (path.endsWith('/notifications/unread-count')) return json(route, { unreadCount: rows.length });
    if (path.endsWith('/partner/organization')) {
      return json(route, {
        partnerOrganizationId: 9, name: 'NXB Demo', description: '', categoryCode: 'PUBLISHER', logoUrl: null,
        contactEmail: 'live@example.test', contactPhone: null, address: null, status: 'ACTIVE',
      });
    }
    if (path.endsWith('/organizer/dashboard')) {
      return json(route, {
        activeEventCount: 0, pendingPartnerApplicationCount: 0, pendingBoothRequestCount: 0,
        eventStatusCounts: { DRAFT: 0, PUBLISHED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 },
        partnerApplicationStatusCounts: { PENDING: 0, APPROVED: 0, REJECTED: 0, WITHDRAWN: 0 }, priorityTasks: [],
      });
    }
    const content = path.endsWith('/notifications') ? rows : [];
    return json(route, { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0 });
  });
  await page.goto(`/${role}/notifications`);
  return (title: string) => rows.push({
    notificationId: rows.length + 1, title, message: 'Nội dung mới', contextEventId: 501,
    createdAt: new Date().toISOString(), readAt: null, read: false, ...samples[role as Role],
  });
}

const openSources = (page: Page) => page.evaluate(() => (window as unknown as { sources: Array<{ closed: boolean; url: string }> })
  .sources.filter(source => !source.closed).map(source => source.url));

const emitSignal = (page: Page) => page.evaluate(() => {
  const sources = (window as unknown as { sources: Array<{ closed: boolean; listeners: Array<() => void> }> }).sources;
  sources.filter(source => !source.closed).forEach(source => source.listeners.forEach(listener => listener()));
});

const setHidden = (page: Page, hidden: boolean) => page.evaluate(value => {
  Object.defineProperty(document, 'hidden', { configurable: true, value });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

for (const role of ['participant', 'partner', 'organizer'] as const) {
  test(`${role} inbox shows a new notification without reloading the page`, async ({ page }) => {
    const addRow = await setup(page, role);
    await expect.poll(() => openSources(page)).toEqual([`/api/v1/${role}/notifications/stream`]);
    let navigations = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });

    addRow('Thông báo vừa đến');
    await expect(page.getByText('Thông báo vừa đến').first()).not.toBeVisible();
    await emitSignal(page);

    await expect(page.getByText('Thông báo vừa đến').first()).toBeVisible();
    expect(navigations).toBe(0);
  });
}

test('a hidden tab releases its connection and catches up when shown again', async ({ page }) => {
  const addRow = await setup(page, 'partner');
  await expect.poll(() => openSources(page)).toHaveLength(1);

  await setHidden(page, true);
  await expect.poll(() => openSources(page)).toEqual([]);

  addRow('Đến lúc tab đang ẩn');
  await setHidden(page, false);

  await expect.poll(() => openSources(page)).toHaveLength(1);
  await expect(page.getByText('Đến lúc tab đang ẩn').first()).toBeVisible();
});

test('Admin has no notification producer, so it opens no connection', async ({ page }) => {
  await setup(page, 'admin');
  await expect(page.getByText('Hiện chưa có thông báo nào dành cho Admin.').first()).toBeVisible();
  expect(await openSources(page)).toEqual([]);
});
