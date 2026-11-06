import { expect, test, type Page, type Route } from '@playwright/test';

const event = { eventId: 501, organizerUserId: 1, name: 'Ngày hội đọc sách', description: 'Sự kiện kiểm thử', startAt: '2027-03-20T02:00:00Z', endAt: '2027-03-21T10:00:00Z', status: 'PUBLISHED', createdAt: '2026-10-28T00:00:00Z', updatedAt: '2026-10-28T00:00:00Z', maxBoothsPerPartner: 2, maxActivitiesPerPartner: 3, boothPaymentWindowMinutes: 1440 };
const badge = { badgeId: 41, name: 'Nhà thám hiểm', description: 'Ghé thăm các gian hàng sách.', requiredPoints: 30, iconUrl: null, isActive: true, awardedUserCount: 84, remainingEligibleCount: 3, createdAt: '2026-10-28T08:00:00Z', updatedAt: '2026-10-28T08:00:00Z' };
const group = { boothAssignmentId: 601, booth: { boothId: 22, code: 'A01', name: 'Nhà sách Trẻ' }, assignmentStatus: 'ENDED', visitCount: 18, lastVisitedAt: '2026-10-28T08:20:00Z' };
const visit = { boothVisitId: 701, eventRegistrationId: 301, visitedAt: '2026-10-28T08:20:00Z', participant: { userId: 88, displayName: 'Nguyễn Minh Anh' }, boothAssignmentId: group.boothAssignmentId, booth: group.booth, assignmentStatus: group.assignmentStatus };
const pageOf = <T>(content: T[], page = 0, total = content.length) => ({ content, page, size: 20, totalElements: total, totalPages: Math.ceil(total / 20) });
const json = (route: Route, value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });

async function mock(page: Page, role: 'ADMIN' | 'ORGANIZER', options: { empty?: boolean; forbidden?: boolean; conflict?: boolean; failSync?: boolean } = {}) {
  let current = { ...badge };
  let failSync = options.failSync;
  const calls: Array<{ path: string; method: string; query: URLSearchParams; body: unknown }> = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    calls.push({ path, method, query: url.searchParams, body: request.postData() ? request.postDataJSON() : null });
    if (path.endsWith('/auth/me')) return json(route, { userId: 1, username: 'manager', fullName: 'Quản lý kiểm thử', email: 'manager@example.test', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', role] });
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    if (path.endsWith('/organizer/events')) return json(route, pageOf([event, { ...event, eventId: 502, name: 'Sự kiện khác' }]));
    if (path.endsWith('/organizer/events/501')) return json(route, event);
    if (path.endsWith('/organizer/events/502')) return json(route, { ...event, eventId: 502, name: 'Sự kiện khác' });
    if (path.endsWith('/organizer/activities')) return json(route, pageOf([]));
    if (path.endsWith('/event-registrations')) return json(route, pageOf([]));
    if (path.includes('/booth-visits') || path.includes('/booth-visit-groups')) {
      if (options.forbidden) return json(route, { code: 'EVENT_NOT_FOUND', message: 'Event not found' }, 404);
      const empty = options.empty || path.includes('/502/');
      if (path.endsWith('/summary')) return json(route, { eventId: 501, totalVisits: empty ? 0 : 126, uniqueParticipants: empty ? 0 : 84, visitedBoothAssignments: empty ? 0 : 12 });
      if (path.endsWith('/booth-visit-groups')) return json(route, pageOf(empty ? [] : [group], Number(url.searchParams.get('page')), empty ? 0 : 25));
      return json(route, pageOf(empty ? [] : [visit]));
    }
    if (path.endsWith('/synchronize-awards')) {
      if (failSync) { failSync = false; return json(route, { code: 'REQUEST_FAILED', message: 'Tạm thời chưa thể đồng bộ.' }, 500); }
      current = { ...current, remainingEligibleCount: 0, awardedUserCount: 87 };
      return json(route, { badgeId: 41, processedCount: 3, awardedCount: 3, remainingEligibleCount: 0, completed: true });
    }
    if (path.endsWith('/admin/badges') && method === 'GET') {
      if (options.forbidden) return json(route, { code: 'ACCESS_DENIED', message: 'Forbidden' }, 403);
      return json(route, pageOf(options.empty ? [] : [current], Number(url.searchParams.get('page')), options.empty ? 0 : 25));
    }
    if (path.endsWith('/admin/badges/41') && method === 'GET') return json(route, current);
    if ((path.endsWith('/admin/badges') || path.endsWith('/admin/badges/41')) && ['POST', 'PUT'].includes(method)) {
      if (options.conflict) return json(route, { code: 'BADGE_NAME_CONFLICT', message: 'Conflicting normalized name.' }, 409);
      current = { ...current, ...request.postDataJSON() };
      return json(route, { badge: current, synchronizationTriggered: current.isActive }, method === 'POST' ? 201 : 200);
    }
    return json(route, { code: 'UNEXPECTED_TEST_ROUTE', message: path }, 404);
  });
  return calls;
}

