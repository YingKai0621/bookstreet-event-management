import { expect, Page, Route, test } from '@playwright/test';

const event = {
  eventId: 101,
  organizerUserId: 1,
  name: 'Ngày hội Sách Sprint 2',
  description: 'Sự kiện kiểm thử giao diện gian hàng.',
  startAt: '2027-01-20T02:00:00Z',
  endAt: '2027-01-21T10:00:00Z',
  partnerApplicationDeadlineAt: '2027-01-05T10:00:00Z',
  boothRequestDeadlineAt: '2027-01-10T10:00:00Z',
  activityProposalDeadlineAt: '2027-01-10T10:00:00Z',
  participantRegistrationDeadlineAt: '2027-01-18T10:00:00Z',
  partnerWithdrawalCutoffAt: '2027-01-12T10:00:00Z',
  boothCancellationCutoffAt: '2027-01-12T10:00:00Z',
  activityCancellationCutoffAt: '2027-01-12T10:00:00Z',
  boothPaymentWindowMinutes: 1440,
  maxBoothsPerPartner: 2,
  maxActivitiesPerPartner: 2,
  bannerUrl: null,
  status: 'PUBLISHED',
  createdAt: '2026-10-08T00:00:00Z',
  updatedAt: '2026-10-08T00:00:00Z',
};

const physicalBooth = {
  boothId: 11,
  code: 'A05',
  name: 'Gian sách thiếu nhi',
  description: 'Vị trí gần cổng chính.',
  maxCapacity: 8,
  mapX: 20,
  mapY: 30,
  active: true,
  categoryCode: 'CHILDREN',
  note: null,
};

const eventBooth = {
  eventBoothConfigId: 71,
  eventId: 101,
  booth: physicalBooth,
  rentalPrice: 5_000_000,
  enabled: true,
  availability: 'AVAILABLE',
};

const emptyPage = { content: [], page: 0, size: 200, totalElements: 0, totalPages: 0 };

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockOrganizer(page: Page): Promise<void> {
  let physicalBooths = [physicalBooth];
  let organizerRequests: Record<string, unknown>[] = [{
    boothRequestId: 77,
    eventId: 101,
    boothId: 11,
    boothCode: 'A05',
    partnerOrganizationId: 9,
    partnerOrganizationName: 'NXB Demo',
    status: 'PENDING',
    requestNote: 'Trưng bày sách thiếu nhi.',
    reviewNote: null,
    submittedAt: '2026-10-08T01:00:00Z',
    reviewedAt: null,
    selectedAt: null,
    completedAt: null,
    paymentExpiredAt: null,
    withdrawnAt: null,
    hold: null,
  }];
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/me')) return json(route, { userId: 1, username: 'organizer', fullName: 'Organizer Demo', email: 'organizer@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'ORGANIZER'] });
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path.endsWith('/organizer/events') && method === 'GET') return json(route, { content: [event], page: 0, size: 100, totalElements: 1, totalPages: 1 });
    if (path.endsWith('/organizer/booths') && method === 'GET') return json(route, { content: physicalBooths, page: 0, size: 200, totalElements: physicalBooths.length, totalPages: 1 });
    if (path.endsWith('/organizer/booths') && method === 'POST') {
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({ code: 'B01', name: 'Gian văn học', maxCapacity: 6 });
      const created = { ...physicalBooth, ...body, boothId: 12 };
      physicalBooths = [...physicalBooths, created];
      return json(route, created, 201);
    }
    if (path.endsWith('/organizer/events/101/booth-configs') && method === 'GET') return json(route, [eventBooth]);
    if (path.endsWith('/organizer/events/101/booth-configs/11') && method === 'PUT') {
      expect(route.request().postDataJSON()).toEqual({ rentalPrice: 5_500_000, enabled: true });
      return json(route, { ...eventBooth, rentalPrice: 5_500_000 });
    }
    if (path.endsWith('/organizer/events/101/booth-requests') && method === 'GET') return json(route, { content: organizerRequests, page: 0, size: 200, totalElements: organizerRequests.length, totalPages: 1 });
    if (path.endsWith('/organizer/events/101/booth-requests/77/select') && method === 'POST') {
      const selected = { ...organizerRequests[0], status: 'SELECTED', selectedAt: '2026-10-08T02:00:00Z', hold: { boothHoldId: 501, status: 'ACTIVE', lockedRentalPrice: 5_000_000, createdAt: '2026-10-08T02:00:00Z', expiresAt: '2026-10-09T02:00:00Z', releasedAt: null } };
      organizerRequests = [selected];
      return json(route, selected);
    }
    if (path.includes('/organizer/activities') || path.includes('/organizer/participants')) return json(route, []);
    if (path.includes('/public/') || (path.endsWith('/events') && method === 'GET')) return json(route, emptyPage);
    return json(route, { code: 'TEST_ROUTE_NOT_MOCKED', message: `${method} ${path}` }, 404);
  });
}

