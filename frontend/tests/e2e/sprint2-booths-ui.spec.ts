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

async function mockOrganizer(page: Page): Promise<{
  getSavedBoothPosition: () => { mapX: number; mapY: number } | null;
  getConfigurationRequests: () => Array<{ rentalPrice: number; enabled: boolean }>;
}> {
  let physicalBooths = [physicalBooth];
  let savedBoothPosition: { mapX: number; mapY: number } | null = null;
  let currentEventBooth = eventBooth;
  const configurationRequests: Array<{ rentalPrice: number; enabled: boolean }> = [];
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
      expect(body).toMatchObject({ code: 'B01', name: 'Gian văn học', maxCapacity: 1 });
      const created = { ...physicalBooth, ...body, boothId: 12 };
      physicalBooths = [...physicalBooths, created];
      return json(route, created, 201);
    }
    if (path.endsWith('/organizer/booths/12') && method === 'PATCH') {
      const body = route.request().postDataJSON();
      expect(body.mapX).toBeGreaterThanOrEqual(0);
      expect(body.mapX).toBeLessThanOrEqual(100);
      expect(body.mapY).toBeGreaterThanOrEqual(0);
      expect(body.mapY).toBeLessThanOrEqual(100);
      savedBoothPosition = body;
      const updated = { ...physicalBooths.find(booth => booth.boothId === 12), ...body };
      physicalBooths = physicalBooths.map(booth => booth.boothId === 12 ? updated : booth);
      return json(route, updated);
    }
    if (path.endsWith('/organizer/events/101/booth-configs') && method === 'GET') return json(route, [currentEventBooth]);
    if (path.endsWith('/organizer/events/101/booth-configs/11') && method === 'PUT') {
      const body = route.request().postDataJSON() as { rentalPrice: number; enabled: boolean };
      configurationRequests.push(body);
      currentEventBooth = { ...currentEventBooth, ...body };
      return json(route, currentEventBooth);
    }
    if (path.endsWith('/organizer/events/101/booth-requests') && method === 'GET') return json(route, { content: organizerRequests, page: 0, size: 200, totalElements: organizerRequests.length, totalPages: 1 });
    if (path.endsWith('/organizer/events/101/booth-requests/77/select') && method === 'POST') {
      const selected = { ...organizerRequests[0], status: 'SELECTED', selectedAt: '2026-10-08T02:00:00Z', hold: { boothHoldId: 501, status: 'ACTIVE', lockedRentalPrice: currentEventBooth.rentalPrice, createdAt: '2026-10-08T02:00:00Z', expiresAt: '2026-10-09T02:00:00Z', releasedAt: null } };
      organizerRequests = [selected];
      return json(route, selected);
    }
    if (path.includes('/organizer/activities') || path.includes('/organizer/participants')) return json(route, []);
    if (path.includes('/public/') || (path.endsWith('/events') && method === 'GET')) return json(route, emptyPage);
    return json(route, { code: 'TEST_ROUTE_NOT_MOCKED', message: `${method} ${path}` }, 404);
  });
  return {
    getSavedBoothPosition: () => savedBoothPosition,
    getConfigurationRequests: () => configurationRequests,
  };
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
    booth: { ...physicalBooth, boothId: 12, code: 'B02', name: 'Gian văn học', mapX: 65, mapY: 45 },
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

async function mockPublicMap(page: Page): Promise<void> {
  const eventWithoutPositions = { ...event, eventId: 102, name: 'Sự kiện chưa định vị' };
  const booths = [
    eventBooth,
    {
      ...eventBooth,
      eventBoothConfigId: 73,
      booth: { ...physicalBooth, boothId: 13, code: 'C03', name: 'Gian chưa định vị', mapX: null, mapY: null },
    },
    {
      ...eventBooth,
      eventBoothConfigId: 74,
      booth: { ...physicalBooth, boothId: 14, code: 'D04', name: 'Gian ngoài phạm vi', mapX: 101, mapY: 20 },
    },
  ];
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/me')) return json(route, { code: 'UNAUTHENTICATED', message: 'Anonymous' }, 401);
    if (path.endsWith('/events') && method === 'GET') return json(route, { content: [event, eventWithoutPositions], page: 0, size: 100, totalElements: 2, totalPages: 1 });
    if (path.endsWith('/events/101/booths') && method === 'GET') return json(route, { content: booths, page: 0, size: 100, totalElements: booths.length, totalPages: 1 });
    if (path.endsWith('/events/102/booths') && method === 'GET') return json(route, { content: booths.slice(1), page: 0, size: 100, totalElements: 2, totalPages: 1 });
    if (path.endsWith('/public/heritages')) return json(route, []);
    return json(route, { code: 'TEST_ROUTE_NOT_MOCKED', message: `${method} ${path}` }, 404);
  });
}