test('Organizer shows historical groups, filters visits and switches the selected Event without unrelated calls', async ({ page }) => {
  const calls = await mock(page, 'ORGANIZER');
  await page.goto('/organizer/participants?eventId=501&view=booth');
  await expect(page.getByText('126', { exact: true })).toBeVisible();
  await expect(page.getByText('Đã kết thúc', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem lượt ghé A01' }).click();
  await expect(page.getByText('Nguyễn Minh Anh', { exact: true })).toBeVisible();
  expect(calls.some(call => call.path.endsWith('/booth-visits') && call.query.get('boothId') === '22')).toBeTruthy();
  await page.getByLabel('Tìm lượt ghé').fill('Nguyễn');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect.poll(() => calls.some(call => call.query.get('search') === 'Nguyễn')).toBeTruthy();
  await page.locator('.participant-event-select select').selectOption('502');
  await expect(page.getByText('Chưa có lượt ghé phù hợp', { exact: true })).toBeVisible();
  expect(calls.filter(call => call.path.includes('/booth-visits') || call.path.includes('/booth-visit-groups')).at(-1)?.path).toContain('/502/');
  expect(calls.some(call => call.path.endsWith('/organizer/activities') || call.path.endsWith('/event-registrations'))).toBeFalsy();
  await page.getByRole('tab', { name: 'Đăng ký hoạt động' }).click();
  await expect.poll(() => calls.some(call => call.path.endsWith('/organizer/activities'))).toBeTruthy();
});

test('Organizer paginates groups and reports ownership-safe errors', async ({ page }) => {
  const calls = await mock(page, 'ORGANIZER');
  await page.goto('/organizer/participants?eventId=501&view=booth');
  await page.getByRole('link', { name: 'Trang 2', exact: true }).click();
  await expect.poll(() => calls.some(call => call.path.endsWith('/booth-visit-groups') && call.query.get('page') === '1')).toBeTruthy();
  await page.unroute('**/api/v1/**');
  await mock(page, 'ORGANIZER', { forbidden: true });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Không tìm thấy sự kiện thuộc quyền quản lý' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem lượt ghé A01' })).toHaveCount(0);
});

