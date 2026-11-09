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

const secondEvent = {
  ...event,
  eventId: 102,
  name: 'Hội sách Mùa xuân',
  startAt: '2027-02-10T02:00:00Z',
  endAt: '2027-02-12T10:00:00Z',
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

async function mockOrganizer(page: Page, options: { multipleEvents?: boolean } = {}): Promise<{
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
    if (path.endsWith('/organizer/events') && method === 'GET') {
      const events = options.multipleEvents ? [event, secondEvent] : [event];
      return json(route, { content: events, page: 0, size: 100, totalElements: events.length, totalPages: 1 });
    }
    if (path.endsWith('/organizer/booths') && method === 'GET') return json(route, { content: physicalBooths, page: 0, size: 200, totalElements: physicalBooths.length, totalPages: 1 });
    if (path.endsWith('/organizer/locations') && method === 'GET') return json(route, { content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
    if (path.endsWith('/organizer/booths') && method === 'POST') {
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({ code: 'B01', name: 'Gian văn học', maxCapacity: 1 });
      const created = { ...physicalBooth, ...body, boothId: 12 };
      physicalBooths = [...physicalBooths, created];
      return json(route, created, 201);
    }
    if (path.endsWith('/organizer/booths/12') && method === 'PATCH') {
      const body = route.request().postDataJSON();
      expect(body.active).toBeUndefined();
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
    if (path.endsWith('/organizer/events/102/booth-configs') && method === 'GET') return json(route, []);
    if (path.endsWith('/organizer/events/102/booth-requests') && method === 'GET') return json(route, {
      content: [{ ...organizerRequests[0], boothRequestId: 78, eventId: 102, partnerOrganizationName: 'NXB Mùa xuân' }],
      page: 0,
      size: 200,
      totalElements: 1,
      totalPages: 1,
    });
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

async function mockPartner(page: Page, options: {
  quotaExceeded?: boolean;
  requestDeadlinePassed?: boolean;
  selectedWithdrawalError?: 'PAYMENT_ATTEMPT_ALREADY_PENDING' | 'PAYMENT_RESULT_UNKNOWN';
  emptyEventFirst?: boolean;
  refreshAddsApplication?: boolean;
  workflowStates?: boolean;
} = {}): Promise<void> {
  let delayInitialEvent = true;
  let applicationLoadCount = 0;
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
  if (options.workflowStates) {
    requests = [
      ...requests,
      {
        boothRequestId: 81, eventId: 101, boothId: 11, boothCode: 'A06', partnerOrganizationId: 9,
        partnerOrganizationName: 'NXB Demo', status: 'PENDING', requestNote: 'Ưu tiên khu vực gần sân khấu.', reviewNote: null,
        submittedAt: '2026-10-09T01:00:00Z', reviewedAt: null, selectedAt: null, completedAt: null,
        paymentExpiredAt: null, withdrawnAt: null, cancelledAt: null, hold: null,
      },
      {
        boothRequestId: 82, eventId: 101, boothId: 11, boothCode: 'A07', partnerOrganizationId: 9,
        partnerOrganizationName: 'NXB Demo', status: 'WITHDRAWN', requestNote: null, reviewNote: null,
        submittedAt: '2026-10-08T01:00:00Z', reviewedAt: null, selectedAt: null, completedAt: null,
        paymentExpiredAt: null, withdrawnAt: '2026-10-08T03:00:00Z', cancelledAt: null, hold: null,
      },
      {
        boothRequestId: 83, eventId: 101, boothId: 11, boothCode: 'A08', partnerOrganizationId: 9,
        partnerOrganizationName: 'NXB Demo', status: 'REJECTED', requestNote: null,
        reviewNote: 'Vị trí này không phù hợp với danh mục đăng ký.', submittedAt: '2026-10-07T01:00:00Z',
        reviewedAt: '2026-10-07T04:00:00Z', selectedAt: null, completedAt: null,
        paymentExpiredAt: null, withdrawnAt: null, cancelledAt: null, hold: null,
      },
      {
        boothRequestId: 84, eventId: 101, boothId: 11, boothCode: 'A09', partnerOrganizationId: 9,
        partnerOrganizationName: 'NXB Demo', status: 'PAYMENT_EXPIRED', requestNote: null, reviewNote: null,
        submittedAt: '2026-10-06T01:00:00Z', reviewedAt: '2026-10-06T02:00:00Z', selectedAt: '2026-10-06T02:00:00Z',
        completedAt: null, paymentExpiredAt: '2026-10-07T02:00:00Z', withdrawnAt: null, cancelledAt: null,
        hold: { boothHoldId: 504, status: 'EXPIRED', lockedRentalPrice: 4_500_000, createdAt: '2026-10-06T02:00:00Z', expiresAt: '2026-10-07T02:00:00Z', releasedAt: '2026-10-07T02:00:00Z' },
      },
      {
        boothRequestId: 85, eventId: 101, boothId: 11, boothCode: 'A10', partnerOrganizationId: 9,
        partnerOrganizationName: 'NXB Demo', status: 'COMPLETED', requestNote: null, reviewNote: 'Đã xác nhận vị trí.',
        submittedAt: '2026-10-05T01:00:00Z', reviewedAt: '2026-10-05T02:00:00Z', selectedAt: '2026-10-05T02:00:00Z',
        completedAt: '2026-10-05T05:00:00Z', paymentExpiredAt: null, withdrawnAt: null, cancelledAt: null,
        hold: { boothHoldId: 505, status: 'CONSUMED', lockedRentalPrice: 5_000_000, createdAt: '2026-10-05T02:00:00Z', expiresAt: '2026-10-06T02:00:00Z', releasedAt: null },
      },
      {
        boothRequestId: 86, eventId: 101, boothId: 11, boothCode: 'A11', partnerOrganizationId: 9,
        partnerOrganizationName: 'NXB Demo', status: 'NOT_SELECTED', requestNote: null, reviewNote: null,
        submittedAt: '2026-10-04T01:00:00Z', reviewedAt: null, selectedAt: null, completedAt: null,
        paymentExpiredAt: null, withdrawnAt: null, cancelledAt: null, hold: null,
      },
      {
        boothRequestId: 87, eventId: 101, boothId: 11, boothCode: 'A12', partnerOrganizationId: 9,
        partnerOrganizationName: 'NXB Demo', status: 'CANCELLED', requestNote: null, reviewNote: null,
        submittedAt: '2026-10-03T01:00:00Z', reviewedAt: null, selectedAt: null, completedAt: null,
        paymentExpiredAt: null, withdrawnAt: null, cancelledAt: '2026-10-03T06:00:00Z', hold: null,
      },
      {
        boothRequestId: 88, eventId: 101, boothId: 11, boothCode: 'A13', partnerOrganizationId: 9,
        partnerOrganizationName: 'NXB Demo', status: 'COMPLETED', requestNote: null, reviewNote: null,
        submittedAt: '2026-10-02T01:00:00Z', reviewedAt: '2026-10-02T02:00:00Z', selectedAt: '2026-10-02T02:00:00Z',
        completedAt: '2026-10-02T02:00:00Z', paymentExpiredAt: null, withdrawnAt: null, cancelledAt: null,
        hold: { boothHoldId: 508, status: 'CONSUMED', lockedRentalPrice: 0, createdAt: '2026-10-02T02:00:00Z', expiresAt: '2026-10-03T02:00:00Z', releasedAt: null },
      },
    ];
  }
  const availableBooth = {
    ...eventBooth,
    eventBoothConfigId: 72,
    booth: { ...physicalBooth, boothId: 12, code: 'B02', name: 'Gian văn học', mapX: 65, mapY: 45 },
    rentalPrice: 4_000_000,
  };
  const secondEventBooth = {
    ...eventBooth,
    eventBoothConfigId: 73,
    eventId: 102,
    booth: { ...physicalBooth, boothId: 13, code: 'C09', name: 'Gian sự kiện mùa xuân', mapX: 50, mapY: 55 },
    rentalPrice: 3_500_000,
  };
  const unavailableBooth = {
    ...eventBooth,
    eventBoothConfigId: null,
    booth: { ...physicalBooth, boothId: 14, code: 'D10', name: 'Gian chưa mở', mapX: 80, mapY: 60 },
    rentalPrice: null,
    enabled: false,
    availability: 'UNAVAILABLE',
  };
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/me')) return json(route, { userId: 2, username: 'partner', fullName: 'Partner Demo', email: 'partner@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'PARTNER'] });
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path.endsWith('/partner/organization')) return json(route, { partnerOrganizationId: 9, name: 'NXB Demo', description: 'Đối tác kiểm thử', categoryCode: 'PUBLISHER', logoUrl: null, contactEmail: 'partner@example.com', contactPhone: null, address: null, status: 'ACTIVE' });
    if (path.endsWith('/partner/applications')) {
      applicationLoadCount += 1;
      const applicationWithRequest = { applicationId: 31, eventId: 101, partnerOrganizationId: 9, status: 'APPROVED', applicationNote: null, reviewNote: null, submittedAt: '2026-10-01T00:00:00Z', reviewedAt: '2026-10-02T00:00:00Z', withdrawnAt: null };
      const applicationWithoutRequests = { applicationId: 32, eventId: 102, partnerOrganizationId: 9, status: 'APPROVED', applicationNote: null, reviewNote: null, submittedAt: '2026-10-02T00:00:00Z', reviewedAt: '2026-10-03T00:00:00Z', withdrawnAt: null };
      const allApplications = options.emptyEventFirst
        ? [applicationWithoutRequests, applicationWithRequest]
        : [applicationWithRequest, applicationWithoutRequests];
      const applications = options.refreshAddsApplication && applicationLoadCount === 1
        ? [applicationWithRequest]
        : allApplications;
      return json(route, { content: applications, page: 0, size: 100, totalElements: applications.length, totalPages: 1 });
    }
    if (path.endsWith('/events') && method === 'GET') return json(route, { content: [event, secondEvent], page: 0, size: 100, totalElements: 2, totalPages: 1 });
    if (path.endsWith('/events/101/booths') && method === 'GET') {
      if (delayInitialEvent) {
        delayInitialEvent = false;
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      const booths = [{ ...eventBooth, availability: 'ON_HOLD' }, availableBooth, unavailableBooth];
      return json(route, { content: booths, page: 0, size: 200, totalElements: booths.length, totalPages: 1 });
    }
    if (path.endsWith('/events/102/booths') && method === 'GET') return json(route, { content: [secondEventBooth], page: 0, size: 200, totalElements: 1, totalPages: 1 });
    if (path.endsWith('/partner/booth-requests/80/payments') && method === 'GET') return json(route, { content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
    if (path.endsWith('/partner/booth-requests') && method === 'GET') {
      const eventRequests = url.searchParams.get('eventId') === '102' ? [] : requests;
      return json(route, { content: eventRequests, page: 0, size: 200, totalElements: eventRequests.length, totalPages: eventRequests.length ? 1 : 0 });
    }
    if (path.endsWith('/events/101/booth-requests') && method === 'POST') {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ boothId: 12, requestNote: 'Ưu tiên trưng bày sách văn học.' });
      if (options.quotaExceeded) {
        return json(route, {
          code: 'BOOTH_QUOTA_EXCEEDED',
          message: "The Partner has reached this Event's Booth quota.",
        }, 409);
      }
      if (options.requestDeadlinePassed) {
        return json(route, {
          code: 'BOOTH_REQUEST_DEADLINE_PASSED',
          message: 'The Booth request deadline has passed.',
        }, 409);
      }
      const request = { boothRequestId: 88, eventId: 101, boothId: 12, boothCode: 'B02', partnerOrganizationId: 9, partnerOrganizationName: 'NXB Demo', status: 'PENDING', requestNote: body.requestNote, reviewNote: null, submittedAt: '2026-10-08T01:00:00Z', reviewedAt: null, selectedAt: null, completedAt: null, paymentExpiredAt: null, withdrawnAt: null, hold: null };
      requests = [request, ...requests];
      return json(route, request, 201);
    }
    if (path.endsWith('/partner/booth-requests/80/withdraw') && method === 'POST') {
      expect(route.request().headers()['x-csrf-token']).toBe('test-token');
      if (options.selectedWithdrawalError) {
        return json(route, {
          code: options.selectedWithdrawalError,
          message: 'Raw backend payment blocker message.',
        }, 409);
      }
      const request = requests.find(item => item.boothRequestId === 80)!;
      const releasedAt = '2026-10-08T02:00:00Z';
      const withdrawn = {
        ...request,
        status: 'WITHDRAWN',
        withdrawnAt: releasedAt,
        hold: { ...(request.hold as Record<string, unknown>), status: 'RELEASED', releasedAt },
      };
      requests = requests.map(item => item.boothRequestId === 80 ? withdrawn : item);
      return json(route, withdrawn);
    }
    if (path.endsWith('/partner/booth-requests/88/withdraw') && method === 'POST') {
      expect(route.request().headers()['x-csrf-token']).toBe('test-token');
      const request = requests.find(item => item.boothRequestId === 88)!;
      const withdrawn = { ...request, status: 'WITHDRAWN', withdrawnAt: '2026-10-08T02:00:00Z' };
      requests = requests.map(item => item.boothRequestId === 88 ? withdrawn : item);
      return json(route, withdrawn);
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
    if (path.endsWith('/heritages')) return json(route, { content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
    return json(route, { code: 'TEST_ROUTE_NOT_MOCKED', message: `${method} ${path}` }, 404);
  });
}

test('Organizer manages a physical Booth, Event price, and candidate selection', async ({ page }) => {
  const { getSavedBoothPosition, getConfigurationRequests } = await mockOrganizer(page);
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Gian hàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quản lý Gian hàng' })).toBeVisible();
  await expect(page.getByText('A05', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Thêm gian hàng mới' }).click();
  const imageUrl = page.getByRole('textbox', { name: 'Ảnh gian hàng', exact: true });
  await imageUrl.scrollIntoViewIfNeeded();
  const urlBounds = await imageUrl.boundingBox();
  const uploadBounds = await page.getByRole('button', { name: 'Chọn ảnh từ máy', exact: true }).boundingBox();
  const previewBounds = await page.locator('.image-url-field-preview').boundingBox();
  expect(uploadBounds!.y).toBeGreaterThanOrEqual(urlBounds!.y + urlBounds!.height);
  expect(previewBounds!.x).toBeGreaterThan(urlBounds!.x + urlBounds!.width);
  await page.getByPlaceholder('Ví dụ: A01, B02, C10').fill('B01');
  await page.getByPlaceholder(/Ví dụ: Gian Hàng A01/).fill('Gian văn học');
  await page.getByRole('button', { name: 'Thêm gian hàng', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã thêm mới thành công gian hàng');
  await expect(page.getByText('B01', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Sơ đồ Không gian Đường Sách' }).click();
  const mapLayer = page.locator('.booth-map-image-layer');
  const newBoothMarker = page.getByRole('button', { name: /B01.*Đang hoạt động/ });
  await expect(newBoothMarker).toBeVisible();
  await newBoothMarker.click();
  const mapPopover = page.locator('.booth-marker-popover');
  await expect(mapPopover.getByText('Đang hoạt động', { exact: true })).toBeVisible();
  await expect(mapPopover.getByLabel('Trạng thái vật lý')).toHaveCount(0);
  await mapPopover.getByRole('button', { name: 'Lưu thay đổi' }).click();
  expect(getConfigurationRequests()).toHaveLength(0);

  const mapBox = await mapLayer.boundingBox();
  const markerBox = await newBoothMarker.boundingBox();
  expect(mapBox).not.toBeNull();
  expect(markerBox).not.toBeNull();
  await page.mouse.move(markerBox!.x + markerBox!.width / 2, markerBox!.y + markerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(mapBox!.x + mapBox!.width * 0.625, mapBox!.y + mapBox!.height * 0.48, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Lưu sơ đồ' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu tọa độ của 1 vị trí');

  await page.getByRole('button', { name: 'Sự kiện', exact: true }).click();
  await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
  await page.locator('.org-tabs-bar').getByRole('button', { name: 'Gian hàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Danh sách gian hàng cho thuê|Cấu hình gian hàng & giá sự kiện/ })).toBeVisible();
  const configuredBooth = page.locator('.s2-config-row').filter({ hasText: 'A05' });
  const unconfiguredBooth = page.locator('.s2-config-row').filter({ hasText: 'B01' });
  await expect(configuredBooth.getByText('5.000.000 đ')).toBeVisible();
  await expect(configuredBooth.getByText('Đang cho thuê')).toBeVisible();
  await expect(unconfiguredBooth.getByText('Chưa mở cho thuê')).toBeVisible();
  await expect(unconfiguredBooth.getByText('Chưa có giá')).toBeVisible();

  // Open Drawer to configure booth A05
  await configuredBooth.getByRole('button', { name: 'Cấu hình' }).click();
  await expect(page.getByRole('heading', { name: 'Chi tiết gian hàng' })).toBeVisible();
  const rentalPrice = page.locator('#drawer-rental-price');
  await expect(rentalPrice).toHaveValue('5000000');



  await rentalPrice.fill('5500000');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu cấu hình gian A05');
  const enabledToggle = page.locator('#drawer-enabled-switch');
  await expect(enabledToggle).toBeEnabled();
  await page.locator('.org-booth-switch-control label').click();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu cấu hình gian A05');
  await expect(rentalPrice).toHaveValue('5500000');
  await page.locator('.org-booth-switch-control label').click();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu cấu hình gian A05');
  await expect(enabledToggle).toBeChecked();
  await rentalPrice.fill('0');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu cấu hình gian A05');
  await expect(rentalPrice).toHaveValue('0');
  await rentalPrice.fill('5500000');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu cấu hình gian A05');
  expect(getConfigurationRequests()).toEqual([
    { rentalPrice: 5_500_000, enabled: true },
    { rentalPrice: 5_500_000, enabled: false },
    { rentalPrice: 5_500_000, enabled: true },
    { rentalPrice: 0, enabled: true },
    { rentalPrice: 5_500_000, enabled: true },
  ]);
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();

  await page.getByRole('button', { name: 'Yêu cầu gian hàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Yêu cầu (cho thuê )?gian hàng theo sự kiện/ })).toBeVisible();
  await expect(page.getByLabel('Sự kiện đang duyệt')).toHaveValue('101');
  await expect(page.getByRole('button', { name: 'Thêm gian hàng mới' })).toHaveCount(0);
  await expect(page.getByText('NXB Demo')).toBeVisible();
  await page.getByRole('button', { name: 'Duyệt & Cấp giữ chỗ' }).click();
  const approveDialog = page.getByRole('dialog', { name: 'Xác nhận duyệt yêu cầu' });
  await expect(approveDialog).toContainText('NXB Demo');
  await expect(approveDialog).toContainText('A05');
  await approveDialog.getByRole('button', { name: 'Xác nhận duyệt' }).click();
  await expect(page.getByText('Đã chọn / Giữ chỗ', { exact: true })).toBeVisible();
  await expect(page.getByText(/5.500.000/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Gian hàng', exact: true }).click();
  await page.getByRole('button', { name: 'Sơ đồ Không gian Đường Sách' }).click();
  const persistedMarker = page.getByRole('button', { name: /B01.*Đang hoạt động/ });
  await expect(persistedMarker).toBeVisible();
  const savedBoothPosition = getSavedBoothPosition();
  expect(savedBoothPosition).not.toBeNull();
  await expect(persistedMarker).toHaveAttribute(
    'style',
    new RegExp(`left: ${savedBoothPosition!.mapX}%; top: ${savedBoothPosition!.mapY}%`),
  );
});

test('Organizer event selector keeps the selected event in the URL and after reload', async ({ page }) => {
  await mockOrganizer(page, { multipleEvents: true });
  await page.goto('/organizer/booth-requests?eventId=101');

  const eventSelector = page.getByLabel('Sự kiện đang duyệt');
  await expect(eventSelector).toHaveValue('101');
  await eventSelector.selectOption('102');

  await expect(page).toHaveURL(/\/organizer\/booth-requests\?eventId=102$/);
  await expect(eventSelector).toHaveValue('102');
  await expect(page.getByText('NXB Mùa xuân')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Sự kiện đang duyệt')).toHaveValue('102');
  await expect(page.getByText('NXB Mùa xuân')).toBeVisible();
});

test('Partner opens booth details as a viewport overlay on a direct map visit', async ({ page }) => {
  await mockPartner(page);
  await page.goto('/partner/booth-requests');
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: /B02.*Còn trống/ }).click();
    const backdrop = page.locator('.booth-modal-backdrop');
    await expect(backdrop).toHaveCSS('position', 'fixed');
    const box = await backdrop.boundingBox();
    expect(box!.x).toBe(0);
    expect(box!.y).toBe(0);
    // A stable scrollbar gutter can reserve up to 20px beside the overlay.
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 20);
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.height).toBe(viewport.height);
    const modal = page.locator('.s2-booth-request-modal');
    await expect(modal).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(modal.getByRole('heading', { name: 'Gian văn học' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Gửi yêu cầu thuê gian' })).toBeVisible();
    const modalBox = await modal.boundingBox();
    expect(modalBox!.x).toBeGreaterThanOrEqual(0);
    expect(modalBox!.x + modalBox!.width).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press('Escape');
    await expect(backdrop).toHaveCount(0);
    await page.getByRole('button', { name: /A05.*Đang giữ chỗ/ }).click();
    await expect(page.locator('.s2-booth-request-modal')).toContainText('Gian hàng hiện đang giữ chỗ.');
    await expect(page.locator('.s2-booth-request-modal').getByRole('button', { name: 'Gửi yêu cầu thuê gian' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});

test('Approved Partner browses an AVAILABLE Booth and submits a PENDING request', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPartner(page);
  await page.goto('/partner/booth-requests');
  await expect(page.getByRole('heading', { name: 'Chọn và thuê gian hàng' })).toBeVisible();
  // Eyebrow removed in workspace title consolidation
  const eventPicker = page.getByLabel('Sự kiện tham gia');
  await expect(eventPicker).toHaveValue('101');
  await page.screenshot({ path: test.info().outputPath('partner-booth-event-context.png'), fullPage: true });
  await eventPicker.selectOption('102');
  await expect(page.getByRole('button', { name: /C09.*Còn trống/ })).toBeVisible();
  await page.waitForTimeout(450);
  await expect(page.getByRole('button', { name: /A05|B02/ })).toHaveCount(0);
  await eventPicker.selectOption('101');
  await expect(page.getByRole('button', { name: /B02.*Còn trống/ })).toBeVisible();
  const summary = page.getByRole('region', { name: 'Thống kê gian hàng của sự kiện' });
  const enabledSummary = summary.locator('article').filter({ hasText: 'Gian hàng được mở' });
  await expect(enabledSummary.locator('strong')).toHaveText('2');
  await expect(enabledSummary).toContainText('Đã cấu hình cho thuê trong sự kiện');
  await expect(summary).toContainText('1');
  await expect(summary).toContainText('Gian hàng còn trống');
  await expect(summary).toContainText('Yêu cầu đã gửi');
  await expect(page.getByRole('img', { name: 'Bản đồ minh họa Đường Sách Nguyễn Văn Bình' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: /Sơ đồ gian hàng/ })).toContainText('Còn trống (1)');
  await expect(page.getByRole('tab', { name: /Sơ đồ gian hàng/ })).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByRole('tab', { name: /Yêu cầu của tôi/ }).click();
  await expect(page.getByRole('tab', { name: /Yêu cầu của tôi/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Yêu cầu thuê gian hàng' })).toBeVisible();
  const selectedRequestCard = page.locator('.s2-request-card').filter({ hasText: 'Gian A05' });
  await expect(selectedRequestCard.locator('.s2-partner-request-status')).toHaveText('Đã được chọn');
  await expect(page.getByText('Thời gian còn lại')).toBeVisible();
  await expect(page.getByTestId('booth-payment-checkout-card')).toBeVisible();
  await expect(selectedRequestCard.getByRole('heading', { name: 'Gian A05' })).toBeVisible();
  await expect(selectedRequestCard.getByRole('region', { name: 'Tiến trình xử lý yêu cầu' })).toContainText('Đã gửi');
  await expect(selectedRequestCard.getByRole('region', { name: 'Tiến trình xử lý yêu cầu' })).toContainText('Đã được chọn');
  await expect(selectedRequestCard.getByRole('region', { name: 'Tiến trình xử lý yêu cầu' })).toContainText('Chờ thanh toán');
  await expect(selectedRequestCard).toContainText('5.000.000');
  await expect(selectedRequestCard).toHaveCSS('border-radius', '0px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: test.info().outputPath('partner-booth-requests-redesign.png'), fullPage: true });
  await selectedRequestCard.screenshot({ path: test.info().outputPath('partner-booth-request-card-mobile.png') });
  await page.getByRole('tab', { name: /Sơ đồ gian hàng/ }).click();
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
  await page.getByRole('button', { name: 'Gửi yêu cầu thuê gian' }).click();
  await expect(page.getByRole('status')).toContainText('Đã gửi yêu cầu');
  await expect(page.getByText('Chờ duyệt')).toBeVisible();
  await expect(page.getByText('Gian B02')).toBeVisible();
  const pendingRequest = page.locator('.s2-request-card').filter({ hasText: 'Gian B02' });
  await pendingRequest.getByRole('button', { name: 'Rút yêu cầu', exact: true }).click();
  const withdrawDialog = page.getByRole('dialog', { name: 'Xác nhận rút yêu cầu gian hàng' });
  await expect(withdrawDialog).toContainText('không thể hoàn tác');
  await withdrawDialog.getByRole('button', { name: 'Giữ yêu cầu' }).click();
  await expect(withdrawDialog).toHaveCount(0);
  await pendingRequest.getByRole('button', { name: 'Rút yêu cầu', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận rút yêu cầu' }).click();
  await expect(page.getByRole('status')).toContainText('Đã rút yêu cầu gian hàng');

  await page.goto('/partner/booths');
  await expect(page).toHaveURL(/\/partner\/booths$/);
  await expect(page.getByRole('heading', { name: 'Gian hàng của tôi' })).toBeVisible();
  await page.goto('/partner/booths/select');
  await expect(page).toHaveURL(/\/partner\/booth-requests(?:\?eventId=\d+)?$/);
  await expect(page.getByRole('heading', { name: 'Chọn và thuê gian hàng' })).toBeVisible();
});

test('Partner defaults to the newest approved Event and can search by Event name', async ({ page }) => {
  await mockPartner(page, { emptyEventFirst: true });
  await page.goto('/partner/booth-requests');

  const eventPicker = page.getByLabel('Sự kiện tham gia');
  await expect(eventPicker).toHaveValue('102');
  await page.getByRole('tab', { name: /Yêu cầu của tôi/ }).click();
  await expect(page.getByText('Sự kiện này chưa có yêu cầu thuê gian hàng')).toBeVisible();

  await page.getByLabel('Tìm sự kiện').fill('ngay hoi sach');
  await expect(eventPicker.locator('option')).toHaveCount(1);
  await eventPicker.selectOption('101');
  await expect(eventPicker).toHaveValue('101');
  await expect(page.getByRole('heading', { name: 'Gian A05' })).toBeVisible();
});

test('Partner refresh reloads newly approved Event applications', async ({ page }) => {
  await mockPartner(page, { refreshAddsApplication: true });
  await page.goto('/partner/booth-requests');

  const eventPicker = page.getByLabel('Sự kiện tham gia');
  await expect(eventPicker.locator('option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(eventPicker.locator('option')).toHaveCount(2);
  await expect(eventPicker.locator('option', { hasText: 'Hội sách Mùa xuân' })).toHaveCount(1);
});

test('Partner sees a Vietnamese Booth request deadline message', async ({ page }) => {
  await mockPartner(page, { requestDeadlinePassed: true });
  await page.goto('/partner/booth-requests');

  await page.getByRole('button', { name: /B02.*Còn trống/ }).click();
  await page.getByLabel('Ghi chú gửi Ban tổ chức').fill('Ưu tiên trưng bày sách văn học.');
  await page.getByRole('button', { name: 'Gửi yêu cầu thuê gian' }).click();

  await expect(page.getByRole('alert')).toContainText('Đã hết hạn gửi yêu cầu thuê gian hàng cho sự kiện này.');
  await expect(page.getByText('The Booth request deadline has passed.')).toHaveCount(0);
});

test('Partner request cards expose truthful workflow progress for every terminal branch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPartner(page, { workflowStates: true });
  await page.goto('/partner/booth-requests');
  await page.getByRole('tab', { name: /Yêu cầu của tôi/ }).click();

  const requestCard = (id: number) => page.locator('.s2-request-card').filter({ hasText: `#${id}` });
  const pending = requestCard(81);
  await expect(pending.locator('.s2-partner-request-status')).toHaveText('Chờ duyệt');
  await expect(pending.getByRole('listitem', { name: 'Chờ xét duyệt: Bước hiện tại' })).toBeVisible();
  await expect(pending.getByRole('listitem', { name: 'Thanh toán: Chưa diễn ra' })).toBeVisible();
  await expect(pending.getByRole('button', { name: 'Rút yêu cầu', exact: true })).toBeVisible();
  expect((await pending.boundingBox())!.height).toBeLessThan(310);

  const withdrawn = requestCard(82);
  await expect(withdrawn.getByRole('listitem', { name: 'Đã rút yêu cầu: Đã kết thúc' })).toBeVisible();
  await expect(withdrawn.getByText('Thanh toán', { exact: true })).toHaveCount(0);
  await expect(withdrawn.getByRole('button', { name: 'Rút yêu cầu', exact: true })).toHaveCount(0);

  const rejected = requestCard(83);
  await expect(rejected.getByRole('listitem', { name: 'Đã từ chối: Đã kết thúc' })).toBeVisible();
  await expect(rejected).toContainText('Vị trí này không phù hợp với danh mục đăng ký.');

  const selected = requestCard(80);
  await expect(selected.getByRole('listitem', { name: 'Chờ thanh toán: Bước hiện tại' })).toBeVisible();
  await expect(selected.getByTestId('booth-payment-checkout-card')).toBeVisible();

  const expired = requestCard(84);
  await expect(expired.getByRole('listitem', { name: 'Hết hạn thanh toán: Đã kết thúc' })).toBeVisible();
  await expect(expired).toContainText('Hạn thanh toán ban đầu');

  const completed = requestCard(85);
  await expect(completed.getByRole('listitem', { name: 'Đã thanh toán: Đã hoàn thành' })).toBeVisible();
  await expect(completed.getByRole('listitem', { name: 'Đã cấp gian: Đã hoàn thành' })).toBeVisible();
  await expect(completed).toContainText('5.000.000');
  await expect(completed.getByText('Đã hoàn thành', { exact: true })).toHaveCount(0);
  const completedTrack = await completed.locator('.s2-partner-request-progress li').evaluateAll(items => items.map(item => {
    const marker = item.querySelector('.s2-partner-request-step-marker')!.getBoundingClientRect();
    const connector = getComputedStyle(item, '::after');
    return {
      markerCenterX: marker.left + marker.width / 2,
      markerCenterY: marker.top + marker.height / 2,
      connectorWidth: Number.parseFloat(connector.width),
      connectorColor: connector.backgroundColor,
    };
  }));
  expect(Math.max(...completedTrack.map(step => step.markerCenterY)) - Math.min(...completedTrack.map(step => step.markerCenterY))).toBeLessThan(1);
  for (let index = 0; index < completedTrack.length - 1; index += 1) {
    expect(Math.abs(completedTrack[index].connectorWidth - (completedTrack[index + 1].markerCenterX - completedTrack[index].markerCenterX))).toBeLessThan(2);
    expect(completedTrack[index].connectorColor).toBe('rgb(43, 138, 103)');
  }

  const missingTimestamp = requestCard(86);
  await expect(missingTimestamp.getByRole('listitem', { name: 'Không được chọn: Đã kết thúc' })).toBeVisible();
  await expect(missingTimestamp.getByText('—', { exact: true })).toHaveCount(0);

  const cancelled = requestCard(87);
  await expect(cancelled.locator('.s2-partner-request-status')).toHaveText('Sự kiện đã hủy');
  await expect(cancelled.getByRole('listitem', { name: 'Dừng do sự kiện hủy: Đã kết thúc' })).toBeVisible();

  const freeCompleted = requestCard(88);
  await expect(freeCompleted.getByRole('listitem', { name: 'Đã xác nhận miễn phí: Đã hoàn thành' })).toBeVisible();
  await expect(freeCompleted.getByText('Đã thanh toán', { exact: true })).toHaveCount(0);

  const pendingConnectorColors = await pending.locator('.s2-partner-request-progress li').evaluateAll(items =>
    items.slice(0, -1).map(item => getComputedStyle(item, '::after').backgroundColor),
  );
  expect(pendingConnectorColors).toEqual(['rgb(43, 138, 103)', 'rgb(206, 216, 211)', 'rgb(206, 216, 211)']);

  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await expect(pending.getByRole('listitem', { name: 'Cấp gian hàng: Chưa diễn ra' })).toBeVisible();
  const mobileTrack = await pending.locator('.s2-partner-request-progress li').evaluateAll(items => items.map(item => {
    const marker = item.querySelector('.s2-partner-request-step-marker')!.getBoundingClientRect();
    const connector = getComputedStyle(item, '::after');
    return {
      markerCenterX: marker.left + marker.width / 2,
      markerTop: marker.top,
      markerBottom: marker.bottom,
      connectorHeight: Number.parseFloat(connector.height),
    };
  }));
  expect(Math.max(...mobileTrack.map(step => step.markerCenterX)) - Math.min(...mobileTrack.map(step => step.markerCenterX))).toBeLessThan(1);
  for (let index = 0; index < mobileTrack.length - 1; index += 1) {
    expect(Math.abs(mobileTrack[index].connectorHeight - (mobileTrack[index + 1].markerTop - mobileTrack[index].markerBottom))).toBeLessThan(2);
  }
});

test('Partner booth selection controls stay usable at the target responsive widths', async ({ page }) => {
  await mockPartner(page);
  await page.goto('/partner/booth-requests');
  await expect(page.getByLabel('Sự kiện tham gia')).toHaveValue('101');
  await page.getByRole('tab', { name: /Yêu cầu của tôi/ }).click();

  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: width <= 768 ? 900 : 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await expect(page.getByRole('heading', { name: 'Chọn và thuê gian hàng' })).toBeVisible();
    await expect(page.getByLabel('Sự kiện tham gia')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Thống kê gian hàng của sự kiện' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Sơ đồ gian hàng/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Yêu cầu của tôi/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gian A05' })).toBeVisible();
    if (width === 1440) {
      await page.locator('.s2-request-card').filter({ hasText: 'Gian A05' })
        .screenshot({ path: test.info().outputPath('partner-booth-request-card-desktop.png') });
    }
  }
});

test('Selected Partner request can be withdrawn and releases its active Hold', async ({ page }) => {
  await mockPartner(page);
  await page.goto('/partner/booth-requests');
  await page.getByRole('tab', { name: /Yêu cầu của tôi/ }).click();

  const selectedRequest = page.locator('.s2-request-card').filter({ hasText: 'Gian A05' });
  await expect(selectedRequest.locator('.s2-partner-request-status')).toHaveText('Đã được chọn');
  await selectedRequest.getByRole('button', { name: 'Rút & giải phóng' }).click();

  const releaseDialog = page.getByRole('dialog', { name: 'Xác nhận giải phóng gian hàng' });
  await expect(releaseDialog).toContainText('giải phóng giữ chỗ ngay');
  await releaseDialog.getByRole('button', { name: 'Rút và giải phóng' }).click();

  await expect(page.getByRole('status')).toContainText('Đã rút yêu cầu và giải phóng giữ chỗ');
  await expect(selectedRequest.locator('.s2-partner-request-status')).toHaveText('Đã rút');
  await expect(selectedRequest.getByText('Đã giải phóng', { exact: true })).toBeVisible();
  await expect(selectedRequest.getByRole('button', { name: 'Rút & giải phóng' })).toHaveCount(0);
});

test('Selected withdrawal payment blocker is explained in a dedicated modal', async ({ page }) => {
  await mockPartner(page, { selectedWithdrawalError: 'PAYMENT_ATTEMPT_ALREADY_PENDING' });
  await page.goto('/partner/booth-requests');
  await page.getByRole('tab', { name: /Yêu cầu của tôi/ }).click();

  const selectedRequest = page.locator('.s2-request-card').filter({ hasText: 'Gian A05' });
  await selectedRequest.getByRole('button', { name: 'Rút & giải phóng' }).click();
  await page.getByRole('dialog', { name: 'Xác nhận giải phóng gian hàng' })
    .getByRole('button', { name: 'Rút và giải phóng' }).click();

  const blockerDialog = page.getByRole('dialog', { name: 'Phiên thanh toán vẫn đang mở' });
  await expect(blockerDialog).toContainText('phiên thanh toán còn hiệu lực');
  await expect(blockerDialog.getByRole('link', { name: 'Xem chi tiết thanh toán' }))
    .toHaveAttribute('href', '/partner/booth-requests/80/payment');
  await expect(page.getByText('Raw backend payment blocker message.')).toHaveCount(0);
});

test('Partner sees a dedicated modal after reaching the Event Booth quota', async ({ page }) => {
  await mockPartner(page, { quotaExceeded: true });
  await page.goto('/partner/booth-requests');
  await page.getByRole('button', { name: /B02.*Còn trống/ }).click();
  await page.getByLabel('Ghi chú gửi Ban tổ chức').fill('Ưu tiên trưng bày sách văn học.');
  await page.getByRole('button', { name: 'Gửi yêu cầu thuê gian' }).click();

  const quotaDialog = page.getByRole('dialog', { name: 'Đã đạt giới hạn gian hàng' });
  await expect(quotaDialog).toBeVisible();
  await expect(quotaDialog).toContainText('đã đạt số gian hàng tối đa');
  await expect(quotaDialog).toContainText('Ngày hội Sách Sprint 2');
  await expect(page.getByText("The Partner has reached this Event's Booth quota.")).toHaveCount(0);
  await quotaDialog.getByRole('button', { name: 'Xem yêu cầu của tôi' }).click();
  await expect(quotaDialog).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Yêu cầu của tôi/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.s2-partner-request-status')).toHaveText('Đã được chọn');
});

test('Public Event card synchronizes Booths and Map context with valid coordinates', async ({ page }) => {
  const emptySourceWarnings: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('empty string')) {
      emptySourceWarnings.push(message.text());
    }
  });
  await mockPublicMap(page);
  await page.goto('/');
  await expect(page.getByLabel(`Sự kiện đang xem: ${event.name}`).first()).toBeVisible();
  await expect(page.getByLabel('Sự kiện công khai')).toHaveCount(0);
  const marker = page.getByRole('button', { name: /A05.*Còn trống/ });
  await expect(marker).toBeVisible();
  await expect(page.getByRole('button', { name: /C03/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /D04/ })).toHaveCount(0);
  await marker.click();
  await expect(page.getByLabel('Thông tin gian hàng theo sự kiện')).toContainText('5.000.000');
  await expect(page.getByLabel('Thông tin gian hàng theo sự kiện')).toContainText('Còn trống');
  await expect(page.getByRole('button', { name: /Gửi yêu cầu gian hàng/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sự kiện tiếp theo' }).click();
  await expect(page).toHaveURL(/\?eventId=102$/);
  await expect(page.getByLabel('Sự kiện đang xem: Sự kiện chưa định vị').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /A05/ })).toHaveCount(0);
  await expect(page.getByText('Sự kiện này chưa có gian hàng hoặc địa điểm với đủ tọa độ để hiển thị trên bản đồ.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Sự kiện đang xem: Sự kiện chưa định vị').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /A05/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sự kiện trước' }).click();
  await expect(page).toHaveURL(/\?eventId=101$/);
  await expect(marker).toBeVisible();
  await expect(page.locator('img[src=""]')).toHaveCount(0);
  expect(emptySourceWarnings).toEqual([]);

  await page.goto('/gian-hang/11?eventId=101');
  await expect(page.getByRole('dialog')).toContainText(physicalBooth.name);
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText(physicalBooth.name);
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(page).toHaveURL(/\/gian-hang\?eventId=101$/);

  await page.goto('/su-kien/101');
  await expect(page.getByRole('dialog')).toContainText(event.name);
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText(event.name);

  await page.goto('/gian-hang/khong-ton-tai?eventId=101');
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy gian hàng');
  await expect(page).toHaveURL(/\/gian-hang\/khong-ton-tai\?eventId=101$/);
  await page.goto('/su-kien/khong-ton-tai');
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy sự kiện');
  await expect(page).toHaveURL(/\/su-kien\/khong-ton-tai$/);
});
