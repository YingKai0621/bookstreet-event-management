import { expect, test, type Page, type Request, type Route } from '@playwright/test';

const BOOTH_TOKEN = 'opaque-booth-assignment-token-for-e2e';

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
  boothVisit: {
    boothVisitId: 701,
    eventRegistrationId: 301,
    boothAssignmentId: 601,
    event: { eventId: 7, name: 'Ngày hội sách cuối tuần' },
    booth: { boothId: 22, code: 'A01', name: 'Gian hàng Nhà sách Trẻ' },
    visitedAt: '2026-10-28T08:20:00Z',
  },
  eventRegistrationAction: 'CREATED',
  visitPoints: 10,
  newlyAwardedPoints: 10,
  totalPoints: 30,
  alreadyVisited: false,
  newlyUnlockedBadges: [],
};

interface MockOptions {
  authenticated?: boolean;
  scanReplies?: Array<{ status: number; body: unknown } | 'abort'>;
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockBoothScanApp(page: Page, options: MockOptions = {}) {
  let authenticated = options.authenticated ?? true;
  let scanCount = 0;
  const scanBodies: unknown[] = [];
  const rewardRequests: string[] = [];
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
      return json(route, participantAccount);
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
    if (path === '/api/v1/participant/notifications') {
      return json(route, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    }
    if (path === '/api/v1/participant/notifications/unread-count') {
      return json(route, { unreadCount: 0 });
    }
    if (path === '/api/v1/participant/rewards/summary') {
      rewardRequests.push(url.toString());
      return json(route, {
        totalPoints: 30,
        totalVisits: 3,
        earnedBadgeCount: 1,
        activeBadgeCount: 2,
        nextBadge: {
          badgeId: 2, name: 'Nhà thám hiểm', description: null, iconUrl: null,
          requiredPoints: 50, isActive: true, state: 'IN_PROGRESS', earned: false,
          earnedAt: null, remainingPoints: 20, progressPercent: 60,
        },
      });
    }
    if (path === '/api/v1/participant/rewards/badges') {
      rewardRequests.push(url.toString());
      const earned = {
        badgeId: 1, name: 'Khởi đầu', description: 'Ghé gian hàng đầu tiên.', iconUrl: null,
        requiredPoints: 10, isActive: true, state: 'EARNED', earned: true,
        earnedAt: '2026-10-28T08:20:00Z', remainingPoints: 0, progressPercent: 100,
      };
      const progress = {
        badgeId: 2, name: 'Nhà thám hiểm', description: null, iconUrl: null,
        requiredPoints: 50, isActive: true, state: 'IN_PROGRESS', earned: false,
        earnedAt: null, remainingPoints: 20, progressPercent: 60,
      };
      const content = url.searchParams.get('state') === 'EARNED' ? [earned] : [earned, progress];
      return json(route, { content, page: 0, size: 12, totalElements: content.length, totalPages: 1 });
    }
    if (path === '/api/v1/participant/rewards/point-transactions') {
      rewardRequests.push(url.toString());
      const pageNumber = Number(url.searchParams.get('page') || 0);
      const content = pageNumber === 0 ? [{
        pointTransactionId: 901,
        boothVisitId: 701,
        boothAssignmentId: 601,
        points: 10,
        createdAt: '2026-10-28T08:20:00Z',
        visitedAt: '2026-10-28T08:20:00Z',
        event: { eventId: 7, name: 'Ngày hội sách cuối tuần' },
        booth: { boothId: 22, code: 'A01', name: 'Gian hàng Nhà sách Trẻ' },
      }] : [];
      return json(route, { content, page: pageNumber, size: 10, totalElements: 11, totalPages: 2 });
    }
    if (path === '/api/v1/participant/booth-visits/scan' && method === 'POST') {
      scanCount += 1;
      scanBodies.push(route.request().postDataJSON());
      expect(route.request().headers()['x-csrf-token']).toBe('test-csrf-token');
      const reply = replies.shift() ?? { status: 200, body: successfulScan };
      if (reply === 'abort') return route.abort('failed');
      return json(route, reply.body, reply.status);
    }
    return json(route, []);
  });

  return {
    scanCount: () => scanCount,
    scanBodies: () => scanBodies,
    rewardRequests: () => rewardRequests,
  };
}

test('anonymous Booth scan scrubs fragment, resumes after login and sends token only in JSON body', async ({ page }) => {
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  const state = await mockBoothScanApp(page, { authenticated: false });

  await page.goto(`/participant/booth-scan#token=${encodeURIComponent(BOOTH_TOKEN)}`);

  await expect(page).toHaveURL(/\/login$/);
  expect(page.url()).not.toContain(BOOTH_TOKEN);
  await expect(page.locator('body')).not.toContainText(BOOTH_TOKEN);

  await page.getByLabel('Tên đăng nhập').fill('participantdemo');
  await page.locator('#login-password').fill('correct-password');
  await page.getByRole('button', { name: 'Đăng nhập ngay' }).click();

  await expect(page).toHaveURL(/\/participant\/booth-scan$/);
  await expect(page.getByRole('heading', { name: 'Ghi nhận lượt ghé thành công' })).toBeVisible();
  await expect(page.getByText('Gian hàng Nhà sách Trẻ')).toBeVisible();
  await expect(page.getByText('+10')).toBeVisible();
  await expect.poll(state.scanCount).toBe(1);
  expect(state.scanBodies()).toEqual([{ token: BOOTH_TOKEN }]);

  for (const request of requests) {
    if (request.isNavigationRequest() && request.resourceType() === 'document') continue;
    expect(request.url()).not.toContain(BOOTH_TOKEN);
    expect(request.headers()['referer'] || '').not.toContain(BOOTH_TOKEN);
  }
});