test('Admin creates only approved fields, edits and toggles through real contract adapters', async ({ page }) => {
  const calls = await mock(page, 'ADMIN');
  await page.goto('/admin/badges');
  await page.getByRole('button', { name: 'Thêm huy hiệu', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên huy hiệu').fill('Bạn của sách');
  await dialog.getByLabel('Ngưỡng điểm').fill('50');
  await dialog.getByLabel('Trạng thái áp dụng').selectOption('true');
  await dialog.getByLabel('Mô tả').fill('Tích lũy điểm qua các sự kiện.');
  await dialog.getByRole('button', { name: 'Lưu huy hiệu' }).click();
  await expect(dialog).toHaveCount(0);
  const created = calls.find(call => call.method === 'POST' && call.path.endsWith('/admin/badges'));
  expect(created?.body).toEqual({ name: 'Bạn của sách', description: 'Tích lũy điểm qua các sự kiện.', requiredPoints: 50, iconUrl: null, isActive: true });
  await page.getByRole('button', { name: 'Sửa Bạn của sách' }).click();
  await dialog.getByLabel('Ngưỡng điểm').fill('20');
  await dialog.getByRole('button', { name: 'Lưu huy hiệu' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kích hoạt', exact: true })).toBeVisible();
  expect(calls.some(call => call.path.includes('badge-rules') || call.path.includes('/admin/settings'))).toBeFalsy();
});

test('Admin conflict retains the modal and values, Escape closes it', async ({ page }) => {
  await mock(page, 'ADMIN', { conflict: true });
  await page.goto('/admin/badges');
  await page.getByRole('button', { name: 'Sửa Nhà thám hiểm' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Lưu huy hiệu' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Tên huy hiệu đã được sử dụng');
  await expect(dialog.getByLabel('Tên huy hiệu')).toHaveValue('Nhà thám hiểm');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Admin resumes synchronization after failure and refreshes only the Badge catalog', async ({ page }) => {
  const calls = await mock(page, 'ADMIN', { failSync: true });
  await page.goto('/admin/badges');
  await page.getByRole('button', { name: 'Đồng bộ phần thưởng', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Có thể thử đồng bộ lại');
  await page.getByRole('button', { name: 'Đồng bộ phần thưởng', exact: true }).click();
  await expect(page.locator('.badge-notice')).toContainText('Đã đồng bộ đầy đủ');
  await expect(page.getByText('87 người', { exact: true })).toBeVisible();
  const count = calls.length;
  await page.clock.install();
  await page.clock.fastForward(60_000);
  expect(calls.length).toBe(count);
  // The workspace shell owns the entry-time profile load and the bounded inbox refresh.
  expect(calls.filter(call => call.path.includes('/admin/')
    && !call.path.includes('/admin/notifications') && !call.path.endsWith('/admin/profile'))
    .every(call => call.path.includes('/admin/badges'))).toBeTruthy();
});

test('Admin uses server pagination and filters with empty and forbidden states', async ({ page }) => {
  const calls = await mock(page, 'ADMIN');
  await page.goto('/admin/badges');
  await page.getByRole('link', { name: 'Trang 2', exact: true }).click();
  await expect.poll(() => calls.some(call => call.query.get('page') === '1')).toBeTruthy();
  await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption('false');
  await expect.poll(() => calls.some(call => call.query.get('active') === 'false' && call.query.get('page') === '0')).toBeTruthy();
  await page.unroute('**/api/v1/**'); await mock(page, 'ADMIN', { empty: true }); await page.reload();
  await expect(page.getByText('Chưa có huy hiệu phù hợp', { exact: true })).toBeVisible();
  await page.unroute('**/api/v1/**'); await mock(page, 'ADMIN', { forbidden: true }); await page.reload();
  await expect(page.getByRole('alert')).toContainText('Bạn không có quyền quản lý huy hiệu');
  await expect(page.getByRole('heading', { name: 'Nhà thám hiểm', exact: true })).toHaveCount(0);
});

test('Admin Badge catalog fits a phone viewport and keeps actions visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page, 'ADMIN');
  await page.goto('/admin/badges');
  await expect(page.getByRole('heading', { name: 'Nhà thám hiểm' })).toBeVisible();
  const bounds = await page.evaluate(() => {
    const card = document.querySelector('.badge-catalog-card')?.getBoundingClientRect();
    const action = document.querySelector('.badge-card-actions button:last-child')?.getBoundingClientRect();
    const filters = document.querySelector('.badge-catalog-filters')?.getBoundingClientRect();
    return { card: [card?.left, card?.right], action: [action?.left, action?.right], filters: [filters?.left, filters?.right], width: window.innerWidth };
  });
  expect(bounds.card[0]).toBeGreaterThanOrEqual(0);
  expect(bounds.card[1]).toBeLessThanOrEqual(bounds.width);
  expect(bounds.action[1]).toBeLessThanOrEqual(bounds.width);
  expect(bounds.filters[1]).toBeLessThanOrEqual(bounds.width);
});

test('Organizer Booth monitoring keeps summary and controls usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page, 'ORGANIZER');
  await page.goto('/organizer/participants?eventId=501&view=booth');
  await expect(page.getByText('Tổng lượt ghé')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem lượt ghé A01' })).toBeVisible();
  const bounds = await page.evaluate(() => {
    const panel = document.querySelector('.booth-visit-panel')?.getBoundingClientRect();
    const search = document.querySelector('.booth-visit-panel .participant-search')?.getBoundingClientRect();
    return { panel: [panel?.left, panel?.right], search: [search?.left, search?.right], width: window.innerWidth };
  });
  expect(bounds.panel[0]).toBeGreaterThanOrEqual(0);
  expect(bounds.panel[1]).toBeLessThanOrEqual(bounds.width);
  expect(bounds.search[1]).toBeLessThanOrEqual(bounds.width);
});
