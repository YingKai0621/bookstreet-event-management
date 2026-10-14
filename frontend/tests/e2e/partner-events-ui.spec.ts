import { test, expect, type Page, type Route } from '@playwright/test';

const stamp = '2026-10-01T03:00:00Z';
const startAt = '2026-10-18T02:00:00Z';
const endAt = '2026-10-20T05:00:00Z';
const event = { eventId: 101, name: 'Tuần lễ sách của gian hàng', description: 'Giao lưu cùng tác giả và bạn đọc.', startAt, endAt,
  partnerApplicationDeadlineAt: '2026-10-17T16:59:00Z', bannerUrl: null, status: 'PUBLISHED' };
const otherEvent = { ...event, eventId: 102, name: 'Sự kiện chưa tham gia', startAt: '2026-10-25T02:00:00Z', endAt: '2026-10-25T05:00:00Z' };
const application = { applicationId: 31, eventId: 101, partnerOrganizationId: 9, status: 'APPROVED',
  applicationNote: 'Sách thiếu nhi và văn học', reviewNote: 'Hồ sơ hợp lệ', submittedAt: stamp, reviewedAt: stamp, withdrawnAt: null };
function paged(content: unknown[]) { return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 }; }
async function json(route: Route, body: unknown, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); }
async function setup(page: Page, scenario: { status?: string; empty?: boolean; missingProfile?: boolean; history?: boolean; failure?: boolean } = {}) {
  await page.clock.install({ time: new Date('2026-10-14T05:00:00Z') });
  const state = { status: scenario.status || 'APPROVED', submissions: [] as unknown[], unsupported: [] as string[], withdrawals: 0 };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/me')) return json(route, { userId: 2, username: 'partner', fullName: 'Partner Demo', email: 'partner@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'PARTNER'] });
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    if (path.endsWith('/partner/organization')) return scenario.missingProfile ? json(route, { code: 'PARTNER_ORGANIZATION_NOT_FOUND', message: 'Chưa có hồ sơ' }, 404)
      : json(route, { partnerOrganizationId: 9, name: 'NXB Demo', description: '', categoryCode: 'PUBLISHER', logoUrl: null, contactEmail: 'partner@example.com', contactPhone: null, address: null, status: 'ACTIVE' });
    if (path.endsWith('/partner/applications')) return json(route, paged(scenario.empty && state.submissions.length === 0 ? [] : [{ ...application, status: state.status }]));
    if (path.endsWith('/partner/booth-requests')) return json(route, paged([]));
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
    if (path.endsWith('/events')) return scenario.failure ? json(route, { code: 'UNAVAILABLE', message: 'Không thể tải sự kiện' }, 503) : json(route, paged(scenario.history ? [otherEvent] : [event, otherEvent]));
    if (path.endsWith('/heritages')) return json(route, []);
    if (path.includes('/activity-proposals') || path.includes('/notifications') || path.endsWith('/partner/schedule')) state.unsupported.push(path);
    return json(route, { code: 'NOT_FOUND', message: 'Không có API này' }, 404);
  });
  return state;
}

test('dashboard hides completed tasks and shows actual multi-day schedule', async ({ page }) => {
  await setup(page);
  await page.goto('/partner');
  await expect(page.getByRole('heading', { name: 'Việc cần làm' })).toHaveCount(0);
  const calendar = page.getByRole('region', { name: 'Lịch sự kiện' });
  await expect(calendar.getByRole('button', { name: /09:00 Tuần lễ sách/ })).toHaveCount(3);
  await page.screenshot({ path: test.info().outputPath('partner-calendar.png'), fullPage: true });
  await calendar.getByRole('button', { name: 'Xem lịch ngày 2026-10-19', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Tuần lễ sách của gian hàng');
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await calendar.getByRole('button', { name: 'Tháng sau' }).click();
  await expect(calendar).toContainText('tháng 11');
  await calendar.getByRole('button', { name: 'Hôm nay', exact: true }).click();
  await expect(calendar).toContainText('tháng 10');
});

test('dashboard shows profile action only when profile is missing', async ({ page }) => {
  await setup(page, { missingProfile: true, empty: true });
  await page.goto('/partner');
  await expect(page.getByRole('heading', { name: 'Việc cần làm' })).toBeVisible();
  await expect(page.getByText('Hoàn thiện hồ sơ gian hàng', { exact: true })).toBeVisible();
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

test('registration submits notes through existing CSRF-protected API and displays pending application', async ({ page }) => {
  const state = await setup(page, { empty: true });
  await page.goto('/partner/events/apply');
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Tuần lễ sách của gian hàng' }) });
  await card.getByRole('button', { name: 'Xem & đăng ký' }).click();
  await page.getByLabel('Ghi chú đăng ký (không bắt buộc)').fill('  Trưng bày sách mới  ');
  await page.getByRole('button', { name: 'Gửi hồ sơ đăng ký', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã gửi hồ sơ' })).toBeVisible();
  expect(state.submissions).toEqual([{ applicationNote: 'Trưng bày sách mới' }]);
  await page.goto('/partner/events');
  await expect(page.locator('article')).toContainText('Chờ duyệt');
  expect(state.unsupported).toEqual([]);
});

test('pending withdrawal requires confirmation and uses existing withdrawal API', async ({ page }) => {
  const state = await setup(page, { status: 'PENDING' });
  await page.goto('/partner/events');
  await page.getByRole('button', { name: 'Rút hồ sơ', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('không thể đăng ký lại');
  await page.getByRole('button', { name: 'Giữ hồ sơ', exact: true }).click();
  expect(state.withdrawals).toBe(0);
  await page.getByRole('button', { name: 'Rút hồ sơ', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận rút hồ sơ', exact: true }).click();
  await expect(page.locator('article')).toContainText('Đã rút');
  expect(state.withdrawals).toBe(1);
});

test('calendar proposal preselects the day and clearly marks unavailable submission', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/partner/events/apply');
  await page.getByRole('button', { name: 'Lịch sự kiện', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm đề xuất ngày 2026-10-22', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Ngày đề xuất', { exact: true })).toHaveValue('2026-10-22');
  await expect(dialog).toContainText('Thông tin nhập ở đây chưa được lưu');
  await expect(dialog.getByRole('button', { name: 'Gửi đề xuất (chưa khả dụng)', exact: true })).toBeDisabled();
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

test('calendar reports loading failure without claiming an empty schedule', async ({ page }) => {
  await setup(page, { failure: true });
  await page.goto('/partner');
  const calendar = page.getByRole('region', { name: 'Lịch sự kiện' });
  await expect(calendar.getByRole('alert')).toContainText('Không thể tải sự kiện');
  await expect(calendar.getByText('Chưa có sự kiện phù hợp trong tháng này.', { exact: false })).toHaveCount(0);
});

test('dashboard add button opens proposal preview with the selected calendar date', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/partner');
  await page.getByRole('button', { name: 'Thêm đề xuất ngày 2026-10-23', exact: true }).click();
  await page.getByRole('link', { name: 'Thêm đề xuất vào ngày này', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Ngày đề xuất', { exact: true })).toHaveValue('2026-10-23');
  expect(state.unsupported).toEqual([]);
});