async function mockPartner(page: Page): Promise<void> {
  let requests: Record<string, unknown>[] = [{
    boothRequestId: 80,
    eventId: 101,
    boothId: 11,
    boothCode: 'A05',
    partnerOrganizationId: 9,
    partnerOrganizationName: 'NXB Demo',
    status: 'SELECTED',
    requestNote: 'Yêu cầu đã được chọn.',
    reviewNote: null,
    submittedAt: '2026-10-07T01:00:00Z',
    reviewedAt: '2026-10-08T01:00:00Z',
    selectedAt: '2026-10-08T01:00:00Z',
    completedAt: null,
    paymentExpiredAt: null,
    withdrawnAt: null,
    hold: {
      boothHoldId: 500,
      status: 'ACTIVE',
      lockedRentalPrice: 5_000_000,
      createdAt: '2026-10-08T01:00:00Z',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      releasedAt: null,
    },
  }];
  const availableBooth = {
    ...eventBooth,
    eventBoothConfigId: 72,
    booth: { ...physicalBooth, boothId: 12, code: 'B02', name: 'Gian văn học' },
    rentalPrice: 4_000_000,
  };
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/me')) return json(route, { userId: 2, username: 'partner', fullName: 'Partner Demo', email: 'partner@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'PARTNER'] });
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path.endsWith('/partner/organization')) return json(route, { partnerOrganizationId: 9, name: 'NXB Demo', description: 'Đối tác kiểm thử', categoryCode: 'PUBLISHER', logoUrl: null, contactEmail: 'partner@example.com', contactPhone: null, address: null, status: 'ACTIVE' });
    if (path.endsWith('/partner/applications')) return json(route, { content: [{ applicationId: 31, eventId: 101, partnerOrganizationId: 9, status: 'APPROVED', applicationNote: null, reviewNote: null, submittedAt: '2026-10-01T00:00:00Z', reviewedAt: '2026-10-02T00:00:00Z', withdrawnAt: null }], page: 0, size: 100, totalElements: 1, totalPages: 1 });
    if (path.endsWith('/events') && method === 'GET') return json(route, { content: [event], page: 0, size: 100, totalElements: 1, totalPages: 1 });
    if (path.endsWith('/events/101/booths') && method === 'GET') return json(route, { content: [{ ...eventBooth, availability: 'ON_HOLD' }, availableBooth], page: 0, size: 200, totalElements: 2, totalPages: 1 });
    if (path.endsWith('/partner/booth-requests') && method === 'GET') return json(route, { content: requests, page: 0, size: 200, totalElements: requests.length, totalPages: requests.length ? 1 : 0 });
    if (path.endsWith('/events/101/booth-requests') && method === 'POST') {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ boothId: 12, requestNote: 'Ưu tiên trưng bày sách văn học.' });
      const request = { boothRequestId: 88, eventId: 101, boothId: 12, boothCode: 'B02', partnerOrganizationId: 9, partnerOrganizationName: 'NXB Demo', status: 'PENDING', requestNote: body.requestNote, reviewNote: null, submittedAt: '2026-10-08T01:00:00Z', reviewedAt: null, selectedAt: null, completedAt: null, paymentExpiredAt: null, withdrawnAt: null, hold: null };
      requests = [request, ...requests];
      return json(route, request, 201);
    }
    if (path.includes('/public/')) return json(route, []);
    return json(route, { code: 'TEST_ROUTE_NOT_MOCKED', message: `${method} ${path}` }, 404);
  });
}