test('duplicate scan is a successful achieved result with no new points', async ({ page }) => {
  const state = await mockBoothScanApp(page, {
    scanReplies: [{
      status: 200,
      body: {
        ...successfulScan,
        eventRegistrationAction: 'REUSED',
        newlyAwardedPoints: 0,
        alreadyVisited: true,
      },
    }],
  });

  await page.goto(`/participant/booth-scan#token=${BOOTH_TOKEN}`);

  await expect(page.getByRole('heading', { name: 'Bạn đã ghé gian hàng này' })).toBeVisible();
  await expect(page.getByText('hệ thống không cộng điểm trùng')).toBeVisible();
  expect(state.scanBodies()).toEqual([{ token: BOOTH_TOKEN }]);
});

for (const scenario of [
  ['BOOTH_QR_NOT_FOUND', 404, 'Mã QR gian hàng không hợp lệ'],
  ['BOOTH_VISIT_WINDOW_NOT_OPEN', 409, 'Sự kiện chưa mở lượt ghé'],
  ['BOOTH_VISIT_WINDOW_CLOSED', 409, 'Sự kiện đã kết thúc'],
  ['BOOTH_ASSIGNMENT_INELIGIBLE', 409, 'Gian hàng không còn nhận lượt ghé'],
  ['BOOTH_VISIT_RELATIONSHIP_INVALID', 409, 'Không thể xác minh gian hàng'],
] as const) {
  test(`${scenario[0]} maps to a safe Booth-scan state`, async ({ page }) => {
    const [code, status, heading] = scenario;
    const state = await mockBoothScanApp(page, {
      scanReplies: [{ status, body: { code, message: `private backend detail for ${code}` } }],
    });

    await page.goto(`/participant/booth-scan#token=${BOOTH_TOKEN}`);

    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('private backend detail');
    await expect(page.getByRole('button', { name: 'Thử lại' })).toHaveCount(0);
    await expect.poll(state.scanCount).toBe(1);
  });
}

test('network failure keeps only in-memory token for a controlled retry', async ({ page }) => {
  const state = await mockBoothScanApp(page, {
    scanReplies: ['abort', { status: 200, body: successfulScan }],
  });

  await page.goto(`/participant/booth-scan#token=${BOOTH_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Chưa thể kết nối' })).toBeVisible();
  expect(page.url()).not.toContain(BOOTH_TOKEN);

  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: 'Ghi nhận lượt ghé thành công' })).toBeVisible();
  await expect.poll(state.scanCount).toBe(2);
  expect(state.scanBodies()).toEqual([{ token: BOOTH_TOKEN }, { token: BOOTH_TOKEN }]);
});

test('missing or duplicated fragment token never calls scan API', async ({ page }) => {
  const state = await mockBoothScanApp(page);

  await page.goto(`/participant/booth-scan#token=${BOOTH_TOKEN}&token=second-token`);
  await expect(page).toHaveURL(/\/participant\/booth-scan$/);
  await expect(page.getByRole('heading', { name: 'Liên kết QR không hợp lệ' })).toBeVisible();
  expect(state.scanCount()).toBe(0);

  await page.goto('/participant/booth-scan');
  await expect(page.getByRole('heading', { name: 'Không có mã gian hàng' })).toBeVisible();
  expect(state.scanCount()).toBe(0);
});

test('scan result is mobile-readable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBoothScanApp(page);

  await page.goto(`/participant/booth-scan#token=${BOOTH_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Ghi nhận lượt ghé thành công' })).toBeVisible();

  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  await expect(page.locator('.booth-scan-card')).toBeInViewport();
});

test('participant rewards renders real summary, badges and paged point history', async ({ page }) => {
  const state = await mockBoothScanApp(page);

  await page.goto('/participant/rewards');

  await expect(page.getByRole('heading', { name: 'Điểm & Huy hiệu' })).toBeVisible();
  await expect(page.getByText('Nhà thám hiểm').first()).toBeVisible();
  await expect(page.getByText('Gian hàng Nhà sách Trẻ')).toBeVisible();
  await expect(page.getByText('+10')).toBeVisible();

  await page.getByLabel('Lọc huy hiệu').selectOption('EARNED');
  await expect.poll(() => state.rewardRequests().some(request => request.includes('state=EARNED')))
    .toBe(true);
  await expect(page.getByText('Khởi đầu')).toBeVisible();

  const history = page.locator('.reward-history-section');
  await history.getByRole('button', { name: 'Sau' }).click();
  await expect.poll(() => state.rewardRequests().some(request => request.includes('page=1')))
    .toBe(true);
  await expect(history.getByText('Chưa có giao dịch điểm')).toBeVisible();
});

test('participant rewards remains readable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBoothScanApp(page);

  await page.goto('/participant/rewards');
  await expect(page.getByRole('heading', { name: 'Điểm & Huy hiệu' })).toBeVisible();

  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
});
