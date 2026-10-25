import { expect, type Page, type Route, test } from '@playwright/test';

const initialKey = '47d85df4-c665-4a0d-844b-544f34c6d8fd';
const createdAt = '2026-10-08T03:00:00Z';
const payment = {
  boothPaymentId: 81, boothRequestId: 77, boothHoldId: 501,
  transactionType: 'PAYMENT', purpose: 'INITIAL_BOOTH_RENTAL', amount: 5_000_000,
  status: 'PENDING', idempotencyKey: initialKey, gatewayProvider: 'VNPAY',
  gatewayTransactionRef: null, failureCode: null, failureMessage: null,
  reconciliationRequired: false, createdAt, updatedAt: createdAt, completedAt: null,
};
const request = {
  boothRequestId: 77, eventId: 101, boothId: 11, boothCode: 'A05',
  partnerOrganizationId: 9, partnerOrganizationName: 'NXB Demo', status: 'SELECTED',
  requestNote: null, reviewNote: null, submittedAt: createdAt, reviewedAt: createdAt,
  selectedAt: createdAt, completedAt: null, paymentExpiredAt: null, withdrawnAt: null,
  hold: { boothHoldId: 501, status: 'ACTIVE', lockedRentalPrice: 5_000_000,
    createdAt, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), releasedAt: null },
};
const assignment = {
  boothAssignmentId: 201, boothHoldId: 501, boothRequestId: 77, eventId: 101,
  boothId: 11, boothCode: 'A05', partnerOrganizationId: 9, partnerOrganizationName: 'NXB Demo',
  lockedRentalPrice: 5_000_000, qrToken: initialKey, coverImageUrl: null,
  status: 'ACTIVE', assignedAt: createdAt, releasedAt: null, releaseReason: null,
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function paged(content: unknown[], page = 0, totalPages = 1) {
  return { content, page, size: 10, totalElements: totalPages > 1 ? (totalPages - 1) * 10 + content.length : content.length, totalPages };
}

type Scenario = {
  status?: string; reconciliation?: boolean; free?: boolean; expired?: boolean;
  empty?: boolean; pagination?: boolean; guest?: boolean; detailMissing?: boolean;
  olderConflict?: boolean; historyUnavailable?: boolean; expiringSoon?: boolean;
  post?: (route: Route) => Promise<void>;
};

async function mock(page: Page, scenario: Scenario = {}) {
  const state = { status: scenario.status ?? 'PENDING', guest: scenario.guest ?? false, keys: [] as string[], reads: 0 };
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const completed = state.status === 'SUCCESS' || scenario.free;
    const currentPayment = { ...payment, status: state.status,
      reconciliationRequired: scenario.reconciliation ?? false,
      completedAt: state.status === 'PENDING' ? null : createdAt,
      failureMessage: state.status === 'FAILED' ? 'Khách hàng hủy thanh toán.' : null };
    const currentRequest = { ...request,
      status: completed ? 'COMPLETED' : scenario.expired ? 'PAYMENT_EXPIRED' : 'SELECTED',
      completedAt: completed ? createdAt : null,
      hold: { ...request.hold, status: completed ? 'CONSUMED' : scenario.expired ? 'EXPIRED' : 'ACTIVE',
        expiresAt: scenario.expiringSoon ? new Date(Date.now() + 120_000).toISOString() : request.hold.expiresAt,
        lockedRentalPrice: scenario.free ? 0 : request.hold.lockedRentalPrice } };
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path.endsWith('/auth/login')) { state.guest = false; return json(route, {}); }
    if (path.endsWith('/auth/me')) return state.guest
      ? json(route, { code: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập.' }, 401)
      : json(route, { userId: 2, username: 'partner', fullName: 'Partner Demo', email: 'partner@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'PARTNER'] });
    if (path.endsWith('/partner/organization')) return json(route, { partnerOrganizationId: 9, name: 'NXB Demo', description: '', categoryCode: 'PUBLISHER', logoUrl: null, contactEmail: 'partner@example.com', contactPhone: null, address: null, status: 'ACTIVE' });
    if (path.endsWith('/partner/applications')) return json(route, paged([{ applicationId: 31, eventId: 101, partnerOrganizationId: 9, status: 'APPROVED', applicationNote: null, reviewNote: null, submittedAt: createdAt, reviewedAt: createdAt, withdrawnAt: null }]));
    if (path.endsWith('/partner/booth-requests')) return json(route, paged([currentRequest]));
    if (path.endsWith('/events/101/booths')) return json(route, paged([]));
    if (path.endsWith('/partner/booth-requests/77')) return json(route, currentRequest);
    if (path.endsWith('/partner/booth-requests/77/assignment')) return json(route, { ...assignment, lockedRentalPrice: scenario.free ? 0 : assignment.lockedRentalPrice });
    if (path.endsWith('/partner/booth-payments/81')) {
      state.reads++;
      return scenario.detailMissing ? json(route, { code: 'BOOTH_PAYMENT_NOT_FOUND', message: 'Không tìm thấy giao dịch.' }, 404) : json(route, currentPayment);
    }
    if (path.endsWith('/partner/booth-payments/82')) return json(route, { ...currentPayment, boothPaymentId: 82, boothRequestId: 99 });
    if (path.endsWith('/partner/booth-requests/77/payments')) {
      if (method === 'POST') {
        expect(route.request().headers()['x-csrf-token']).toBe('test-token');
        const key = route.request().headers()['idempotency-key'];
        expect(key).toMatch(/^[0-9a-f-]{36}$/i);
        state.keys.push(key);
        if (scenario.post) return scenario.post(route);
        return json(route, { payment: currentPayment, checkoutUrl: 'http://localhost:5173/test-vnpay-checkout', sessionExpiresAt: request.hold.expiresAt }, 201);
      }
      const pageNumber = Number(url.searchParams.get('page') || 0);
      if (scenario.historyUnavailable) return json(route, { code: 'UNAVAILABLE', message: 'Không thể tải lịch sử.' }, 503);
      const items = scenario.free || scenario.empty ? [] : scenario.pagination && pageNumber === 1
        ? [{ ...currentPayment, boothPaymentId: 72 }] : [currentPayment];
      if (scenario.olderConflict) items.push({ ...currentPayment, boothPaymentId: 70, reconciliationRequired: true });
      return json(route, paged(items, pageNumber, scenario.pagination ? 2 : 1));
    }
    if (path.endsWith('/events') || path.includes('/public/')) return json(route, paged([]));
    return json(route, { code: 'NOT_FOUND', message: `${method} ${path}` }, 404);
  });
  return state;
}

test('Return ignores browser success claims, polls backend, then displays Assignment and QR', async ({ page }) => {
  const state = await mock(page);
  await page.goto('/payment/vnpay/return?vnp_TxnRef=BSP81&vnp_ResponseCode=00&vnp_TransactionStatus=00');
  await expect(page).toHaveURL(/\/partner\/booth-requests\/77\/payment\?paymentId=81/);
  await expect(page.getByTestId('payment-result')).toContainText('Đang chờ xác nhận');
  await expect(page.getByTestId('booth-assignment')).toHaveCount(0);
  state.status = 'SUCCESS';
  await expect(page.getByTestId('payment-result')).toContainText('Thanh toán thành công');
  await expect(page.getByTestId('booth-assignment')).toContainText('Gian hàng đã được cấp: A05');
  await expect(page.getByTestId('booth-assignment').locator('svg')).toBeVisible();
  await expect(page.getByTestId('pay-booth-button')).toHaveCount(0);
  expect(state.keys).toHaveLength(0);
});

test('Checkout sends CSRF and a new key then navigates to the gateway', async ({ page }) => {
  const state = await mock(page, { empty: true });
  await page.goto('/partner/booth-requests/77/payment');
  await page.getByTestId('pay-booth-button').click();
  await expect(page).toHaveURL(/test-vnpay-checkout/);
  expect(state.keys).toHaveLength(1);
});

test('Pending checkout resumes the backend key even when this tab has another key', async ({ page }) => {
  const state = await mock(page);
  await page.addInitScript(() => sessionStorage.setItem('bookstreet_idempotency_pay_req_77', '11111111-1111-4111-8111-111111111111'));
  await page.goto('/partner/booth-requests/77/payment');
  await page.getByTestId('pay-booth-button').click();
  await expect(page).toHaveURL(/test-vnpay-checkout/);
  expect(state.keys).toEqual([initialKey]);
});

test('Failed attempt retries with one durable new key across a lost response and reload', async ({ page }) => {
  const state = await mock(page, { status: 'FAILED', post: route => route.abort('failed') });
  await page.goto('/partner/booth-requests/77/payment');
  await page.getByTestId('retry-payment-button').click();
  await expect(page.getByTestId('payment-error')).toBeVisible();
  await page.reload();
  await page.getByTestId('retry-payment-button').click();
  await expect(page.getByTestId('payment-error')).toBeVisible();
  expect(state.keys).toHaveLength(2);
  expect(state.keys[0]).not.toBe(initialKey);
  expect(state.keys[1]).toBe(state.keys[0]);
});

test('Reconciling replay remains pending and does not claim success or navigate', async ({ page }) => {
  await mock(page, { post: route => json(route, { payment, checkoutUrl: null, sessionExpiresAt: null, resolution: 'RECONCILING' }, 202) });
  await page.goto('/partner/booth-requests/77/payment');
  await page.getByTestId('pay-booth-button').click();
  await expect(page.getByText('Giao dịch trước đó đang được đối soát với cổng thanh toán VNPay. Vui lòng kiểm tra lại sau ít phút.')).toBeVisible();
  await expect(page).toHaveURL(/\/77\/payment/);
  await expect(page.getByTestId('booth-assignment')).toHaveCount(0);
});

test('Contradictory terminal evidence blocks retry', async ({ page }) => {
  const state = await mock(page, { status: 'TIMEOUT', reconciliation: true });
  await page.goto('/partner/booth-requests/77/payment');
  await expect(page.getByTestId('payment-result')).toContainText('Giao dịch cần đối soát');
  await expect(page.getByTestId('retry-payment-button')).toBeDisabled();
  expect(state.keys).toHaveLength(0);
});

test('Free Booth displays its Assignment without any payment creation', async ({ page }) => {
  const state = await mock(page, { free: true });
  await page.goto('/partner/booth-requests/77/payment');
  await expect(page.getByTestId('booth-assignment')).toContainText('Gian hàng miễn phí');
  await expect(page.getByText('Không có giao dịch: gian hàng miễn phí.')).toBeVisible();
  await expect(page.getByTestId('booth-payment-checkout-card')).toHaveCount(0);
  expect(state.keys).toHaveLength(0);
});

test('Expired Hold preserves payment history and has no checkout', async ({ page }) => {
  await mock(page, { status: 'TIMEOUT', expired: true });
  await page.goto('/partner/booth-requests/77/payment');
  await expect(page.getByText('Thời gian giữ chỗ đã hết hạn theo xác nhận của hệ thống. Không thể tạo phiên thanh toán mới.')).toBeVisible();
  await expect(page.getByRole('table')).toContainText('#81');
  await expect(page.getByTestId('booth-payment-checkout-card')).toHaveCount(0);
});

test('History pagination loads the requested backend page', async ({ page }) => {
  await mock(page, { status: 'SUCCESS', pagination: true });
  await page.goto('/partner/booth-requests/77/payment');
  await page.getByRole('link', { name: 'Trang sau' }).click();
  await expect(page.getByRole('table')).toContainText('#72');
  await expect(page.getByRole('table')).not.toContainText('#81');
  await page.getByRole('link', { name: 'Trang trước' }).click();
  await expect(page.getByRole('table')).toContainText('#81');
});

test('Malformed Return cannot lookup a payment or create a charge', async ({ page }) => {
  const state = await mock(page);
  await page.goto('/payment/vnpay/return?vnp_TxnRef=BSPnot-an-id&vnp_ResponseCode=00');
  await expect(page.getByRole('alert')).toContainText('Đường dẫn giao dịch không hợp lệ');
  expect(state.reads).toBe(0);
  expect(state.keys).toHaveLength(0);
});

test('Ownership-safe 404 never displays success from Return parameters', async ({ page }) => {
  await mock(page, { detailMissing: true });
  await page.goto('/payment/vnpay/return?vnp_TxnRef=BSP81&vnp_ResponseCode=00');
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy giao dịch');
  await expect(page.getByTestId('booth-assignment')).toHaveCount(0);
});

test('Payment detail rejects a payment belonging to another request', async ({ page }) => {
  await mock(page);
  await page.goto('/partner/booth-requests/77/payment?paymentId=82');
  await expect(page.getByRole('alert')).toContainText('Giao dịch không thuộc yêu cầu gian hàng này');
  await expect(page.getByTestId('booth-payment-checkout-card')).toHaveCount(0);
});

test('Login preserves the Return URL and retrieves the backend result', async ({ page }) => {
  await mock(page, { guest: true, status: 'SUCCESS' });
  await page.goto('/payment/vnpay/return?vnp_TxnRef=BSP81');
  await page.locator('#partner-username').fill('partnerdemo');
  await page.locator('#partner-password').fill('DemoPassword123!');
  await page.getByRole('button', { name: 'Đăng nhập vào Cổng Đối tác' }).click();
  await expect(page).toHaveURL(/\/partner\/booth-requests\/77\/payment\?paymentId=81/);
  await expect(page.getByTestId('booth-assignment')).toBeVisible();
});

test('Request list opens payment details and labels a consumed Hold as assigned', async ({ page }) => {
  await mock(page, { status: 'SUCCESS' });
  await page.goto('/partner/booth-requests');
  await page.getByRole('tab', { name: /Yêu cầu của tôi/ }).click();
  await expect(page.getByText('Đã cấp gian hàng', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Xem chi tiết thanh toán và gian hàng' }).click();
  await expect(page.getByTestId('booth-assignment')).toBeVisible();
});

test('Any older reconciliation conflict blocks retry of a newer failed attempt', async ({ page }) => {
  await mock(page, { status: 'FAILED', olderConflict: true });
  await page.goto('/partner/booth-requests/77/payment');
  await expect(page.getByTestId('retry-payment-button')).toBeDisabled();
  await expect(page.getByText('Giao dịch cần đối soát. Không thể thanh toán lại cho đến khi hệ thống xác định kết quả.')).toBeVisible();
});

test('Unavailable history cannot enable a new charge', async ({ page }) => {
  const state = await mock(page, { historyUnavailable: true });
  await page.goto('/partner/booth-requests/77/payment');
  await expect(page.getByRole('alert')).toContainText('Không thể tải lịch sử');
  await expect(page.getByTestId('booth-payment-checkout-card')).toHaveCount(0);
  expect(state.keys).toHaveLength(0);
});

test('A new checkout is disabled below five minutes but an existing checkout can be replayed', async ({ page }) => {
  await mock(page, { empty: true, expiringSoon: true });
  await page.goto('/partner/booth-requests/77/payment');
  await expect(page.getByTestId('pay-booth-button')).toBeDisabled();
  await page.unroute('**/api/v1/**');
  const state = await mock(page, { expiringSoon: true });
  await page.reload();
  await page.getByTestId('pay-booth-button').click();
  await expect(page).toHaveURL(/test-vnpay-checkout/);
  expect(state.keys).toEqual([initialKey]);
});

test('Payment and Assignment remain usable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page, { status: 'SUCCESS' });
  await page.goto('/partner/booth-requests/77/payment');
  await expect(page.getByTestId('booth-assignment')).toBeVisible();
  await expect(page.getByRole('table')).toContainText('#81');
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflows).toBe(false);
});

test('Pending checkout distinguishes hold countdown from retry availability', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page);
  await page.goto('/partner/booth-requests/77/payment');
  const card = page.getByTestId('booth-payment-checkout-card');
  await expect(card).toContainText('Chờ xác nhận');
  await expect(card).toContainText('Chưa thể xác định còn bao nhiêu phút để thử lại');
  await expect(card).toContainText('Tự cập nhật mỗi 5 giây');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await expect(card).toHaveCSS('padding-top', '18px');
  await page.screenshot({ path: 'test-results/payment-pending-mobile.png', fullPage: true });
});

test('Failed checkout displays a clear failure and one retry action', async ({ page }) => {
  await mock(page, { status: 'FAILED' });
  await page.goto('/partner/booth-requests/77/payment');
  const card = page.getByTestId('booth-payment-checkout-card');
  await expect(card).toContainText('Thanh toán thất bại');
  await expect(card).toContainText('Khách hàng hủy thanh toán.');
  await expect(page.getByTestId('retry-payment-button')).toBeEnabled();
  await expect(card).toHaveCSS('padding-top', '24px');
  await page.screenshot({ path: 'test-results/payment-failed-desktop.png', fullPage: true });
});
