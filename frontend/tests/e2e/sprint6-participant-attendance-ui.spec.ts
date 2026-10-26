import { expect, test, type Page, type Request, type Route } from '@playwright/test';

const ATTENDANCE_TOKEN = 'opaque-activity-token-for-e2e';

const participantAccount = {
  userId: 42,
  username: 'participantdemo',
  fullName: 'Bạn đọc Demo',
  email: 'reader@example.test',
  emailVerified: true,
  status: 'ACTIVE',
  roles: ['PARTICIPANT'],
};

const successfulScan = {
  activityRegistrationId: 401,
  activityId: 91,
  activityTitle: 'Giao lưu tác giả trẻ',
  attendance: {
    attendanceId: 501,
    status: 'VALID',
    recordedSource: 'SELF_SCAN',
    attendedAt: '2027-01-11T01:52:10Z',
    createdAt: '2027-01-11T01:52:10Z',
    updatedAt: '2027-01-11T01:52:10Z',
    voidedAt: null,
  },
  alreadyRecorded: false,
};

interface MockOptions {
  authenticated?: boolean;
  roles?: string[];
  scanReplies?: Array<{ status: number; body: unknown } | 'abort'>;
}

interface MockState {
  scanCount: () => number;
  scanBodies: () => unknown[];
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockAttendanceApp(page: Page, options: MockOptions = {}): Promise<MockState> {
  let authenticated = options.authenticated ?? true;
  let scanCount = 0;
  const scanBodies: unknown[] = [];
  const replies = [...(options.scanReplies ?? [{ status: 200, body: successfulScan }])];

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf-token' });
    }
    if (path.endsWith('/auth/me')) {
      if (!authenticated) return json(route, { code: 'AUTHENTICATION_REQUIRED', message: 'Login required' }, 401);
      return json(route, { ...participantAccount, roles: options.roles ?? participantAccount.roles });
    }
    if (path.endsWith('/auth/login') && method === 'POST') {
      authenticated = true;
      return json(route, {});
    }
    if (path.endsWith('/auth/profile')) {
      return json(route, {
        id: participantAccount.userId,
        fullName: participantAccount.fullName,
        email: participantAccount.email,
        emailVerified: true,
        phone: null,
        avatarUrl: null,
      });
    }
    if (path === '/api/v1/events') {
      return json(route, { content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
    }
    if (path === '/api/v1/heritages') return json(route, []);
    if (path === '/api/v1/participant/notifications') {
      return json(route, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    }
    if (path === '/api/v1/participant/notifications/unread-count') return json(route, { unreadCount: 0 });
    if (path === '/api/v1/participant/attendance-scans' && method === 'POST') {
      scanCount += 1;
      scanBodies.push(route.request().postDataJSON());
      expect(route.request().headers()['x-csrf-token']).toBe('test-csrf-token');
      const reply = replies.shift() ?? { status: 200, body: successfulScan };
      if (reply === 'abort') return route.abort('failed');
      return json(route, reply.body, reply.status);
    }
    if (path.startsWith('/api/v1/participant/')) return json(route, []);
    return json(route, []);
  });

  return {
    scanCount: () => scanCount,
    scanBodies: () => scanBodies,
  };
}

test('anonymous scan scrubs the token, returns through login, and records attendance once', async ({ page }) => {
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const state = await mockAttendanceApp(page, { authenticated: false });

  await page.goto(`/participant/attendance/scan?token=${encodeURIComponent(ATTENDANCE_TOKEN)}`);

  await expect(page).toHaveURL(/\/login$/);
  expect(page.url()).not.toContain(ATTENDANCE_TOKEN);
  await expect(page.locator('body')).not.toContainText(ATTENDANCE_TOKEN);

  await page.getByLabel('Tên đăng nhập').fill('participantdemo');
  await page.locator('#login-password').fill('correct-password');
  await page.getByRole('button', { name: 'Đăng nhập ngay' }).click();

  await expect(page).toHaveURL(/\/participant\/attendance\/scan$/);
  await expect(page.getByRole('heading', { name: 'Điểm danh thành công' })).toBeVisible();
  await expect(page.getByText('Giao lưu tác giả trẻ')).toBeVisible();
  await expect.poll(state.scanCount).toBe(1);
  expect(state.scanBodies()).toEqual([{ token: ATTENDANCE_TOKEN }]);
  await expect(page.locator('body')).not.toContainText(ATTENDANCE_TOKEN);

  for (const request of requests) {
    if (request.isNavigationRequest() && request.resourceType() === 'document') continue;
    expect(request.url()).not.toContain(ATTENDANCE_TOKEN);
    expect(request.headers()['referer'] || '', `referrer leaked to ${request.url()}`).not.toContain(ATTENDANCE_TOKEN);
  }
});

test('idempotent repeat is presented as an existing attendance, not an error', async ({ page }) => {
  const state = await mockAttendanceApp(page, {
    scanReplies: [{ status: 200, body: { ...successfulScan, alreadyRecorded: true } }],
  });

  await page.goto(`/participant/attendance/scan?token=${ATTENDANCE_TOKEN}`);

  await expect(page.getByRole('heading', { name: 'Bạn đã điểm danh trước đó' })).toBeVisible();
  await expect(page.getByText('Không cần quét lại.')).toBeVisible();
  expect(state.scanBodies()).toEqual([{ token: ATTENDANCE_TOKEN }]);
});

for (const scenario of [
  ['ATTENDANCE_QR_NOT_FOUND', 404, 'Mã QR không khả dụng'],
  ['ATTENDANCE_WINDOW_NOT_OPEN', 409, 'Chưa đến giờ điểm danh'],
  ['ATTENDANCE_WINDOW_CLOSED', 409, 'Đã hết thời gian điểm danh'],
  ['ATTENDANCE_ACTIVITY_INELIGIBLE', 409, 'Hoạt động không thể điểm danh'],
  ['ATTENDANCE_REGISTRATION_INELIGIBLE', 409, 'Không tìm thấy đăng ký hợp lệ'],
] as const) {
  test(`${scenario[0]} maps to a safe participant message`, async ({ page }) => {
    const [code, status, heading] = scenario;
    const state = await mockAttendanceApp(page, {
      scanReplies: [{ status, body: { code, message: `backend detail for ${code}` } }],
    });

    await page.goto(`/participant/attendance/scan?token=${ATTENDANCE_TOKEN}`);

    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('backend detail');
    await expect(page.getByRole('button', { name: 'Thử lại' })).toHaveCount(0);
    await expect.poll(state.scanCount).toBe(1);
  });
}

test('transient network failure allows one controlled retry with the in-memory token', async ({ page }) => {
  const state = await mockAttendanceApp(page, {
    scanReplies: ['abort', { status: 200, body: successfulScan }],
  });

  await page.goto(`/participant/attendance/scan?token=${ATTENDANCE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Chưa thể kết nối' })).toBeVisible();
  await expect.poll(state.scanCount).toBe(1);

  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: 'Điểm danh thành công' })).toBeVisible();
  await expect.poll(state.scanCount).toBe(2);
  expect(state.scanBodies()).toEqual([{ token: ATTENDANCE_TOKEN }, { token: ATTENDANCE_TOKEN }]);
});

test('missing or duplicated token is scrubbed and never calls the scan API', async ({ page }) => {
  const state = await mockAttendanceApp(page);

  await page.goto(`/participant/attendance/scan?token=${ATTENDANCE_TOKEN}&token=second-token`);

  await expect(page).toHaveURL(/\/participant\/attendance\/scan$/);
  await expect(page.getByRole('heading', { name: 'Liên kết QR không hợp lệ' })).toBeVisible();
  expect(state.scanCount()).toBe(0);

  await page.goto('/participant/attendance/scan');
  await expect(page.getByRole('heading', { name: 'Không có mã điểm danh' })).toBeVisible();
  expect(state.scanCount()).toBe(0);
});

test('a non-participant account cannot invoke participant attendance scan', async ({ page }) => {
  const state = await mockAttendanceApp(page, { roles: ['ORGANIZER'] });

  await page.goto(`/participant/attendance/scan?token=${ATTENDANCE_TOKEN}`);

  await expect(page).toHaveURL(/\/login$/);
  expect(page.url()).not.toContain(ATTENDANCE_TOKEN);
  expect(state.scanCount()).toBe(0);
});

test('legacy personal QR route redirects to the participant activity list', async ({ page }) => {
  await mockAttendanceApp(page);

  await page.goto('/participant/activities/qr/91');

  await expect(page).toHaveURL(/\/participant\/activities$/);
  await expect(page.getByText('Mã QR Check-in Tham Gia')).toHaveCount(0);
});

for (const viewport of [
  { width: 1600, height: 900 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`scan result remains readable without horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockAttendanceApp(page);

    await page.goto(`/participant/attendance/scan?token=${ATTENDANCE_TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Điểm danh thành công' })).toBeVisible();

    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    await expect(page.locator('.attendance-scan-card')).toBeInViewport();
  });
}
