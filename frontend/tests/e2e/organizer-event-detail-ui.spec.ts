import { expect, Page, Route, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || '';

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const event = {
  eventId: 501,
  organizerUserId: 1,
  name: 'Sprint 3 Book Street Festival',
  description: 'Ngày hội sách dành cho độc giả, đối tác xuất bản và cộng đồng sáng tạo.',
  startAt: '2027-01-23T02:00:00Z',
  endAt: '2027-01-24T10:00:00Z',
  partnerApplicationDeadlineAt: '2026-11-04T02:00:00Z',
  boothRequestDeadlineAt: '2026-11-14T02:00:00Z',
  activityProposalDeadlineAt: '2026-11-14T03:00:00Z',
  participantRegistrationDeadlineAt: '2026-12-14T02:00:00Z',
  partnerWithdrawalCutoffAt: '2026-11-24T02:00:00Z',
  boothCancellationCutoffAt: '2026-12-04T02:00:00Z',
  activityCancellationCutoffAt: '2026-12-04T03:00:00Z',
  boothPaymentWindowMinutes: 1440,
  maxBoothsPerPartner: 2,
  maxActivitiesPerPartner: 3,
  bannerUrl: null,
  status: 'PUBLISHED',
  createdAt: '2026-10-18T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
};

interface DetailScenario {
  failOperations?: boolean;
  emptyOperations?: boolean;
  applications?: MockApplication[];
}

interface MockApplication {
  applicationId: number;
  eventId: number;
  partnerOrganizationId: number;
  partnerOrganizationName: string;
  partnerCategoryCode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  applicationNote: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  withdrawnAt: string | null;
}

async function setupEventDetail(page: Page, scenario: DetailScenario = {}) {
  let applications: MockApplication[] = scenario.applications ?? (scenario.emptyOperations ? [] : [
    {
      applicationId: 11,
      eventId: 501,
      partnerOrganizationId: 21,
      partnerOrganizationName: 'Nhà xuất bản Trẻ',
      partnerCategoryCode: 'PUBLISHER',
      status: 'PENDING',
      applicationNote: 'Đăng ký tham gia hội sách.',
      reviewNote: null,
      submittedAt: '2026-10-20T03:00:00Z',
      reviewedAt: null,
      withdrawnAt: null,
    },
    {
      applicationId: 12,
      eventId: 501,
      partnerOrganizationId: 22,
      partnerOrganizationName: 'Nhà sách Phương Nam',
      partnerCategoryCode: 'BOOKSTORE',
      status: 'APPROVED',
      applicationNote: null,
      reviewNote: 'Đủ điều kiện.',
      submittedAt: '2026-10-19T03:00:00Z',
      reviewedAt: '2026-10-21T03:00:00Z',
      withdrawnAt: null,
    },
  ]);
  const physicalBooths = scenario.emptyOperations ? [] : Array.from({ length: 5 }, (_, index) => ({
    boothId: index + 1,
    code: `A-${String(index + 1).padStart(2, '0')}`,
    name: `Gian hàng A-${index + 1}`,
    description: null,
    maxCapacity: 10,
    mapX: index * 20,
    mapY: 0,
    active: true,
    categoryCode: null,
    note: null,
  }));
  const boothConfigs = scenario.emptyOperations ? [] : physicalBooths.slice(0, 3).map((booth, index) => ({
    eventBoothConfigId: 100 + index,
    eventId: 501,
    booth,
    rentalPrice: 1000000,
    enabled: true,
    availability: index === 0 ? 'ON_HOLD' : 'AVAILABLE',
  }));
  const boothRequests = scenario.emptyOperations ? [] : [
    {
      boothRequestId: 31,
      eventId: 501,
      boothId: 1,
      boothCode: 'A-01',
      partnerOrganizationId: 22,
      partnerOrganizationName: 'Nhà sách Phương Nam',
      status: 'PENDING',
      requestNote: null,
      reviewNote: null,
      submittedAt: '2026-10-21T03:00:00Z',
      reviewedAt: null,
      selectedAt: null,
      completedAt: null,
      paymentExpiredAt: null,
      withdrawnAt: null,
      cancelledAt: null,
      hold: null,
    },
    {
      boothRequestId: 32,
      eventId: 501,
      boothId: 2,
      boothCode: 'A-02',
      partnerOrganizationId: 23,
      partnerOrganizationName: 'Nhà xuất bản Kim Đồng',
      status: 'SELECTED',
      requestNote: null,
      reviewNote: null,
      submittedAt: '2026-10-20T03:00:00Z',
      reviewedAt: '2026-10-21T03:00:00Z',
      selectedAt: '2026-10-21T03:00:00Z',
      completedAt: null,
      paymentExpiredAt: null,
      withdrawnAt: null,
      cancelledAt: null,
      hold: {
        boothHoldId: 41,
        status: 'ACTIVE',
        lockedRentalPrice: 1000000,
        createdAt: '2026-10-21T03:00:00Z',
        expiresAt: '2026-10-22T03:00:00Z',
        releasedAt: null,
      },
    },
  ];

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'mock-csrf' });
    if (path.endsWith('/auth/me')) return json(route, { userId: 1, username: 'organizer', fullName: 'Organizer Demo', email: 'organizer@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'ORGANIZER'] });
    if (path.endsWith('/organizer/notifications')) return json(route, []);
    if (path.endsWith('/organizer/events/501')) return json(route, event);
    if (path.endsWith('/organizer/events')) return json(route, { content: [event], page: 0, size: 100, totalElements: 1, totalPages: 1 });

    const reviewMatch = path.match(/\/organizer\/applications\/(\d+)\/(approve|reject)$/);
    if (reviewMatch && route.request().method() === 'POST') {
      const applicationId = Number(reviewMatch[1]);
      const action = reviewMatch[2];
      const payload = route.request().postDataJSON() as { reviewNote?: string };
      applications = applications.map(application => application.applicationId === applicationId
        ? {
            ...application,
            status: action === 'approve' ? 'APPROVED' : 'REJECTED',
            reviewNote: payload.reviewNote || null,
            reviewedAt: '2026-10-25T03:00:00Z',
          }
        : application);
      return json(route, applications.find(application => application.applicationId === applicationId));
    }

    const isOperationRequest = path.endsWith('/organizer/events/501/booth-configs')
      || path.endsWith('/organizer/events/501/applications')
      || path.endsWith('/organizer/events/501/booth-requests')
      || path.endsWith('/organizer/booths');
    if (scenario.failOperations && isOperationRequest) {
      return json(route, { code: 'OPERATIONS_UNAVAILABLE', message: 'Không tải được tình hình vận hành.' }, 503);
    }
    if (path.endsWith('/organizer/events/501/booth-configs')) return json(route, boothConfigs);
    if (path.endsWith('/organizer/events/501/applications')) return json(route, { content: applications, number: 0, size: 100, totalElements: applications.length, totalPages: applications.length ? 1 : 0 });
    if (path.endsWith('/organizer/events/501/booth-requests')) return json(route, { content: boothRequests, page: 0, size: 100, totalElements: boothRequests.length, totalPages: boothRequests.length ? 1 : 0 });
    if (path.endsWith('/organizer/booths')) return json(route, { content: physicalBooths, page: 0, size: 100, totalElements: physicalBooths.length, totalPages: physicalBooths.length ? 1 : 0 });
    if (path.includes('/organizer/activities')) return json(route, { content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
    if (path.includes('/organizer/participants')) return json(route, []);
    return json(route, { code: 'NOT_FOUND', message: 'Not found' }, 404);
  });
}

test.describe('Organizer event detail overview', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('shows real event operations, schedule, rules and deadlines', async ({ page }) => {
    await setupEventDetail(page);
    await page.goto(`${BASE_URL}/organizer/events/501`);

    await expect(page.getByRole('heading', { name: event.name })).toBeVisible();
    await expect(page.getByText('Đã công bố').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hồ sơ đối tác: 2' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gian hàng đã cấu hình: 3/5' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yêu cầu gian hàng: 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Giữ chỗ hiệu lực: 1' })).toBeVisible();
    await expect(page.getByText('1 chờ duyệt')).toBeVisible();
    await expect(page.getByText('1 ngày')).toBeVisible();
    await expect(page.getByText('Ngày hội sách dành cho độc giả, đối tác xuất bản và cộng đồng sáng tạo.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mốc thời hạn khác' })).toBeVisible();
    await expect(page.getByText('Rút hồ sơ đối tác')).toBeVisible();
    await expect(page.getByText('Hủy hoạt động')).toBeVisible();

    await page.getByRole('button', { name: 'Hồ sơ đối tác: 2' }).click();
    await expect(page).toHaveURL(/\/organizer\/events\/501\?section=partners/);
  });

  test('keeps empty operation values truthful and the desktop layout free of horizontal overflow', async ({ page }) => {
    await setupEventDetail(page, { emptyOperations: true });
    await page.goto(`${BASE_URL}/organizer/events/501`);

    await expect(page.getByRole('button', { name: 'Hồ sơ đối tác: 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gian hàng đã cấu hình: 0' })).toBeVisible();
    await expect(page.getByText('Chưa có gian hàng vật lý khả dụng')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    await page.setViewportSize({ width: 1366, height: 768 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await expect(page.locator('.org-event-overview-grid--details')).toBeVisible();
  });

  test('never presents failed operation requests as zero', async ({ page }) => {
    await setupEventDetail(page, { failOperations: true });
    await page.goto(`${BASE_URL}/organizer/events/501`);

    await expect(page.getByRole('alert').filter({ hasText: 'Không tải được tình hình vận hành.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hồ sơ đối tác: —' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gian hàng đã cấu hình: —' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yêu cầu gian hàng: —' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Giữ chỗ hiệu lực: —' })).toBeVisible();
  });
});

test.describe('Organizer partner applications', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('supports real pending filter, search and a focused application drawer', async ({ page }) => {
    await setupEventDetail(page);
    await page.goto(`${BASE_URL}/organizer/events/501?section=partners`);

    await expect(page.getByRole('heading', { name: 'Hồ sơ đăng ký' })).toBeVisible();
    await expect(page.getByRole('button', { name: '1 chờ duyệt' })).toBeVisible();
    await expect(page.getByText('Nhà xuất bản Trẻ')).toBeVisible();
    await expect(page.getByText('Nhà sách Phương Nam')).toBeVisible();
    await expect(page.getByText('20/10/2026 · 10:00')).toBeVisible();
    await page.setViewportSize({ width: 1366, height: 768 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    await page.getByRole('button', { name: '1 chờ duyệt' }).click();
    await expect(page.getByText('Nhà xuất bản Trẻ')).toBeVisible();
    await expect(page.getByText('Nhà sách Phương Nam')).toBeHidden();
    await expect(page.getByText('Hiển thị 1–1 trong 1 hồ sơ')).toBeVisible();

    await page.getByRole('button', { name: '1 chờ duyệt' }).click();
    await page.getByPlaceholder('Tìm tên tổ chức…').fill('Phương Nam');
    await expect(page.getByText('Nhà sách Phương Nam')).toBeVisible();
    await expect(page.getByText('Nhà xuất bản Trẻ')).toBeHidden();

    await page.getByRole('button', { name: 'Xem hồ sơ: Nhà sách Phương Nam' }).click();
    const drawer = page.getByRole('dialog', { name: 'Nhà sách Phương Nam' });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('dd').getByText('Nhà sách', { exact: true })).toBeVisible();
    await expect(drawer.getByText('Đủ điều kiện.')).toBeVisible();
    await expect(drawer.getByText('21/10/2026 · 10:00')).toBeVisible();
    await expect(drawer.getByText('Đã duyệt')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Duyệt hồ sơ' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: 'Xem hồ sơ: Nhà sách Phương Nam' })).toBeFocused();
  });

  test('requires a rejection reason and refreshes the reviewed application once', async ({ page }) => {
    let rejectRequests = 0;
    await setupEventDetail(page);
    await page.route('**/api/v1/organizer/applications/11/reject', async route => {
      rejectRequests += 1;
      await route.fallback();
    });
    await page.goto(`${BASE_URL}/organizer/events/501?section=partners`);

    await page.getByRole('button', { name: 'Xem hồ sơ: Nhà xuất bản Trẻ' }).click();
    const drawer = page.getByRole('dialog', { name: 'Nhà xuất bản Trẻ' });
    await drawer.getByRole('button', { name: 'Từ chối' }).click();
    await drawer.getByRole('button', { name: 'Xác nhận từ chối' }).click();
    await expect(drawer.getByRole('alert')).toHaveText('Vui lòng nhập lý do từ chối.');
    expect(rejectRequests).toBe(0);

    await drawer.getByLabel('Lý do từ chối *').fill('Thông tin đăng ký chưa đầy đủ.');
    await drawer.getByRole('button', { name: 'Xác nhận từ chối' }).click();
    await expect(drawer.getByRole('status')).toHaveText(/Đã từ chối hồ sơ/);
    await expect(drawer.getByText('Từ chối', { exact: true })).toBeVisible();
    await expect(drawer.getByText('Thông tin đăng ký chưa đầy đủ.')).toBeVisible();
    expect(rejectRequests).toBe(1);
    await expect(page.getByRole('button', { name: /chờ duyệt/ })).toHaveCount(0);
  });

  test('approves from the drawer and paginates without losing the active status filter', async ({ page }) => {
    const applications: MockApplication[] = Array.from({ length: 6 }, (_, index) => ({
      applicationId: 40 + index,
      eventId: 501,
      partnerOrganizationId: 70 + index,
      partnerOrganizationName: `Đối tác ${index + 1}`,
      partnerCategoryCode: index % 2 === 0 ? 'BOOKSTORE' : 'PUBLISHER',
      status: index === 0 ? 'PENDING' : 'APPROVED',
      applicationNote: index === 0 ? 'Hồ sơ cần xét duyệt.' : null,
      reviewNote: index === 0 ? null : 'Đã kiểm tra.',
      submittedAt: `2026-10-${String(20 - index).padStart(2, '0')}T03:00:00Z`,
      reviewedAt: index === 0 ? null : '2026-10-21T03:00:00Z',
      withdrawnAt: null,
    }));
    await setupEventDetail(page, { applications });
    await page.goto(`${BASE_URL}/organizer/events/501?section=partners`);

    await expect(page.getByText('Trang 1 / 2')).toBeVisible();
    await page.getByRole('button', { name: 'Trang sau' }).click();
    await expect(page.getByText('Trang 2 / 2')).toBeVisible();
    await expect(page.getByText('Đối tác 6')).toBeVisible();

    await page.getByLabel('Lọc trạng thái hồ sơ').selectOption('pending');
    await expect(page.getByText('Trang 1 / 1')).toBeVisible();
    await expect(page.getByText('Đối tác 1')).toBeVisible();
    await page.getByRole('button', { name: 'Xem hồ sơ: Đối tác 1' }).click();
    const drawer = page.getByRole('dialog', { name: 'Đối tác 1' });
    await drawer.getByRole('button', { name: 'Duyệt hồ sơ' }).click();
    await drawer.getByLabel('Ghi chú xét duyệt').fill('Đủ điều kiện tham gia.');
    await drawer.getByRole('button', { name: 'Xác nhận duyệt' }).click();

    await expect(drawer.getByRole('status')).toHaveText(/Đã duyệt hồ sơ thành công/);
    await expect(drawer.getByText('Đã duyệt', { exact: true })).toBeVisible();
    await expect(page.getByText('Không tìm thấy hồ sơ phù hợp')).toBeVisible();
  });

  test('keeps no-data and filtered-empty states distinct', async ({ page }) => {
    await setupEventDetail(page, { emptyOperations: true });
    await page.goto(`${BASE_URL}/organizer/events/501?section=partners`);
    await expect(page.getByText('Chưa có hồ sơ đăng ký')).toBeVisible();

    await setupEventDetail(page, {
      applications: [{
        applicationId: 15,
        eventId: 501,
        partnerOrganizationId: 25,
        partnerOrganizationName: 'Công ty Văn hóa Đông Nam',
        partnerCategoryCode: 'DISTRIBUTOR',
        status: 'WITHDRAWN',
        applicationNote: null,
        reviewNote: null,
        submittedAt: '2026-10-18T03:00:00Z',
        reviewedAt: null,
        withdrawnAt: '2026-10-20T03:00:00Z',
      }],
    });
    await page.reload();
    await page.getByPlaceholder('Tìm tên tổ chức…').fill('không tồn tại');
    await expect(page.getByText('Không tìm thấy hồ sơ phù hợp')).toBeVisible();
    await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
    await expect(page.getByText('Công ty Văn hóa Đông Nam')).toBeVisible();
  });

  test('shows a retryable error instead of an empty application list', async ({ page }) => {
    await setupEventDetail(page, { failOperations: true });
    await page.goto(`${BASE_URL}/organizer/events/501?section=partners`);

    const state = page.getByRole('alert').filter({ hasText: 'Không thể tải hồ sơ đối tác' });
    await expect(state).toBeVisible();
    await expect(state.getByText('Không tải được tình hình vận hành.')).toBeVisible();
    await expect(state.getByRole('button', { name: 'Thử lại' })).toBeVisible();
    await expect(page.getByText('Chưa có hồ sơ đăng ký')).toHaveCount(0);
  });
});
