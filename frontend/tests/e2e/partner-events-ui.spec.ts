import { test, expect, type Page, type Route } from '@playwright/test';

const stamp = '2026-10-01T03:00:00Z';
const startAt = '2026-10-18T02:00:00Z';
const endAt = '2026-10-20T05:00:00Z';
const event = { eventId: 101, name: 'Tuần lễ sách của gian hàng', description: 'Giao lưu cùng tác giả và bạn đọc.', startAt, endAt,
  partnerApplicationDeadlineAt: '2026-10-17T16:59:00Z', bannerUrl: null, status: 'PUBLISHED' };
const otherEvent = { ...event, eventId: 102, name: 'Sự kiện chưa tham gia', startAt: '2026-10-25T02:00:00Z', endAt: '2026-10-25T05:00:00Z' };
const application = { applicationId: 31, eventId: 101, partnerOrganizationId: 9, status: 'APPROVED',
  applicationNote: 'Sách thiếu nhi và văn học', reviewNote: 'Hồ sơ hợp lệ', submittedAt: stamp, reviewedAt: stamp, withdrawnAt: null };
const activeBoothHold = { boothHoldId: 7, status: 'ACTIVE', lockedRentalPrice: 2_000_000,
  createdAt: '2026-10-14T03:00:00Z', expiresAt: '2026-10-15T03:00:00Z', releasedAt: null };
const selectedBoothRequest = { boothRequestId: 51, eventId: 101, boothId: 11, boothCode: 'A01', partnerOrganizationId: 9,
  partnerOrganizationName: 'NXB Demo', status: 'SELECTED', requestNote: null, reviewNote: null, submittedAt: stamp,
  reviewedAt: stamp, selectedAt: '2026-10-14T03:00:00Z', completedAt: null, paymentExpiredAt: null, withdrawnAt: null,
  hold: activeBoothHold };
