import { expect, type Page, type Route, test } from '@playwright/test';

const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * 86_400_000).toISOString();

const events = [
  { eventId: 101, name: 'Hội sách mùa thu', description: '', startAt: iso(-1), endAt: iso(1), partnerApplicationDeadlineAt: iso(-10), bannerUrl: null, status: 'PUBLISHED' },
  { eventId: 102, name: 'Ngày hội sách trẻ', description: '', startAt: iso(5), endAt: iso(7), partnerApplicationDeadlineAt: iso(-5), bannerUrl: null, status: 'PUBLISHED' },
  { eventId: 103, name: 'Tuần lễ văn hóa đọc', description: '', startAt: iso(-12), endAt: iso(-10), partnerApplicationDeadlineAt: iso(-20), bannerUrl: null, status: 'PUBLISHED' },
];

const applications = events.map((event, index) => ({
  applicationId: 31 + index,
  eventId: event.eventId,
  partnerOrganizationId: 9,
  status: 'APPROVED',
  applicationNote: null,
  reviewNote: null,
  submittedAt: iso(-25),
  reviewedAt: iso(-24),
  withdrawnAt: null,
}));

const requests = events.map((event, index) => ({
  boothRequestId: 77 + index,
  eventId: event.eventId,
  boothId: 11 + index,
  boothCode: ['A05', 'B02', 'C03'][index],
  partnerOrganizationId: 9,
  partnerOrganizationName: 'NXB Demo',
  status: 'COMPLETED',
  requestNote: null,
  reviewNote: null,
  submittedAt: iso(-24),
  reviewedAt: iso(-23),
  selectedAt: iso(-22),
  completedAt: iso(-21 + index),
  paymentExpiredAt: null,
  withdrawnAt: null,
  hold: {
    boothHoldId: 501 + index,
    status: 'CONSUMED',
    lockedRentalPrice: index === 1 ? 0 : 5_000_000 + index * 500_000,
    createdAt: iso(-22),
    expiresAt: iso(-21),
    releasedAt: null,
  },
}));

const assignments = requests.map((request, index) => ({
  boothAssignmentId: 201 + index,
  boothHoldId: request.hold.boothHoldId,
  boothRequestId: request.boothRequestId,
  eventId: request.eventId,
  boothId: request.boothId,
  boothCode: request.boothCode,
  partnerOrganizationId: 9,
  partnerOrganizationName: 'NXB Demo',
  lockedRentalPrice: request.hold.lockedRentalPrice,
  qrToken: `47d85df4-c665-4a0d-844b-544f34c6d8f${index}`,
  coverImageUrl: null,
  status: 'ACTIVE',
  assignedAt: iso(-3 + index),
  releasedAt: null,
  releaseReason: null,
}));

const payments = [{
  boothPaymentId: 401,
  boothRequestId: 77,
  boothHoldId: 501,
  transactionType: 'PAYMENT',
  purpose: 'INITIAL_BOOTH_RENTAL',
  amount: 5_000_000,
  status: 'SUCCESS',
  idempotencyKey: 'assigned-booth-payment-401',
  gatewayProvider: 'VNPAY',
  gatewayTransactionRef: 'VNPAY-401',
  failureCode: null,
  failureMessage: null,
  reconciliationRequired: false,
  createdAt: iso(-22),
  updatedAt: iso(-21),
  completedAt: iso(-21),
}];