test('Organizer manages a physical Booth, Event price, and candidate selection', async ({ page }) => {
  const { getSavedBoothPosition, getConfigurationRequests } = await mockOrganizer(page);
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Yêu cầu gian hàng' }).click();
  await expect(page.getByRole('heading', { name: 'Sơ đồ & Quản lý vị trí gian hàng' })).toBeVisible();
  await expect(page.getByText('A05', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Thêm gian hàng' }).click();
  await page.getByPlaceholder('Ví dụ: A01, B02, C10').fill('B01');
  await page.getByPlaceholder(/Ví dụ: Gian Hàng A01/).fill('Gian văn học');
  await page.getByRole('button', { name: 'Thêm gian hàng', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã tạo gian hàng');
  await expect(page.getByText('B01', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Cấu hình sự kiện/ }).click();
  const configuredBooth = page.locator('.s2-config-row').filter({ hasText: 'A05' });
  const rentalPrice = configuredBooth.locator('input[type="number"]');
  await expect(rentalPrice).toHaveValue('5000000');
  await expect(configuredBooth.getByText('Còn trống')).toBeVisible();
  await rentalPrice.fill('5500000');
  await rentalPrice.press('Tab');
  await expect(page.getByRole('status')).toContainText('Đã cập nhật giá thuê cho A05');
  const enabledToggle = configuredBooth.getByRole('checkbox');
  await expect(enabledToggle).toBeEnabled();
  await configuredBooth.locator('.s2-switch-wrapper').click();
  await expect(page.getByRole('status')).toContainText('Đã tắt gian hàng A05');
  await expect(rentalPrice).toHaveValue('5500000');
  await configuredBooth.locator('.s2-switch-wrapper').click();
  await expect(page.getByRole('status')).toContainText('Đã mở gian hàng A05');
  await expect(enabledToggle).toBeChecked();
  expect(getConfigurationRequests()).toEqual([
    { rentalPrice: 5_500_000, enabled: true },
    { rentalPrice: 5_500_000, enabled: false },
    { rentalPrice: 5_500_000, enabled: true },
  ]);
  await page.getByRole('button', { name: /Duyệt yêu cầu thuê gian hàng/ }).click();
  await expect(page.getByText('NXB Demo')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Duyệt & Cấp giữ chỗ' }).click();
  await expect(page.getByText('Đã chọn / Giữ chỗ', { exact: true })).toBeVisible();
  await expect(page.getByText(/5.500.000/)).toBeVisible();

  await page.getByRole('button', { name: /Sơ đồ bản đồ gian hàng/ }).click();
  const mapLayer = page.locator('.booth-map-image-layer');
  const newBoothMarker = page.getByRole('button', { name: /B01.*Còn trống/ });
  await expect(newBoothMarker).toBeVisible();
  const mapBox = await mapLayer.boundingBox();
  const markerBox = await newBoothMarker.boundingBox();
  expect(mapBox).not.toBeNull();
  expect(markerBox).not.toBeNull();
  await page.mouse.move(markerBox!.x + markerBox!.width / 2, markerBox!.y + markerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(mapBox!.x + mapBox!.width * 0.625, mapBox!.y + mapBox!.height * 0.48, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Lưu sơ đồ' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu thành công tọa độ 1 gian hàng');
  await page.reload();
  await page.getByRole('navigation', { name: 'Điều hướng chức năng' })
    .getByRole('button', { name: 'Yêu cầu gian hàng', exact: true })
    .click();
  const persistedMarker = page.getByRole('button', { name: /B01.*Còn trống/ });
  await expect(persistedMarker).toBeVisible();
  const savedBoothPosition = getSavedBoothPosition();
  expect(savedBoothPosition).not.toBeNull();
  await expect(persistedMarker).toHaveAttribute(
    'style',
    new RegExp(`left: ${savedBoothPosition!.mapX}%; top: ${savedBoothPosition!.mapY}%`),
  );
});

test('Approved Partner browses an AVAILABLE Booth and submits a PENDING request', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPartner(page);
  await page.goto('/partner/booth-requests');
  await expect(page.getByRole('heading', { name: 'Sơ đồ & Yêu cầu gian hàng' })).toBeVisible();
  await page.getByRole('button', { name: /Yêu cầu của tôi/ }).click();
  await expect(page.getByText('Đã được chọn', { exact: true })).toBeVisible();
  await expect(page.getByText('Thời gian còn lại')).toBeVisible();
  await expect(page.getByTestId('booth-payment-checkout-card')).toBeVisible();
  await page.getByRole('button', { name: /Sơ đồ gian hàng/ }).click();
  const availableMarker = page.getByRole('button', { name: /B02.*Còn trống/ });
  await expect(availableMarker).toBeVisible();
  await expect(availableMarker).toHaveCSS('left', /.+/);
  const markerLeft = await availableMarker.evaluate(element => (element as HTMLElement).style.left);
  const markerTop = await availableMarker.evaluate(element => (element as HTMLElement).style.top);
  await page.getByRole('button', { name: 'Phóng to' }).click();
  await expect(availableMarker).toHaveAttribute('style', new RegExp(`left: ${markerLeft.replace('.', '\\.')}.*top: ${markerTop.replace('.', '\\.')}`));
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(availableMarker).toHaveAttribute('style', new RegExp(`left: ${markerLeft.replace('.', '\\.')}.*top: ${markerTop.replace('.', '\\.')}`));
  await availableMarker.click();
  await page.getByLabel('Ghi chú gửi Ban tổ chức').fill('Ưu tiên trưng bày sách văn học.');
  await page.getByRole('button', { name: 'Gửi yêu cầu thuê / đổi gian' }).click();
  await expect(page.getByRole('status')).toContainText('Đã gửi yêu cầu');
  await expect(page.getByText('Chờ duyệt')).toBeVisible();
  await expect(page.getByText('Gian B02')).toBeVisible();

  await page.goto('/partner/booths');
  await expect(page).toHaveURL(/\/partner\/booth-requests$/);
  await expect(page.getByRole('heading', { name: 'Sơ đồ & Yêu cầu gian hàng' })).toBeVisible();
  await page.goto('/partner/booths/select');
  await expect(page).toHaveURL(/\/partner\/booth-requests$/);
  await expect(page.getByRole('heading', { name: 'Sơ đồ & Yêu cầu gian hàng' })).toBeVisible();
});

test('Public visitor switches published Events and sees only Booths with valid coordinates', async ({ page }) => {
  const emptySourceWarnings: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('empty string')) {
      emptySourceWarnings.push(message.text());
    }
  });
  await mockPublicMap(page);
  await page.goto('/');
  const eventPicker = page.getByLabel('Sự kiện công khai').first();
  await expect(eventPicker).toHaveValue('101');
  const marker = page.getByRole('button', { name: /A05.*Còn trống/ });
  await expect(marker).toBeVisible();
  await expect(page.getByRole('button', { name: /C03/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /D04/ })).toHaveCount(0);
  await marker.click();
  await expect(page.getByLabel('Thông tin gian hàng theo sự kiện')).toContainText('5.000.000');
  await expect(page.getByLabel('Thông tin gian hàng theo sự kiện')).toContainText('Còn trống');
  await expect(page.getByRole('button', { name: /Gửi yêu cầu gian hàng/ })).toHaveCount(0);
  await eventPicker.selectOption('102');
  await expect(page.getByRole('button', { name: /A05/ })).toHaveCount(0);
  await expect(page.getByText('Sự kiện này chưa có gian hàng nào với đủ tọa độ hợp lệ để hiển thị trên bản đồ.')).toBeVisible();
  await eventPicker.selectOption('101');
  await expect(marker).toBeVisible();
  await expect(page.locator('img[src=""]')).toHaveCount(0);
  expect(emptySourceWarnings).toEqual([]);
});