function paged(content: unknown[]) { return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 }; }
async function json(route: Route, body: unknown, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); }
async function setup(page: Page, scenario: { status?: string; empty?: boolean; missingProfile?: boolean; history?: boolean; failure?: boolean; applicationCount?: number; eventCount?: number; boothRequests?: unknown[]; applicationsFailure?: boolean; boothFailure?: boolean; notifications?: boolean; notificationsFailure?: boolean; notificationsStatus?: number; readFailure?: boolean; notification?: { type: string; referenceType: string; referenceId: number } } = {}) {
  await page.clock.install({ time: new Date('2026-10-14T05:00:00Z') });
  const state = { status: scenario.status || 'APPROVED', submissions: [] as unknown[], unsupported: [] as string[], withdrawals: 0 };
  let notificationRead = false;
  const notification = { notificationId: 301, type: 'PARTNER_APPLICATION_STATUS_CHANGED',
    title: 'Hồ sơ tham gia đã được duyệt', message: 'Hồ sơ tham gia sự kiện của bạn đã được chấp thuận.',
    referenceType: 'PARTNER_APPLICATION', referenceId: 31, contextEventId: 101,
    createdAt: stamp, readAt: null as string | null, read: false, ...scenario.notification };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/me')) return json(route, { userId: 2, username: 'partner', fullName: 'Partner Demo', email: 'partner@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'PARTNER'] });
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    if (path.endsWith('/partner/notifications/unread-count')) return json(route, { unreadCount: scenario.notifications && !notificationRead ? 1 : 0 });
    if (path.endsWith('/partner/notifications/read-all') && method === 'POST') {
      const changed = scenario.notifications && !notificationRead ? 1 : 0;
      notificationRead = true;
      return json(route, { updatedCount: changed });
    }
    if (path.endsWith('/partner/notifications/301/read') && method === 'POST') {
      if (scenario.readFailure) return json(route, { code: 'UNAVAILABLE', message: 'Read failed' }, 503);
      notificationRead = true;
      return json(route, { ...notification, readAt: stamp, read: true });
    }
    if (path.endsWith('/partner/notifications')) {
      if (scenario.notificationsFailure) return json(route, { code: 'UNAVAILABLE', message: 'List failed' }, 503);
      if (scenario.notificationsStatus) return json(route, { code: 'DENIED', message: 'Denied' }, scenario.notificationsStatus);
      const params = new URL(route.request().url()).searchParams;
      const visible = scenario.notifications && params.get('read') !== (notificationRead ? 'false' : 'true')
        && (!params.get('type') || params.get('type') === notification.type)
        ? [{ ...notification, readAt: notificationRead ? stamp : null, read: notificationRead }] : [];
      return json(route, { content: visible, page: 0, size: Number(params.get('size') || 20), totalElements: visible.length, totalPages: visible.length ? 1 : 0 });
    }
    if (path.endsWith('/partner/organization')) return scenario.missingProfile ? json(route, { code: 'PARTNER_ORGANIZATION_NOT_FOUND', message: 'Chưa có hồ sơ' }, 404)
      : json(route, { partnerOrganizationId: 9, name: 'NXB Demo', description: '', categoryCode: 'PUBLISHER', logoUrl: null, contactEmail: 'partner@example.com', contactPhone: null, address: null, status: 'ACTIVE' });
    if (path.endsWith('/partner/applications')) {
      if (scenario.applicationsFailure) return json(route, { code: 'UNAVAILABLE', message: 'Không thể tải dữ liệu đối tác' }, 503);
      const applications = scenario.empty && state.submissions.length === 0 ? []
        : Array.from({ length: scenario.applicationCount || 1 }, (_, index) => ({
          ...application,
          applicationId: application.applicationId + index,
          eventId: index % 2 === 0 ? 101 : 102,
          submittedAt: new Date(new Date(stamp).getTime() + index * 3_600_000).toISOString(),
          status: state.status,
        }));
      return json(route, paged(applications));
    }
    if (path.endsWith('/partner/booth-requests')) return scenario.boothFailure
      ? json(route, { code: 'UNAVAILABLE', message: 'Không thể tải dữ liệu gian hàng' }, 503)
      : json(route, paged(scenario.boothRequests || []));
    if (path.endsWith('/events/101/applications') && method === 'POST') {
      expect(route.request().headers()['x-csrf-token']).toBe('test-csrf');
      state.submissions.push(route.request().postDataJSON()); state.status = 'PENDING';
      return json(route, { ...application, status: 'PENDING' }, 201);
    }
    if (path.endsWith('/partner/applications/31/withdraw')) {
      expect(route.request().headers()['x-csrf-token']).toBe('test-csrf');
      state.withdrawals++; state.status = 'WITHDRAWN'; return json(route, { ...application, status: 'WITHDRAWN' });
    }
    if (path.endsWith('/events/101')) return json(route, { ...event, status: scenario.history ? 'COMPLETED' : 'PUBLISHED' });
    if (path.endsWith('/events')) {
      if (scenario.failure) return json(route, { code: 'UNAVAILABLE', message: 'Không thể tải sự kiện' }, 503);
      const publishedEvents = scenario.eventCount
        ? Array.from({ length: scenario.eventCount }, (_, index) => ({
          ...event,
          eventId: event.eventId + index,
          name: index === 0 ? event.name : index === 1 ? otherEvent.name : `Sự kiện phân trang ${index + 1}`,
          startAt: new Date(new Date(startAt).getTime() + index * 86_400_000).toISOString(),
          endAt: new Date(new Date(endAt).getTime() + index * 86_400_000).toISOString(),
        }))
        : [event, otherEvent];
      return json(route, paged(scenario.history ? [otherEvent] : publishedEvents));
    }
    if (path.endsWith('/heritages')) return json(route, []);
    if (path.includes('/activity-proposals') || path.endsWith('/partner/schedule')) state.unsupported.push(path);
    return json(route, { code: 'NOT_FOUND', message: 'Không có API này' }, 404);
  });
  return state;
}

test('partner workspace shows real overview, upcoming event, actionable task, and recent record', async ({ page }) => {
  await setup(page);
  await page.goto('/partner');
  await expect(page.getByRole('heading', { name: 'Xin chào, NXB Demo!' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Đăng ký sự kiện mới/ })).toHaveAttribute('href', '/partner/events/apply');
  await expect(page.getByRole('link', { name: /Tìm gian hàng trên bản đồ/ })).toHaveAttribute('href', '/partner/booth-requests');
  await expect(page.getByRole('heading', { name: 'Tổng quan nhanh' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Hồ sơ sự kiện/ })).toContainText('1');
  await expect(page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chọn gian hàng cho sự kiện đã duyệt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hoạt động gần đây' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Hồ sơ sự kiện được duyệt' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('partner-workspace.png'), fullPage: true });
});

