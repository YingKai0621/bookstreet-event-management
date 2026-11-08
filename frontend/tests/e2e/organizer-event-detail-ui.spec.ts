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
  startAt: '2030-01-23T02:00:00Z',
  endAt: '2030-01-24T10:00:00Z',
  partnerApplicationDeadlineAt: '2029-11-04T02:00:00Z',
  boothRequestDeadlineAt: '2029-11-14T02:00:00Z',
  activityProposalDeadlineAt: '2029-11-14T03:00:00Z',
  participantRegistrationDeadlineAt: '2029-12-14T02:00:00Z',
  partnerWithdrawalCutoffAt: '2029-11-24T02:00:00Z',
  boothCancellationCutoffAt: '2029-12-04T02:00:00Z',
  activityCancellationCutoffAt: '2029-12-04T03:00:00Z',
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
  eventStatus?: 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  invalidTimeline?: boolean;
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
  const actions: string[] = [];
  let eventDeleted = false;
  let currentEvent: typeof event & {
    cancelledAt: string | null;
    cancellationReason: string | null;
  } = {
    ...event,
    status: scenario.eventStatus ?? event.status,
    cancelledAt: null,
    cancellationReason: null,
  };
  if (scenario.invalidTimeline) {
    currentEvent = {
      ...currentEvent,
      boothRequestDeadlineAt: currentEvent.partnerApplicationDeadlineAt,
      activityProposalDeadlineAt: currentEvent.partnerApplicationDeadlineAt,
      participantRegistrationDeadlineAt: currentEvent.startAt,
    };
  }
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
    if (path.endsWith('/organizer/notifications/unread-count')) return json(route, { unreadCount: 0 });
    if (path.endsWith('/organizer/notifications')) return json(route, {
      content: [], page: 0, size: 5, totalElements: 0, totalPages: 0,
    });
    if (path.endsWith('/organizer/events/501/cancel') && route.request().method() === 'POST') {
      actions.push(`cancel:${route.request().postDataJSON().reason}`);
      currentEvent = {
        ...currentEvent,
        status: 'CANCELLED',
        cancelledAt: '2026-10-27T04:00:00Z',
        cancellationReason: route.request().postDataJSON().reason,
      };
      return json(route, currentEvent);
    }
    if (path.endsWith('/organizer/events/501') && route.request().method() === 'DELETE') {
      actions.push('delete');
      eventDeleted = true;
      return route.fulfill({ status: 204, body: '' });
    }
    if (path.endsWith('/organizer/events/501')) return json(route, currentEvent);
    if (path.endsWith('/organizer/events')) {
      const content = eventDeleted ? [] : [currentEvent];
      return json(route, {
        content,
        page: 0,
        size: 100,
        totalElements: content.length,
        totalPages: content.length ? 1 : 0,
      });
    }

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

  return { actions };
}