test('Organizer manages a physical Booth, Event price, and candidate selection', async ({ page }) => {
  await mockOrganizer(page);
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Yêu cầu gian hàng' }).click();
  await expect(page.getByRole('heading', { name: 'Gian hàng & yêu cầu đối tác' })).toBeVisible();
  await expect(page.getByText('A05', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Thêm gian hàng' }).click();
  await page.getByLabel('Mã gian hàng').fill('B01');
  await page.getByLabel('Tên gian hàng').fill('Gian văn học');
  await page.getByLabel('Sức chứa').fill('6');
  await page.getByRole('button', { name: 'Lưu gian hàng' }).click();
  await expect(page.getByRole('status')).toContainText('Đã tạo gian hàng');
  await expect(page.getByText('B01', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Cấu hình sự kiện/ }).click();
  const configuredBooth = page.locator('.s2-config-row').filter({ hasText: 'A05' });
  await expect(configuredBooth.getByLabel('Giá thuê (VND)')).toHaveValue('5000000');
  await expect(configuredBooth.getByText('Còn trống')).toBeVisible();
  await configuredBooth.getByLabel('Giá thuê (VND)').fill('5500000');
  await configuredBooth.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã cập nhật cấu hình A05');
  await page.getByRole('button', { name: /Yêu cầu đối tác/ }).click();
  await expect(page.getByText('NXB Demo')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Chọn & giữ chỗ' }).click();
  await expect(page.getByText('Đã chọn', { exact: true })).toBeVisible();
  await expect(page.getByText(/5.000.000/)).toBeVisible();

  await page.getByRole('button', { name: 'Gian hàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sơ đồ & Danh sách gian hàng' })).toBeVisible();
});

test('Approved Partner browses an AVAILABLE Booth and submits a PENDING request', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPartner(page);
  await page.goto('/partner/booth-requests');
  await expect(page.getByRole('heading', { name: 'Chọn gian hàng cho sự kiện' })).toBeVisible();
  await page.getByRole('button', { name: /Yêu cầu của tôi/ }).click();
  await expect(page.getByText('Đã được chọn', { exact: true })).toBeVisible();
  await expect(page.getByText('Thời gian còn lại')).toBeVisible();
  await expect(page.getByText(/Giá đã khóa/)).toBeVisible();
  await page.getByRole('button', { name: /Danh sách gian hàng/ }).click();
  await expect(page.getByText('Gian văn học')).toBeVisible();
  const availableCard = page.locator('article').filter({ hasText: 'B02' });
  await availableCard.getByRole('button', { name: 'Xem & gửi yêu cầu' }).click();
  await page.getByLabel('Ghi chú cho Organizer (không bắt buộc)').fill('Ưu tiên trưng bày sách văn học.');
  await page.getByRole('button', { name: 'Gửi yêu cầu gian hàng' }).click();
  await expect(page.getByRole('status')).toContainText('Đã gửi yêu cầu');
  await expect(page.getByText('Chờ duyệt')).toBeVisible();
  await expect(page.getByText('Gian B02')).toBeVisible();

  await page.goto('/partner/booths');
  await expect(page.getByRole('heading', { name: 'Quản lý gian hàng', exact: true })).toBeVisible();
  await page.goto('/partner/booths/select');
  await expect(page.getByRole('heading', { name: 'Sơ đồ & Chọn đổi gian hàng' })).toBeVisible();
});