test('Partner opens a real inbox, filters it, and reads an application outcome', async ({ page }) => {
  await setup(page, { notifications: true });
  await page.goto('/partner/notifications');
  await expect(page.getByRole('heading', { name: 'Thông báo' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hồ sơ tham gia đã được duyệt/ })).toBeVisible();
  await page.getByRole('button', { name: 'Lọc theo loại thông báo' }).click();
  await page.getByRole('option', { name: 'Yêu cầu gian hàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có thông báo thuộc loại “Yêu cầu gian hàng”' })).toBeVisible();
  await page.getByRole('button', { name: 'Lọc theo loại thông báo' }).click();
  await page.getByRole('option', { name: 'Tất cả loại' }).click();
  await page.getByRole('button', { name: /Hồ sơ tham gia đã được duyệt/ }).click();
  await expect(page).toHaveURL(/\/partner\/events\?application=31$/);
  await page.goto('/partner/notifications');
  await page.getByRole('tab', { name: 'Chưa đọc' }).click();
  await expect(page.getByRole('heading', { name: 'Bạn đã đọc hết thông báo' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem tất cả thông báo' }).click();
  await expect(page.getByRole('button', { name: /Hồ sơ tham gia đã được duyệt/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('partner-notifications.png'), fullPage: true });
});

for (const [type, referenceType, referenceId, target] of [
  ['PARTNER_EVENT_PUBLISHED', 'EVENT', 101, '/partner/events/apply?event=101'],
  ['PARTNER_BOOTH_REQUEST_STATUS_CHANGED', 'BOOTH_REQUEST', 51, '/partner/booth-requests?eventId=101&view=requests'],
  ['PARTNER_BOOTH_HOLD_EXPIRING', 'BOOTH_REQUEST', 51, '/partner/booth-requests?eventId=101&view=requests'],
  ['PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED', 'ACTIVITY_PROPOSAL', 61, '/partner/activities?eventId=101&view=proposals'],
  ['PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED', 'ACTIVITY_REQUEST', 71, '/partner/activities?eventId=101&view=changes'],
  ['PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED', 'ACTIVITY_REQUEST', 71, '/partner/activities?eventId=101&view=cancellations'],
  ['PARTNER_ACTIVITY_CANCELLED', 'ACTIVITY', 81, '/partner/activities/81'],
] as const) {
  test(`${type} opens its Partner-owned target`, async ({ page }) => {
    await setup(page, { notifications: true, notification: { type, referenceType, referenceId } });
    await page.goto('/partner/notifications');

    await page.getByRole('button', { name: /Hồ sơ tham gia đã được duyệt/ }).click();

    await expect.poll(() => { const url = new URL(page.url()); return url.pathname + url.search; }).toBe(target);
  });
}

test('Partner inbox keeps API failure separate from an empty result', async ({ page }) => {
  await setup(page, { notificationsFailure: true });
  await page.goto('/partner/notifications');
  await expect(page.getByRole('alert').filter({ hasText: 'Không tải được thông báo' })).toBeVisible();
  await expect(page.getByText('Bạn chưa có thông báo nào')).toHaveCount(0);
});

test('Partner inbox shows a forbidden response instead of an empty result', async ({ page }) => {
  await setup(page, { notificationsStatus: 403 });
  await page.goto('/partner/notifications');
  await expect(page.getByRole('alert').filter({ hasText: 'Bạn không có quyền xem thông báo Partner.' }).first()).toBeVisible();
  await expect(page.getByText('Bạn chưa có thông báo nào')).toHaveCount(0);
});

test('an expired Partner session shows sign-in instead of an empty inbox', async ({ page }) => {
  await setup(page, { notificationsStatus: 401 });
  await page.goto('/partner/notifications');
  await expect(page.getByRole('button', { name: 'Đăng nhập vào Cổng Đối tác' })).toBeVisible();
  await expect(page.getByText('Bạn chưa có thông báo nào')).toHaveCount(0);
});

test('Partner read failure leaves a notification unread', async ({ page }) => {
  await setup(page, { notifications: true, readFailure: true });
  await page.goto('/partner/notifications');
  await page.getByRole('button', { name: /Hồ sơ tham gia đã được duyệt/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Không thể đánh dấu đã đọc' })).toBeVisible();
  await expect(page).toHaveURL(/\/partner\/notifications$/);
  await page.getByRole('tab', { name: 'Chưa đọc' }).click();
  await expect(page.getByRole('button', { name: /Hồ sơ tham gia đã được duyệt/ })).toBeVisible();
});

test('dashboard shows profile action only when profile is missing', async ({ page }) => {
  await setup(page, { missingProfile: true, empty: true });
  await page.goto('/partner');
  await expect(page.getByRole('heading', { name: 'Công việc cần xử lý' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hoàn thiện hồ sơ tổ chức' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Hoàn thiện hồ sơ/ })).toHaveAttribute('href', '/partner/profile');
});

test('dashboard does not turn an application waiting for management into a partner task', async ({ page }) => {
  await setup(page, { status: 'PENDING' });
  await page.goto('/partner');
  await expect(page.getByRole('heading', { name: 'Chọn gian hàng cho sự kiện đã duyệt' })).toHaveCount(0);
  await expect(page.getByText('Hiện tại bạn không có công việc cần xử lý.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' })).toHaveCount(0);
});

test('my events contains owned applications only, with correctly formatted historical detail', async ({ page }) => {
  await setup(page, { history: true });
  await page.goto('/partner/events');
  await expect(page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sự kiện chưa tham gia' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem hồ sơ', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Sách thiếu nhi và văn học');
  await expect(dialog).toContainText('Hồ sơ hợp lệ');
  await expect(dialog).not.toContainText('Invalid Date');
  await expect(dialog).not.toContainText('NaN');
  await expect(dialog.getByRole('button', { name: 'Rút hồ sơ', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('event cancellation notification link opens the matching owned application', async ({ page }) => {
  await setup(page);
  await page.goto('/partner/events?eventId=101');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Tuần lễ sách của gian hàng');
  await expect(dialog).toContainText('Hồ sơ hợp lệ');
});

test('registration submits notes through existing CSRF-protected API and displays pending application', async ({ page }) => {
  const state = await setup(page, { empty: true });
  await page.goto('/partner/events/apply');
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' }) });
  await card.getByRole('button', { name: 'Xem & đăng ký' }).click();
  await page.getByLabel('Ghi chú đăng ký (không bắt buộc)').fill('  Trưng bày sách mới  ');
  await page.getByRole('button', { name: 'Gửi hồ sơ đăng ký', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Gửi hồ sơ đăng ký thành công' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Xem hồ sơ của tôi/ })).toBeVisible();
  expect(state.submissions).toEqual([{ applicationNote: 'Trưng bày sách mới' }]);
  await page.goto('/partner/events');
  await expect(page.locator('article')).toContainText('Chờ duyệt');
  expect(state.unsupported).toEqual([]);
});

test('closing a linked registration modal keeps the event list without reloading it', async ({ page }) => {
  await setup(page);
  const listRequests: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/events') || path.endsWith('/partner/applications')) listRequests.push(path);
  });
  await page.goto('/partner/events/apply?event=102');
  await expect(page.getByRole('dialog')).toBeVisible();
  const loadedRequests = listRequests.length;

  await page.getByRole('button', { name: 'Để sau', exact: true }).click();

  await expect(page).toHaveURL(/\/partner\/events\/apply$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Đang tải sự kiện công khai…')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Sự kiện chưa tham gia' }).first()).toBeVisible();
  expect(listRequests).toHaveLength(loadedRequests);
});

test('event discovery is independent from application management and exposes event-only filters', async ({ page }) => {
  await setup(page, { empty: true });
  await page.goto('/partner/events/apply');

  await expect(page.getByRole('heading', { name: 'Khám phá và đăng ký sự kiện' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Hồ sơ sự kiện của tôi/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Tất cả hồ sơ/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Khám phá & đăng ký' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Hồ sơ sự kiện của tôi' })).not.toHaveAttribute('aria-current', 'page');
  await page.getByLabel('Tìm kiếm sự kiện công khai').fill('chưa tham gia');
  await expect(page.getByRole('heading', { name: 'Sự kiện chưa tham gia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('partner-event-hub.png'), fullPage: true });
  await page.getByRole('link', { name: /Hồ sơ sự kiện của tôi/ }).click();
  await expect(page).toHaveURL(/\/partner\/events$/);
  await expect(page.getByRole('heading', { name: 'Hồ sơ sự kiện của tôi' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Đăng ký sự kiện mới/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hồ sơ sự kiện của tôi' })).toHaveAttribute('aria-current', 'page');
});

test('event discovery paginates after filtering and resets to the first page', async ({ page }) => {
  await setup(page, { empty: true, eventCount: 14 });
  await page.goto('/partner/events/apply');

  const cards = page.locator('.event-discovery-card');
  await expect(cards).toHaveCount(10);
  await expect(page.getByText('Hiển thị 1–10 trong tổng số 14 sự kiện')).toBeVisible();
  await page.getByRole('link', { name: 'Trang 2', exact: true }).click();
  await expect(cards).toHaveCount(4);
  await expect(page.getByText('Hiển thị 11–14 trong tổng số 14 sự kiện')).toBeVisible();

  await page.getByLabel('Tìm kiếm sự kiện công khai').fill('Sự kiện phân trang 14');
  await expect(cards).toHaveCount(1);
  await expect(page.getByText('Hiển thị 1–1 trong tổng số 1 sự kiện')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trang trước' })).toBeDisabled();
});

test('event discovery links an already applied event to its application detail', async ({ page }) => {
  await setup(page);
  await page.goto('/partner/events/apply');

  const appliedEvent = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' }) });
  await expect(appliedEvent).toContainText('Bạn đã gửi hồ sơ · Đã duyệt');
  await appliedEvent.getByRole('link', { name: /Xem hồ sơ đã gửi/ }).click();

  await expect(page).toHaveURL(/\/partner\/events\?application=31$/);
  await expect(page.getByRole('dialog')).toContainText('Tuần lễ sách của gian hàng');
  await expect(page.getByRole('button', { name: 'Hồ sơ sự kiện của tôi' })).toHaveAttribute('aria-current', 'page');
});

test('application hub searches by application ID and applies real time filters', async ({ page }) => {
  await setup(page, { applicationCount: 2 });
  await page.goto('/partner/events');
  await expect(page.getByText('Tình trạng sự kiện', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Sắp xếp sự kiện')).toHaveCount(0);

  const applicationCards = page.locator('.event-application-card');
  await expect(applicationCards.first()).toContainText('Sự kiện chưa tham gia');
  await page.getByRole('button', { name: 'Sắp xếp hồ sơ', exact: true }).click();
  await page.getByRole('option', { name: 'Nộp cũ nhất', exact: true }).click();
  await expect(applicationCards.first()).toContainText('Tuần lễ sách của gian hàng');
  await page.getByLabel('Tìm kiếm hồ sơ sự kiện').fill('31');
  await expect(page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' })).toBeVisible();
  await expect(page.getByLabel('Sự kiện Đường Sách chưa có ảnh')).toBeVisible();
  await page.getByRole('button', { name: 'Lọc theo thời gian sự kiện', exact: true }).click();
  await page.getByRole('option', { name: 'Đã kết thúc', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lọc theo thời gian sự kiện', exact: true }).click();
  await page.getByRole('option', { name: 'Sắp/đang diễn ra', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sắp xếp hồ sơ', exact: true })).toContainText('Nộp cũ nhất');
  await page.screenshot({ path: test.info().outputPath('partner-application-list.png'), fullPage: true });
});

test('application pagination runs after filtering and resets to the first page', async ({ page }) => {
  await setup(page, { applicationCount: 23 });
  await page.goto('/partner/events');

  const cards = page.locator('.event-application-card');
  await expect(cards).toHaveCount(10);
  await expect(page.getByText('Hiển thị 1–10 trong tổng số 23 hồ sơ')).toBeVisible();
  await page.getByRole('link', { name: 'Trang 3', exact: true }).click();
  await expect(cards).toHaveCount(3);
  await expect(page.getByText('Hiển thị 21–23 trong tổng số 23 hồ sơ')).toBeVisible();

  await page.getByLabel('Tìm kiếm hồ sơ sự kiện').fill('31');
  await expect(cards).toHaveCount(1);
  await expect(page.getByText('Hiển thị 1–1 trong tổng số 1 hồ sơ')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trang trước' })).toBeDisabled();
});

test('pending withdrawal requires confirmation and uses existing withdrawal API', async ({ page }) => {
  const state = await setup(page, { status: 'PENDING' });
  await page.goto('/partner/events');
  const pendingCard = page.locator('.event-application-card').first();
  const statusBounds = await pendingCard.getByText('Chờ duyệt', { exact: true }).boundingBox();
  const detailBounds = await pendingCard.getByRole('button', { name: 'Xem hồ sơ', exact: true }).boundingBox();
  expect(statusBounds!.y + statusBounds!.height).toBeLessThanOrEqual(detailBounds!.y);
  await page.getByRole('button', { name: 'Rút hồ sơ', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('không thể đăng ký lại');
  await page.getByRole('button', { name: 'Giữ hồ sơ', exact: true }).click();
  expect(state.withdrawals).toBe(0);
  await page.getByRole('button', { name: 'Rút hồ sơ', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận rút hồ sơ', exact: true }).click();
  await expect(page.locator('article')).toContainText('Đã rút');
  await expect(page.getByRole('button', { name: /Xóa hồ sơ/ })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('article')).toContainText('Đã rút');
  expect(state.withdrawals).toBe(1);
});

test('event discovery does not expose the retired calendar proposal action', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/partner/events/apply');
  await expect(page.getByRole('heading', { name: 'Khám phá và đăng ký sự kiện' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lịch sự kiện', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Thêm đề xuất ngày/ })).toHaveCount(0);
  expect(state.unsupported).toEqual([]);
});

test('registration disables submission without an active organization profile', async ({ page }) => {
  await setup(page, { missingProfile: true, empty: true });
  await page.goto('/partner/events/apply?event=101');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi hồ sơ đăng ký', exact: true })).toBeDisabled();
});

test('mobile registration keeps cards and detail within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { empty: true });
  await page.goto('/partner/events/apply?event=101');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: test.info().outputPath('partner-mobile-dialog.png'), fullPage: true });
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('mobile application list stacks without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto('/partner/events');
  await expect(page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath('partner-mobile-application-list.png'), fullPage: true });
});

test('separated event pages avoid horizontal overflow at target breakpoints', async ({ page }) => {
  await setup(page, { empty: true });

  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/partner');
    await expect(page.getByRole('heading', { name: 'Xin chào, NXB Demo!' })).toBeVisible();
    expect(await page.locator('.partner-main-viewport').evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
    if (width === 375) await page.screenshot({ path: test.info().outputPath('partner-workspace-mobile.png'), fullPage: true });

    await page.goto('/partner/events');
    await expect(page.getByRole('heading', { name: 'Hồ sơ sự kiện của tôi' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

    await page.goto('/partner/events/apply');
    await expect(page.getByRole('heading', { name: 'Khám phá và đăng ký sự kiện' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
});

test('dashboard reports independent partner and booth loading failures truthfully', async ({ page }) => {
  await setup(page, { applicationsFailure: true, boothFailure: true });
  await page.goto('/partner');
  await expect(page.getByRole('alert')).toContainText('Không thể tải dữ liệu đối tác');
  await expect(page.getByText('Không thể tải dữ liệu gian hàng', { exact: true })).toBeVisible();
});

test('dashboard shows an expiring booth hold as a genuine payment task', async ({ page }) => {
  await setup(page, { boothRequests: [selectedBoothRequest] });
  await page.goto('/partner');
  await expect(page.getByRole('link', { name: /Giữ chỗ còn hiệu lực/ })).toContainText('1');
  await expect(page.getByRole('heading', { name: 'Hoàn tất thanh toán gian A01' })).toBeVisible();
  await expect(page.getByText(/Giữ chỗ đến/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Thanh toán ngay/ })).toHaveAttribute('href', '/partner/booth-requests/51/payment');
});