test.describe('Organizer event detail overview', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('links a published event to its public page in a new tab, and staff to the public site', async ({ page }) => {
    await setupEventDetail(page);
    await page.goto(`${BASE_URL}/organizer/events/501`);

    const eventLink = page.getByRole('link', { name: 'Xem trên trang công khai' });
    await expect(eventLink).toHaveAttribute('href', '/su-kien/501?eventId=501');
    await expect(eventLink).toHaveAttribute('target', '_blank');
    const siteLink = page.locator('.organizer-topbar').getByRole('link', { name: 'Xem trang công khai' });
    await expect(siteLink).toHaveAttribute('href', '/');
    await expect(siteLink).toHaveAttribute('target', '_blank');
  });

  test('a draft event has no public page link', async ({ page }) => {
    await setupEventDetail(page, { eventStatus: 'DRAFT' });
    await page.goto(`${BASE_URL}/organizer/events/501`);

    await expect(page.getByRole('heading', { name: event.name })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Xem trên trang công khai' })).toHaveCount(0);
  });

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
    await expect(page.getByRole('heading', { name: 'Thời hạn dành cho đối tác' })).toBeVisible();
    await expect(page.getByText('Nhận yêu cầu gian hàng đến')).toBeVisible();
    await expect(page.getByText('Nhận đề xuất hoạt động đến')).toBeVisible();
    await expect(page.getByText('Rút hồ sơ đối tác')).toHaveCount(0);
    await expect(page.getByText('Hủy gian hàng')).toHaveCount(0);
    await expect(page.getByText('Hủy hoạt động')).toHaveCount(0);
    await expect(page.locator('.org-event-detail-header').getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Hồ sơ đối tác: 2' }).click();
    await expect(page).toHaveURL(/\/organizer\/events\/501\?section=partners/);

    await page.getByRole('button', { name: 'Cài đặt' }).click();
    await expect(page.getByText('Hạn cuối yêu cầu gian hàng')).toBeVisible();
    await expect(page.getByText('Hạn rút khỏi sự kiện')).toHaveCount(0);
    await expect(page.getByText('Hạn gửi yêu cầu hủy hoạt động')).toHaveCount(0);
    await page.getByRole('region', { name: 'Cấu hình sự kiện' }).getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
    const editDialog = page.getByRole('dialog', { name: 'Chỉnh sửa thông tin sự kiện' });
    await expect(editDialog.getByRole('textbox', { name: 'Mô tả', exact: true })).toBeVisible();
    await expect(editDialog.getByLabel('Ảnh banner', { exact: true })).toBeAttached();
    await expect(editDialog.locator('#event-start-at')).toHaveCount(0);
    await expect(editDialog.locator('#event-max-booths')).toHaveCount(0);
    await expect(editDialog.getByText('Hạn đăng ký & lịch trình')).toHaveCount(0);
    await editDialog.getByRole('textbox', { name: 'Tên sự kiện *', exact: true }).fill('Tên sự kiện đã cập nhật');
    const savedRequest = page.waitForRequest(request => request.url().endsWith('/organizer/events/501') && request.method() === 'PATCH');
    await editDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    expect((await savedRequest).postDataJSON()).toEqual({ name: 'Tên sự kiện đã cập nhật' });
  });

  test('allows an ongoing event to edit descriptive information only', async ({ page }) => {
    await setupEventDetail(page, { eventStatus: 'ONGOING' });
    await page.goto(`${BASE_URL}/organizer/events/501?section=settings`);

    await expect(page.locator('.org-event-detail-header').getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true })).toBeVisible();
    await page.getByRole('region', { name: 'Cấu hình sự kiện' }).getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Chỉnh sửa thông tin sự kiện' });
    await expect(dialog.getByRole('textbox', { name: 'Tên sự kiện *', exact: true })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Mô tả', exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Ảnh banner', { exact: true })).toBeAttached();
    await expect(dialog.locator('#event-start-at')).toHaveCount(0);
    await expect(dialog.locator('#event-max-booths')).toHaveCount(0);
    await dialog.getByRole('textbox', { name: 'Mô tả', exact: true }).fill('Mô tả đã cập nhật khi sự kiện đang diễn ra.');
    const savedRequest = page.waitForRequest(request => request.url().endsWith('/organizer/events/501') && request.method() === 'PATCH');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    expect((await savedRequest).postDataJSON()).toEqual({ description: 'Mô tả đã cập nhật khi sự kiện đang diễn ra.' });
  });

  for (const terminalStatus of ['COMPLETED', 'CANCELLED'] as const) {
    test(`does not offer editing for a ${terminalStatus.toLowerCase()} event`, async ({ page }) => {
      await setupEventDetail(page, { eventStatus: terminalStatus });
      await page.goto(`${BASE_URL}/organizer/events/501?section=settings`);

      await expect(page.locator('.org-event-detail-header').getByRole('button', { name: /Chỉnh sửa/ })).toHaveCount(0);
      const settings = page.getByRole('region', { name: 'Cấu hình sự kiện' });
      await expect(settings.getByRole('button', { name: /Chỉnh sửa/ })).toHaveCount(0);
    });
  }

  test('cancels a published event with a validated reason and updates the screen', async ({ page }) => {
    const state = await setupEventDetail(page);
    await page.goto(`${BASE_URL}/organizer/events/501`);

    await page.getByRole('button', { name: 'Hủy sự kiện' }).click();
    const dialog = page.getByRole('dialog', { name: 'Hủy sự kiện' });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('Nhập lý do rõ ràng để lưu vào lịch sử sự kiện...').fill('Ngắn');
    await dialog.getByRole('button', { name: 'Xác nhận hủy' }).click();
    await expect(dialog.getByRole('alert')).toContainText('10 đến 500 ký tự');

    const reason = 'Ban tổ chức điều chỉnh kế hoạch vận hành sự kiện.';
    await dialog.getByPlaceholder('Nhập lý do rõ ràng để lưu vào lịch sử sự kiện...').fill(reason);
    await dialog.getByRole('button', { name: 'Xác nhận hủy' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Đã hủy').first()).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Đã hủy sự kiện');
    expect(state.actions).toEqual([`cancel:${reason}`]);
  });

  test('edits draft operational settings directly without attempting publication', async ({ page }) => {
    await setupEventDetail(page, { eventStatus: 'DRAFT' });
    await page.goto(`${BASE_URL}/organizer/events/501?section=settings`);
    await page.getByRole('region', { name: 'Cấu hình sự kiện' }).getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Chỉnh sửa bản nháp' });
    await expect(dialog.getByLabel('Bắt đầu - ngày', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Hạn yêu cầu gian hàng - ngày', { exact: true })).toBeVisible();
    await dialog.getByRole('spinbutton', { name: 'Số gian hàng tối đa / đối tác', exact: true }).fill('5');
    const savedRequest = page.waitForRequest(request => request.url().endsWith('/organizer/events/501') && request.method() === 'PATCH');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    expect((await savedRequest).postDataJSON()).toEqual({ maxBoothsPerPartner: 5 });
    await expect(dialog).toBeHidden();
  });

  test('deletes a draft event only after confirmation', async ({ page }) => {
    const state = await setupEventDetail(page, { eventStatus: 'DRAFT' });
    await page.goto(`${BASE_URL}/organizer/events/501`);

    await page.getByRole('button', { name: 'Xóa bản nháp' }).click();
    const dialog = page.getByRole('dialog', { name: 'Xóa bản nháp' });
    await expect(dialog).toContainText('Bản nháp sẽ bị xóa vĩnh viễn');
    await dialog.getByRole('button', { name: 'Xóa bản nháp' }).click();

    await expect(page).toHaveURL(/\/organizer\/events$/);
    await expect(page.getByText('Chưa có sự kiện nào')).toBeVisible();
    expect(state.actions).toEqual(['delete']);
  });

  test('blocks publication and names every contradictory timeline field', async ({ page }) => {
    await setupEventDetail(page, { eventStatus: 'DRAFT', invalidTimeline: true });
    await page.goto(`${BASE_URL}/organizer/events/501`);

    await page.getByRole('button', { name: 'Công bố', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Chưa thể công bố' });
    await expect(dialog).toContainText('Còn 3 thông tin cần sửa trước khi công bố.');
    await expect(dialog).toContainText('Hạn yêu cầu gian hàng phải sau hạn đối tác đăng ký ít nhất 24 giờ để Ban tổ chức duyệt hồ sơ.');
    await expect(dialog).toContainText('Hạn đề xuất hoạt động phải sau hạn đối tác đăng ký ít nhất 24 giờ để Ban tổ chức duyệt hồ sơ.');
    await expect(dialog).toContainText('Hạn người tham gia đăng ký phải trước thời gian bắt đầu sự kiện.');
    await expect(dialog.getByRole('button', { name: 'Công bố', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Chỉnh sửa bản nháp' }).click();
    await expect(page.getByRole('heading', { name: 'Chỉnh sửa bản nháp' })).toBeVisible();
    await expect(page.getByText('3 mốc cần sửa trước khi công bố')).toBeVisible();
    await expect(page.getByLabel('Hạn yêu cầu gian hàng - ngày')).toBeFocused();
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