function paged(content: unknown[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockPartner(page: Page, empty = false) {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    }
    if (path.endsWith('/auth/me')) {
      return json(route, {
        userId: 2,
        username: 'partner',
        fullName: 'Partner Demo',
        email: 'partner@example.com',
        emailVerified: true,
        status: 'ACTIVE',
        roles: ['PARTICIPANT', 'PARTNER'],
      });
    }
    if (path.endsWith('/partner/organization')) {
      return json(route, {
        partnerOrganizationId: 9,
        name: 'NXB Demo',
        description: '',
        categoryCode: 'PUBLISHER',
        logoUrl: null,
        contactEmail: 'partner@example.com',
        contactPhone: null,
        address: null,
        status: 'ACTIVE',
      });
    }
    if (path.endsWith('/partner/applications')) return json(route, paged(applications));
    if (path === '/api/v1/events') return json(route, paged(events));
    const eventDetailMatch = path.match(/\/events\/(\d+)$/);
    if (eventDetailMatch) {
      const event = events.find(item => item.eventId === Number(eventDetailMatch[1]));
      return event ? json(route, event) : json(route, { code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy sự kiện.' }, 404);
    }

    const assignmentMatch = path.match(/\/partner\/booth-requests\/(\d+)\/assignment$/);
    if (assignmentMatch) {
      const assignment = assignments.find(item => item.boothRequestId === Number(assignmentMatch[1]));
      return assignment ? json(route, assignment) : json(route, { code: 'BOOTH_ASSIGNMENT_NOT_FOUND', message: 'Không tìm thấy.' }, 404);
    }

    const paymentHistoryMatch = path.match(/\/partner\/booth-requests\/(\d+)\/payments$/);
    if (paymentHistoryMatch) {
      return json(route, paged(payments.filter(item => item.boothRequestId === Number(paymentHistoryMatch[1]))));
    }

    const requestDetailMatch = path.match(/\/partner\/booth-requests\/(\d+)$/);
    if (requestDetailMatch) {
      const request = requests.find(item => item.boothRequestId === Number(requestDetailMatch[1]));
      return request ? json(route, request) : json(route, { code: 'BOOTH_REQUEST_NOT_FOUND', message: 'Không tìm thấy.' }, 404);
    }

    if (path.endsWith('/partner/booth-requests')) {
      if (empty) return json(route, paged([]));
      const eventId = url.searchParams.get('eventId');
      return json(route, paged(eventId ? requests.filter(request => String(request.eventId) === eventId) : requests));
    }

    const eventBoothsMatch = path.match(/\/events\/(\d+)\/booths$/);
    if (eventBoothsMatch) {
      const eventId = Number(eventBoothsMatch[1]);
      const request = requests.find(item => item.eventId === eventId)!;
      return json(route, paged([{
        eventBoothConfigId: 301,
        eventId,
        booth: {
          boothId: request.boothId,
          code: request.boothCode,
          name: `Gian ${request.boothCode}`,
          description: 'Gian hàng đã được cấp cho đối tác.',
          maxCapacity: 8,
          mapX: 45,
          mapY: 50,
          active: true,
          categoryCode: 'LITERATURE',
          note: null,
        },
        rentalPrice: request.hold.lockedRentalPrice,
        enabled: true,
        availability: 'ASSIGNED',
      }]));
    }

    if (path.includes('/participant/')) return json(route, paged([]));
    return json(route, { code: 'NOT_FOUND', message: `${route.request().method()} ${path}` }, 404);
  });
}

test('Partner sees assigned Booths by Event phase, opens QR and locates own Booth on the map', async ({ page }) => {
  await mockPartner(page);
  await page.goto('/partner/booths');

  await expect(page.getByRole('heading', { name: 'Gian hàng của tôi' })).toBeVisible();
  await expect(page.locator('.my-booth-card')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Sắp diễn ra/ })).toContainText('1');
  await expect(page.getByRole('button', { name: /Đang diễn ra/ })).toContainText('1');
  await expect(page.getByRole('button', { name: /Đã kết thúc/ })).toContainText('1');

  await page.getByRole('button', { name: /Sắp diễn ra/ }).click();
  await expect(page.locator('.my-booth-card')).toHaveCount(1);
  await expect(page.locator('.my-booth-card')).toContainText('Ngày hội sách trẻ');
  await page.getByRole('button', { name: 'Lọc theo thời gian sự kiện' }).click();
  await page.getByRole('option', { name: 'Tất cả thời gian' }).click();

  const search = page.getByRole('searchbox', { name: 'Tìm gian hàng đã được cấp' });
  await search.fill('C03');
  await expect(page.locator('.my-booth-card')).toHaveCount(1);
  await expect(page.locator('.my-booth-card')).toContainText('Tuần lễ văn hóa đọc');
  await search.fill('');

  const currentBooth = page.locator('.my-booth-card').filter({ hasText: 'Hội sách mùa thu' });
  await expect(currentBooth.getByRole('heading', { name: 'Gian A05' })).toBeVisible();
  await expect(currentBooth.getByRole('link', { name: /Chi tiết/ })).toBeVisible();
  await expect(currentBooth.getByRole('link', { name: /Quản lý hoạt động/ })).toBeVisible();
  await currentBooth.getByRole('button', { name: 'Xem QR' }).click();
  const qrDialog = page.getByRole('dialog', { name: /Gian A05/ });
  await expect(qrDialog).toBeVisible();
  await expect(qrDialog.getByRole('img', { name: 'Mã QR gian hàng A05' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(qrDialog).toHaveCount(0);

  await currentBooth.getByRole('link', { name: /Chi tiết/ }).click();
  await expect(page).toHaveURL(/\/partner\/booths\/77$/);
  await expect(page.getByRole('button', { name: 'Gian hàng của tôi' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Gian A05', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lịch sử thanh toán' })).toBeVisible();
  await expect(page.getByText('VNPAY-401')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Mã QR gian hàng A05' })).toBeVisible();
  await page.getByRole('link', { name: 'Quay lại Gian hàng của tôi' }).click();

  const returnedBooth = page.locator('.my-booth-card').filter({ hasText: 'Hội sách mùa thu' });
  await returnedBooth.getByRole('link', { name: /Bản đồ/ }).click();
  await expect(page).toHaveURL(/\/partner\/booth-requests\?eventId=101&boothId=11/);
  await expect(page.getByRole('button', { name: /A05.*Gian của bạn/ })).toBeVisible();
  await expect(page.getByText('Gian của bạn', { exact: true })).toBeVisible();
});

test('Assigned Booth page has a useful empty state and remains responsive on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPartner(page, true);
  await page.goto('/partner/booths');

  await expect(page.getByRole('heading', { name: 'Bạn chưa có gian hàng được cấp' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Xem sơ đồ và yêu cầu gian hàng/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test('Assigned Booth management stays usable at the target responsive widths', async ({ page }) => {
  await mockPartner(page);
  await page.goto('/partner/booths');

  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: width <= 768 ? 900 : 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await expect(page.getByRole('searchbox', { name: 'Tìm gian hàng đã được cấp' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lọc theo thời gian sự kiện' })).toBeVisible();
    await expect(page.locator('.my-booth-card').first()).toBeVisible();
  }

  await page.locator('.my-booth-card').first().getByRole('link', { name: /Chi tiết/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await expect(page.getByRole('img', { name: /Mã QR gian hàng/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem trên bản đồ' })).toBeVisible();
});
