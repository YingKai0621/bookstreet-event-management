import { expect, Page, Route, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || '';

function futureIso(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

interface MockScenario {
  events?: Array<Record<string, unknown>>;
  applications?: Array<Record<string, unknown>>;
  boothRequests?: Array<Record<string, unknown>>;
  failEvents?: boolean;
  failSummary?: boolean;
}

async function setupOrganizerDashboard(page: Page, scenario: MockScenario = {}) {
  const defaultEvents = [
    {
      eventId: 501,
      organizerUserId: 1,
      name: 'Hội sách Mùa Xuân 2027',
      description: 'Sự kiện hội sách sắp diễn ra.',
      startAt: futureIso(10),
      endAt: futureIso(15),
      bannerUrl: null,
      status: 'PUBLISHED',
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T00:00:00Z',
    },
    {
      eventId: 502,
      organizerUserId: 1,
      name: 'Triển lãm Truyện tranh 2027',
      startAt: futureIso(60),
      endAt: futureIso(65),
      bannerUrl: null,
      status: 'PUBLISHED',
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T00:00:00Z',
    },
    {
      eventId: 503,
      organizerUserId: 1,
      name: 'Hội thảo Xuất bản Bản nháp',
      startAt: futureIso(5),
      endAt: futureIso(8),
      bannerUrl: null,
      status: 'DRAFT',
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T00:00:00Z',
    },
  ];
  const defaultApplications = [
    { applicationId: 101, eventId: 501, partnerOrganizationName: 'NXB Trẻ', status: 'PENDING', submittedAt: '2026-10-20T10:00:00Z' },
    { applicationId: 102, eventId: 502, partnerOrganizationName: 'NXB Kim Đồng', status: 'PENDING', submittedAt: '2026-10-21T11:00:00Z' },
    { applicationId: 103, eventId: 501, partnerOrganizationName: 'Nhà sách Phương Nam', status: 'APPROVED', submittedAt: '2026-10-19T09:00:00Z' },
    { applicationId: 104, eventId: 502, partnerOrganizationName: 'Đơn vị không phù hợp', status: 'REJECTED', submittedAt: '2026-10-18T09:00:00Z' },
  ];
  const defaultBoothRequests = [
    { boothRequestId: 301, eventId: 502, partnerOrganizationName: 'NXB Kim Đồng', boothCode: 'B-01', status: 'PENDING', submittedAt: '2026-10-20T10:30:00Z' },
  ];

  const events = scenario.events ?? defaultEvents;
  const applications = scenario.applications ?? defaultApplications;
  const boothRequests = scenario.boothRequests ?? defaultBoothRequests;
  const eventNameById = new Map(events.map(event => [String(event.eventId), String(event.name)]));
  const eventStatuses = ['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED'] as const;
  const applicationStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const;
  const eventStatusCounts = Object.fromEntries(eventStatuses.map(status => [status, events.filter(event => event.status === status).length]));
  const partnerApplicationStatusCounts = Object.fromEntries(applicationStatuses.map(status => [status, applications.filter(application => application.status === status).length]));
  const priorityTasks = [
    ...applications.filter(item => item.status === 'PENDING').map(item => ({
      type: 'PARTNER_APPLICATION',
      id: item.applicationId,
      eventId: item.eventId,
      eventName: eventNameById.get(String(item.eventId)) || `Sự kiện #${item.eventId}`,
      subjectName: item.partnerOrganizationName,
      submittedAt: item.submittedAt,
    })),
    ...boothRequests.filter(item => item.status === 'PENDING').map(item => ({
      type: 'BOOTH_REQUEST',
      id: item.boothRequestId,
      eventId: item.eventId,
      eventName: eventNameById.get(String(item.eventId)) || `Sự kiện #${item.eventId}`,
      subjectName: `${item.partnerOrganizationName} · ${item.boothCode}`,
      submittedAt: item.submittedAt,
    })),
  ].sort((left, right) => String(left.submittedAt).localeCompare(String(right.submittedAt))).slice(0, 4);

  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'mock-csrf' });
    if (path.endsWith('/auth/me')) return json(route, { userId: 1, username: 'organizer', fullName: 'Nguyễn Điều Hành', email: 'organizer@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'ORGANIZER'] });
    if (path.endsWith('/organizer/notifications/unread-count')) return json(route, { unreadCount: 0 });
    if (path.endsWith('/organizer/notifications')) return json(route, {
      content: [], page: 0, size: 5, totalElements: 0, totalPages: 0,
    });
    if (path.endsWith('/organizer/dashboard')) {
      if (scenario.failSummary) return json(route, { code: 'DASHBOARD_UNAVAILABLE', message: 'Không tải được dữ liệu tổng hợp.' }, 503);
      return json(route, {
        activeEventCount: (eventStatusCounts.PUBLISHED || 0) + (eventStatusCounts.ONGOING || 0),
        pendingPartnerApplicationCount: partnerApplicationStatusCounts.PENDING || 0,
        pendingBoothRequestCount: boothRequests.filter(item => item.status === 'PENDING').length,
        eventStatusCounts,
        partnerApplicationStatusCounts,
        priorityTasks,
      });
    }
    if (path.endsWith('/organizer/events')) {
      if (scenario.failEvents) return json(route, { code: 'EVENTS_UNAVAILABLE', message: 'Không tải được danh sách sự kiện.' }, 503);
      return json(route, { content: events, page: 0, size: 100, totalElements: events.length, totalPages: events.length ? 1 : 0 });
    }
    if (path.includes('/organizer/events/') && path.endsWith('/booth-configs')) return json(route, []);
    if (/\/organizer\/events\/[^/]+\/applications$/.test(path)) return json(route, { content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 });
    if (/\/organizer\/events\/[^/]+\/booth-requests$/.test(path)) return json(route, { content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
    if (path.includes('/booths') || path.includes('/heritages') || path.includes('/venues')) return json(route, []);
    return json(route, { code: 'NOT_FOUND', message: 'Not found' }, 404);
  });
}

test.describe('Organizer Dashboard — global operational overview', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('uses one global scope for KPI, priority work and both charts', async ({ page }) => {
    await setupOrganizerDashboard(page);
    await page.goto(`${BASE_URL}/organizer`);

    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Sự kiện đang hoạt động/i })).toContainText('2');
    await expect(page.locator('.org-dashboard-kpi.is-partners')).toContainText('2');
    await expect(page.locator('.org-dashboard-kpi.is-booths')).toContainText('1');
    await expect(page.getByText('Tổng hợp tất cả sự kiện')).toHaveCount(3);
    await expect(page.getByRole('combobox', { name: 'Sự kiện', exact: true })).toHaveCount(0);
    await expect(page.getByText(/^Theo “/)).toHaveCount(0);

    await expect(page.getByRole('button', { name: /Xem chi tiết: Hội sách Mùa Xuân 2027/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Xem chi tiết: Triển lãm Truyện tranh 2027/ })).toBeVisible();
    await expect(page.getByText('NXB Trẻ', { exact: true })).toBeVisible();
    await expect(page.getByText('Sự kiện: Hội sách Mùa Xuân 2027', { exact: true })).toBeVisible();
    await expect(page.getByText('NXB Kim Đồng · B-01', { exact: true })).toBeVisible();
    await expect(page.getByText('Sự kiện: Triển lãm Truyện tranh 2027', { exact: true })).toHaveCount(2);

    await expect(page.getByRole('img', { name: /Sự kiện theo trạng thái: 3 sự kiện/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /Hồ sơ đối tác theo kết quả: Chờ duyệt: 2, Đã duyệt: 1, Từ chối: 1/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test('shows the remaining work count once without duplicating it in the label', async ({ page }) => {
    const applications = Array.from({ length: 6 }, (_, index) => ({
      applicationId: 900 + index,
      eventId: index % 2 === 0 ? 501 : 502,
      partnerOrganizationName: `Đối tác ${index + 1}`,
      status: 'PENDING',
      submittedAt: `2026-10-${String(10 + index).padStart(2, '0')}T09:00:00Z`,
    }));
    await setupOrganizerDashboard(page, { applications, boothRequests: [] });
    await page.goto(`${BASE_URL}/organizer`);

    const remainingWork = page.locator('.org-dashboard-task-more');
    await expect(remainingWork).toContainText('+2');
    await expect(remainingWork).toContainText('Việc khác đang chờ xử lý');
    await expect(remainingWork).not.toContainText('2 việc khác đang chờ xử lý');
  });

  test('keeps only four compact event rows and shows analytics above the fold at 1600x900', async ({ page }) => {
    const events = Array.from({ length: 7 }, (_, index) => ({
      eventId: 700 + index,
      organizerUserId: 1,
      name: `Sự kiện tương lai ${index + 1}`,
      startAt: futureIso(index + 1),
      endAt: futureIso(index + 2),
      bannerUrl: null,
      status: 'PUBLISHED',
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T00:00:00Z',
    }));
    await setupOrganizerDashboard(page, { events });
    await page.goto(`${BASE_URL}/organizer`);

    await expect(page.locator('.org-dashboard-event-row')).toHaveCount(4);
    const analyticsBox = await page.locator('.org-dashboard-analytics').boundingBox();
    const chartBox = await page.locator('.org-dashboard-chart-grid').boundingBox();
    expect(analyticsBox).not.toBeNull();
    expect(chartBox).not.toBeNull();
    expect(analyticsBox!.y).toBeLessThan(900);
    expect(chartBox!.y).toBeLessThan(900);
  });

  test('keeps the desktop composition readable at 1366x768 and allows natural vertical scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await setupOrganizerDashboard(page);
    await page.goto(`${BASE_URL}/organizer`);

    await expect(page.locator('.org-dashboard-kpis')).toBeVisible();
    await expect(page.locator('.org-dashboard-columns')).toBeVisible();
    await expect(page.locator('.org-dashboard-analytics')).toBeVisible();
    const analyticsBox = await page.locator('.org-dashboard-analytics').boundingBox();
    expect(analyticsBox!.y).toBeLessThan(768);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test('routes each global work item to its owning event', async ({ page }) => {
    await setupOrganizerDashboard(page);
    await page.goto(`${BASE_URL}/organizer`);

    await page.locator('.org-dashboard-task-row').filter({ hasText: 'NXB Trẻ' }).click();
    await expect(page).toHaveURL(/\/organizer\/events\/501\?section=partners/);

    await page.goto(`${BASE_URL}/organizer`);
    await page.locator('.org-dashboard-task-row').filter({ hasText: 'B-01' }).click();
    await expect(page).toHaveURL(/\/organizer\/booth-requests\?eventId=502/);
  });

  test('keeps global empty states truthful and compact', async ({ page }) => {
    await setupOrganizerDashboard(page, {
      events: [{ eventId: 509, organizerUserId: 1, name: 'Sự kiện đã hoàn tất', startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-05T00:00:00Z', bannerUrl: null, status: 'COMPLETED', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }],
      applications: [],
      boothRequests: [],
    });
    await page.goto(`${BASE_URL}/organizer`);

    await expect(page.getByRole('button', { name: /^Sự kiện đang hoạt động/i })).toContainText('0');
    await expect(page.locator('.org-dashboard-kpi.is-partners')).toContainText('0');
    await expect(page.getByText('Không có việc cần xử lý')).toBeVisible();
    await expect(page.getByText('Chưa có sự kiện đang diễn ra hoặc sắp tới.')).toBeVisible();
    await expect(page.getByRole('img', { name: /Sự kiện theo trạng thái: 1 sự kiện/ })).toBeVisible();
    await expect(page.getByText('Chưa có hồ sơ đối tác.')).toBeVisible();
  });

  test('keeps far-future published events and excludes draft or cancelled events', async ({ page }) => {
    await setupOrganizerDashboard(page, {
      events: [
        { eventId: 510, organizerUserId: 1, name: 'Hội sách mùa hè', startAt: futureIso(60), endAt: futureIso(65), bannerUrl: null, status: 'PUBLISHED', createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z' },
        { eventId: 511, organizerUserId: 1, name: 'Bản nháp nội bộ', startAt: futureIso(5), endAt: futureIso(7), bannerUrl: null, status: 'DRAFT', createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z' },
      ],
      applications: [],
      boothRequests: [],
    });
    await page.goto(`${BASE_URL}/organizer`);
    await expect(page.getByRole('button', { name: /Xem chi tiết: Hội sách mùa hè/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Xem chi tiết: Bản nháp nội bộ/ })).toHaveCount(0);
  });

  test('does not invent summary values when the aggregate endpoint fails', async ({ page }) => {
    await setupOrganizerDashboard(page, { failSummary: true });
    await page.goto(`${BASE_URL}/organizer`);

    await expect(page.getByRole('button', { name: /^Sự kiện đang hoạt động/i })).toContainText('—');
    await expect(page.locator('.org-dashboard-kpi.is-partners')).toContainText('—');
    await expect(page.locator('.org-dashboard-notice[role="alert"]').filter({ hasText: 'Không thể tải dữ liệu tổng hợp' })).toBeVisible();
    await expect(page.locator('.org-dashboard-column')).toHaveCount(0);
  });

  test('shows an event loading failure instead of a misleading event list', async ({ page }) => {
    await setupOrganizerDashboard(page, { failEvents: true });
    await page.goto(`${BASE_URL}/organizer`);
    await expect(page.getByRole('alert').filter({ hasText: 'Không thể tải dữ liệu sự kiện' })).toBeVisible();
    await expect(page.locator('.org-dashboard-event-row')).toHaveCount(0);
  });
});
