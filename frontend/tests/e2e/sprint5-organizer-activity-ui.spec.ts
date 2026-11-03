import { expect, Page, Route, test } from '@playwright/test';

const event = {
  eventId: 501,
  organizerUserId: 1,
  name: 'Ngày hội Văn hóa đọc 2027',
  description: 'Sự kiện kiểm thử Sprint 5.',
  startAt: '2027-03-20T02:00:00Z',
  endAt: '2027-03-21T10:00:00Z',
  partnerApplicationDeadlineAt: '2027-03-01T10:00:00Z',
  boothRequestDeadlineAt: '2027-03-05T10:00:00Z',
  activityProposalDeadlineAt: '2027-03-08T10:00:00Z',
  participantRegistrationDeadlineAt: '2027-03-18T10:00:00Z',
  partnerWithdrawalCutoffAt: '2027-03-10T10:00:00Z',
  boothCancellationCutoffAt: '2027-03-10T10:00:00Z',
  activityCancellationCutoffAt: '2027-03-10T10:00:00Z',
  boothPaymentWindowMinutes: 1440,
  maxBoothsPerPartner: 2,
  maxActivitiesPerPartner: 3,
  bannerUrl: null,
  status: 'PUBLISHED',
  createdAt: '2026-10-18T00:00:00Z',
  updatedAt: '2026-10-18T00:00:00Z',
};

const location = {
  locationId: 41,
  code: 'STAGE-A',
  name: 'Sân khấu trung tâm',
  locationType: 'STAGE',
  description: 'Không gian sân khấu chính.',
  maxCapacity: 120,
  mapX: 35,
  mapY: 42,
  active: true,
  boothAssignmentId: null,
  eligible: true,
  ineligibleReason: null,
};

const activity = {
  activityId: 71,
  eventId: 501,
  sourceProposalId: null,
  partnerOrganizationId: null,
  location,
  title: 'Giao lưu tác giả trẻ',
  description: 'Giao lưu và ký tặng sách.',
  activityType: 'TALK_SHOW',
  startAt: '2027-03-20T03:00:00Z',
  endAt: '2027-03-20T04:00:00Z',
  capacity: 100,
  imageUrl: null,
  registrationRequired: true,
  registrationDeadlineAt: '2027-03-19T10:00:00Z',
  certificateEnabled: false,
  attendanceQrAvailable: false,
  attendanceQrToken: null,
  status: 'PUBLISHED',
  createdAt: '2026-10-18T00:00:00Z',
  updatedAt: '2026-10-18T00:00:00Z',
  publishedAt: '2026-10-18T00:00:00Z',
  completedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  cancellationSource: null,
};

const requestActivity = {
  activityId: activity.activityId,
  eventId: event.eventId,
  eventName: event.name,
  partnerOrganizationId: 91,
  partnerOrganizationName: 'NXB Trẻ',
  location,
  title: activity.title,
  description: activity.description,
  activityType: activity.activityType,
  startAt: activity.startAt,
  endAt: activity.endAt,
  capacity: activity.capacity,
  imageUrl: null,
  status: 'PUBLISHED',
};

const proposal = {
  activityProposalId: 81,
  eventId: event.eventId,
  eventName: event.name,
  partnerOrganizationId: 91,
  partnerOrganizationName: 'NXB Trẻ',
  location,
  title: 'Workshop làm sách thủ công',
  description: 'Đề xuất hoạt động từ đối tác.',
  activityType: 'WORKSHOP',
  proposedStartAt: '2027-03-20T05:00:00Z',
  proposedEndAt: '2027-03-20T06:00:00Z',
  capacity: 40,
  status: 'PENDING',
  reviewNote: null,
  submittedAt: '2026-10-18T01:00:00Z',
  updatedAt: '2026-10-18T01:00:00Z',
  reviewedAt: null,
  withdrawnAt: null,
  cancelledAt: null,
  activityId: null,
};

const changeRequest = {
  activityChangeRequestId: 82,
  activityId: activity.activityId,
  status: 'PENDING',
  reason: 'Đổi giờ để phù hợp với diễn giả.',
  reviewNote: null,
  submittedAt: '2026-10-18T02:00:00Z',
  handledAt: null,
  withdrawnAt: null,
  cancelledAt: null,
  activity: requestActivity,
  requestedTitle: null,
  requestedDescriptionIncluded: false,
  requestedDescription: null,
  requestedActivityType: null,
  requestedLocationId: null,
  requestedLocation: null,
  requestedStartAt: '2027-03-20T04:00:00Z',
  requestedEndAt: '2027-03-20T05:00:00Z',
  requestedCapacity: null,
  requestedImageUrlIncluded: true,
  requestedImageUrl: 'https://cdn.example.com/new.jpg',
};

const cancellationRequest = {
  activityCancellationRequestId: 83,
  activityId: activity.activityId,
  status: 'PENDING',
  reason: 'Diễn giả không thể tham dự.',
  reviewNote: null,
  submittedAt: '2026-10-18T03:00:00Z',
  handledAt: null,
  withdrawnAt: null,
  cancelledAt: null,
  activity: requestActivity,
  late: true,
};

function pageOf<T>(content: T[]) {
  return { content, page: 0, size: 8, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockOrganizerSprint5(page: Page, locationCount = 1) {
  let locations = Array.from({ length: locationCount }, (_, index) => ({ ...location,
    locationId: location.locationId + index,
    code: index === 0 ? location.code : `STAGE-${index + 1}`,
    name: index === 0 ? location.name : `Sân khấu ${index + 1}`,
  }));
  let activities = [activity];
  let createdLocationPayload: Record<string, unknown> | null = null;
  let createdActivityPayload: Record<string, unknown> | null = null;
  let updatedActivityPayload: Record<string, unknown> | null = null;
  let updatedLocationPayload: Record<string, unknown> | null = null;
  const actions: string[] = [];

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path.endsWith('/auth/me')) return json(route, {
      userId: 1,
      username: 'organizer',
      fullName: 'Demo Organizer',
      email: 'organizer@example.com',
      emailVerified: true,
      status: 'ACTIVE',
      roles: ['PARTICIPANT', 'ORGANIZER'],
    });
    if (path.endsWith('/organizer/events') && method === 'GET') {
      return json(route, { content: [event], page: 0, size: 100, totalElements: 1, totalPages: 1 });
    }
    if (path.endsWith('/organizer/events/501/booth-configs')) return json(route, []);
    if (path.endsWith('/organizer/booths') && method === 'GET') return json(route, pageOf([]));
    if (path.endsWith('/organizer/events/501/booth-requests')) return json(route, pageOf([]));
    if (path.endsWith('/organizer/events/501/applications')) {
      return json(route, { content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 });
    }
    if (path.endsWith('/organizer/activities') && method === 'GET') return json(route, pageOf(activities));
    if (path.endsWith('/organizer/activities') && method === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      createdActivityPayload = payload;
      const created = {
        ...activity,
        ...payload,
        activityId: 72,
        sourceProposalId: null,
        partnerOrganizationId: null,
        location,
        status: 'DRAFT',
        registrationDeadlineAt: typeof payload.registrationDeadlineAt === 'string'
          ? payload.registrationDeadlineAt
          : null,
        createdAt: '2026-10-18T05:00:00Z',
        updatedAt: '2026-10-18T05:00:00Z',
        publishedAt: null,
      } as unknown as typeof activity;
      activities = [created];
      return json(route, created, 201);
    }
    if (path.endsWith('/organizer/activities/71/revisions')) return json(route, pageOf([{
      activityRevisionId: 301,
      activityId: 71,
      actorUserId: 1,
      sourceRequestId: null,
      revisionSource: 'ORGANIZER_DIRECT',
      changeReason: 'Cập nhật nội dung chương trình.',
      oldSnapshot: { imageUrl: null },
      newSnapshot: { imageUrl: 'https://cdn.example.com/activity.jpg' },
      changedAt: '2026-10-18T04:00:00Z',
    }]));
    if (path.endsWith('/organizer/activities/71') && method === 'GET') return json(route, {
      ...activity,
      attendanceQrAvailable: true,
      attendanceQrToken: 'organizer-owned-attendance-token',
    });
    if (path.endsWith('/organizer/activities/71') && method === 'PATCH') {
      updatedActivityPayload = request.postDataJSON();
      return json(route, { ...activity, ...updatedActivityPayload, updatedAt: '2026-10-18T05:00:00Z' });
    }
    if (path.endsWith('/organizer/activities/71/publish') && method === 'POST') {
      actions.push('publish-activity');
      return json(route, { ...activity, status: 'PUBLISHED' });
    }
    if (path.endsWith('/organizer/activities/71/cancel') && method === 'POST') {
      actions.push('cancel-activity');
      return json(route, { ...activity, status: 'CANCELLED' });
    }
    if (path.endsWith('/organizer/activities/72/revisions')) return json(route, pageOf([]));
    if (path.endsWith('/organizer/activities/72') && method === 'GET') return json(route, activities[0]);
    if (path.endsWith('/organizer/activities/72/publish') && method === 'POST') {
      actions.push('publish-activity');
      activities = [{ ...activities[0], status: 'PUBLISHED', publishedAt: '2026-10-18T06:00:00Z' }];
      return json(route, activities[0]);
    }
    if (path.endsWith('/organizer/activities/72/cancel') && method === 'POST') {
      actions.push('cancel-activity');
      activities = [{ ...activities[0], status: 'CANCELLED', cancellationReason: request.postDataJSON().reason }];
      return json(route, activities[0]);
    }
    if (path.endsWith('/organizer/activity-proposals')) {
      return json(route, pageOf([proposal]));
    }
    if (path.endsWith('/organizer/activity-proposals/81') && method === 'GET') {
      return json(route, proposal);
    }
    if (path.endsWith('/organizer/activity-proposals/81/approve') && method === 'POST') {
      actions.push('approve-proposal');
      return json(route, { proposal: { activityProposalId: 81, status: 'APPROVED' }, activity });
    }
    if (path.endsWith('/organizer/activity-change-requests')) {
      return json(route, pageOf([changeRequest]));
    }
    if (path.endsWith('/organizer/activity-change-requests/82') && method === 'GET') return json(route, changeRequest);
    if (path.endsWith('/organizer/activity-change-requests/82/approve') && method === 'POST') {
      actions.push('approve-change');
      return json(route, { ...changeRequest, status: 'APPROVED', handledAt: '2026-10-18T05:00:00Z' });
    }
    if (path.endsWith('/organizer/activity-cancellation-requests')) {
      return json(route, pageOf([cancellationRequest]));
    }
    if (path.endsWith('/organizer/activity-cancellation-requests/83') && method === 'GET') return json(route, cancellationRequest);
    if (path.endsWith('/organizer/activity-cancellation-requests/83/reject') && method === 'POST') {
      actions.push('reject-cancellation');
      return json(route, { ...cancellationRequest, status: 'REJECTED', reviewNote: request.postDataJSON().reviewNote });
    }
    if (/\/organizer\/locations\/\d+$/.test(path) && method === 'PATCH') {
      const locationId = Number(path.split('/').pop());
      updatedLocationPayload = request.postDataJSON();
      locations = locations.map(item => item.locationId === locationId ? { ...item, ...updatedLocationPayload } as typeof location : item);
      return json(route, locations.find(item => item.locationId === locationId));
    }
    if (path.endsWith('/organizer/locations') && method === 'GET') {
      const query = new URL(request.url()).searchParams;
      const pageIndex = Number(query.get('page') || 0);
      const size = Number(query.get('size') || 10);
      const filtered = locations.filter(item => (!query.get('search') || item.name.includes(query.get('search')!))
        && (!query.get('type') || item.locationType === query.get('type'))
        && (!query.has('active') || item.active === (query.get('active') === 'true')))
        .sort((left, right) => left.code.localeCompare(right.code));
      return json(route, { content: filtered.slice(pageIndex * size, (pageIndex + 1) * size),
        page: pageIndex, size, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size) });
    }
    if (path.endsWith('/organizer/locations') && method === 'POST') {
      createdLocationPayload = request.postDataJSON();
      const created = {
        ...createdLocationPayload,
        locationId: Math.max(...locations.map(item => item.locationId)) + 1,
        active: true,
        boothAssignmentId: null,
        eligible: true,
        ineligibleReason: null,
      };
      locations = [...locations, created as typeof location];
      return json(route, created, 201);
    }

    return json(route, { code: 'TEST_ROUTE_NOT_MOCKED', message: `${method} ${path}` }, 404);
  });

  return {
    getCreatedLocationPayload: () => createdLocationPayload,
    getCreatedActivityPayload: () => createdActivityPayload,
    getUpdatedActivityPayload: () => updatedActivityPayload,
    getUpdatedLocationPayload: () => updatedLocationPayload,
    getActions: () => actions,
  };
}

test('Organizer reviews every Sprint 5 activity queue without exposing technical errors', async ({ page }) => {
  await mockOrganizerSprint5(page);
  await page.goto('/portal');

  await page.getByRole('button', { name: 'Hoạt động', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quản lý hoạt động' })).toBeVisible();
  await expect(page.getByText('Giao lưu tác giả trẻ', { exact: true })).toBeVisible();
  await expect(page.getByText(/JDBC|lower\(bytea\)|executing SQL/i)).toHaveCount(0);

  await page.getByRole('button', { name: /Đề xuất từ đối tác/ }).click();
  await expect(page.getByText('Workshop làm sách thủ công', { exact: true })).toBeVisible();
  await expect(page.getByText('NXB Trẻ', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Yêu cầu thay đổi/ }).click();
  await expect(page.getByText('Đổi giờ để phù hợp với diễn giả.')).toBeVisible();

  await page.getByRole('button', { name: /Yêu cầu hủy/ }).click();
  await expect(page.getByText('Diễn giả không thể tham dự.')).toBeVisible();
  await expect(page.getByText('Trễ hạn', { exact: true })).toBeVisible();
});

test('Organizer opens authoritative detail, edits Activity and reads revision history', async ({ page }) => {
  const state = await mockOrganizerSprint5(page);
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Hoạt động', exact: true }).click();
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();

  const detail = page.getByRole('dialog', { name: activity.title });
  await expect(detail.getByText('Có yêu cầu đăng ký')).toBeVisible();
  await expect(detail.getByText('Cập nhật nội dung chương trình.')).toBeVisible();
  await detail.getByRole('button', { name: 'Chỉnh sửa' }).click();

  const edit = page.getByRole('dialog', { name: `Chỉnh sửa “${activity.title}”` });
  await expect(edit.getByLabel('URL hình ảnh')).toHaveCount(0);
  await edit.getByLabel('Sức chứa').fill('101');
  await edit.getByLabel(/Lý do thay đổi/).fill('Điều chỉnh sức chứa theo kế hoạch đã duyệt.');
  await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();

  await expect(page.getByText(`Đã cập nhật hoạt động “${activity.title}”.`)).toBeVisible();
  expect(state.getUpdatedActivityPayload()).toMatchObject({
    capacity: 101,
    changeReason: 'Điều chỉnh sức chứa theo kế hoạch đã duyệt.',
  });
});

test('Organizer displays and downloads the locally rendered attendance QR from protected detail', async ({ page }) => {
  await mockOrganizerSprint5(page);
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Hoạt động', exact: true }).click();
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();

  const detail = page.getByRole('dialog', { name: activity.title });
  await expect(detail.getByText('QR điểm danh của hoạt động')).toBeVisible();
  await detail.getByRole('button', { name: 'Hiển thị mã QR' }).click();

  const qr = detail.locator('.oaw-attendance-qr-code svg');
  await expect(qr).toBeVisible();
  await expect(detail).not.toContainText('organizer-owned-attendance-token');

  const downloadPromise = page.waitForEvent('download');
  await detail.getByRole('button', { name: 'Tải QR dạng SVG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`activity-${activity.activityId}-attendance-qr.svg`);
});

test('Organizer creates, publishes and cancels a direct Activity in separate guarded steps', async ({ page }) => {
  const state = await mockOrganizerSprint5(page);
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Hoạt động', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo hoạt động' }).click();

  const create = page.getByRole('dialog', { name: 'Hoạt động mới' });
  await create.getByLabel(/Tên hoạt động/).fill('Tọa đàm văn hóa đọc');
  await create.getByLabel(/Loại hoạt động/).fill('TALK_SHOW');
  await create.getByLabel(/Địa điểm/).selectOption('41');
  await create.getByLabel('Bắt đầu - ngày').selectOption('2027-03-20');
  await create.getByLabel('Bắt đầu - giờ').fill('12:00');
  await create.getByLabel('Kết thúc - ngày').selectOption('2027-03-20');
  await create.getByLabel('Kết thúc - giờ').fill('13:00');
  await create.getByLabel(/Sức chứa/).fill('80');
  await create.getByRole('button', { name: 'Tạo bản nháp' }).click();

  await expect(page.getByText(/Đã tạo bản nháp hoạt động/)).toBeVisible();
  expect(state.getCreatedActivityPayload()).toMatchObject({
    eventId: 501,
    locationId: 41,
    title: 'Tọa đàm văn hóa đọc',
    capacity: 80,
    registrationRequired: false,
  });

  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Công bố' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText(/Đã công bố hoạt động/)).toBeVisible();

  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy hoạt động' }).click();
  await page.getByRole('dialog').getByLabel(/Lý do/).fill('Diễn giả chính không thể tiếp tục tham gia chương trình.');
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();
  expect(state.getActions()).toEqual(expect.arrayContaining(['publish-activity', 'cancel-activity']));
});

test('Organizer reviews Proposal, Change Request and Cancellation Request via detail APIs', async ({ page }) => {
  const state = await mockOrganizerSprint5(page);
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Hoạt động', exact: true }).click();

  await page.getByRole('button', { name: /Đề xuất từ đối tác/ }).click();
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Duyệt và tạo Activity' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByRole('status')).toContainText('Đã duyệt đề xuất');

  await page.getByRole('button', { name: /Yêu cầu thay đổi/ }).click();
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page.getByRole('dialog').getByText('https://cdn.example.com/new.jpg')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Chấp nhận thay đổi' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();

  await page.getByRole('button', { name: /Yêu cầu hủy/ }).click();
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Từ chối hủy' }).click();
  await page.getByRole('dialog').getByLabel(/Lý do/).fill('Chương trình vẫn có phương án diễn giả thay thế phù hợp.');
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();

  expect(state.getActions()).toEqual(expect.arrayContaining([
    'approve-proposal',
    'approve-change',
    'reject-cancellation',
  ]));
});

test('Organizer loads and creates a shared activity location through Organizer API', async ({ page }) => {
  const state = await mockOrganizerSprint5(page);
  const longDescription = Array.from({ length: 151 }, (_, index) => `từ${index + 1}`).join(' ');
  await page.goto('/portal');

  await page.getByRole('button', { name: 'Địa điểm tổ chức', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Địa điểm tổ chức' })).toBeVisible();
  await expect(page.getByText('Sân khấu trung tâm', { exact: true })).toBeVisible();
  await expect(page.getByText('You do not have permission')).toHaveCount(0);

  await page.getByRole('button', { name: 'Thêm địa điểm', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Thêm địa điểm' });
  await dialog.getByLabel(/Mã địa điểm/).fill('workshop-b');
  await dialog.getByLabel(/Tên địa điểm/).fill('Phòng workshop B');
  await dialog.getByLabel(/Loại địa điểm/).selectOption('WORKSHOP');
  await dialog.getByLabel(/Sức chứa tối đa/).fill('45');
  await dialog.getByLabel('Mô tả').fill(longDescription);
  await expect(dialog.getByText(/\/5\.000 ký tự$/)).toBeVisible();
  await expect(dialog.getByLabel('Tọa độ X')).toHaveCount(0);
  await expect(dialog.getByLabel('Tọa độ Y')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Lưu địa điểm' }).click();

  await expect(page).toHaveURL(/\/organizer\/booths\?view=map&locationId=42/);
  const marker = page.getByRole('button', { name: /WORKSHOP-B – Phòng workshop B/ });
  await expect(marker).toBeVisible();
  await marker.scrollIntoViewIfNeeded();
  const position = await marker.boundingBox();
  if (!position) throw new Error('New location marker has no position');
  await page.mouse.move(position.x + position.width / 2, position.y + position.height / 2);
  await page.mouse.down();
  await page.mouse.move(position.x + position.width / 2 + 50, position.y + position.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Lưu sơ đồ', exact: true }).click();
  await expect.poll(() => typeof state.getUpdatedLocationPayload()?.mapX).toBe('number');
  expect(state.getUpdatedLocationPayload()?.mapX).not.toBe(50);
  expect(state.getUpdatedLocationPayload()).not.toHaveProperty('name');
  await expect(page.getByRole('status')).toContainText('Đã lưu tọa độ của 1 địa điểm.');
  const savedX = state.getUpdatedLocationPayload()?.mapX;
  await page.reload();
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS('left', /.+px/);
  const leftPercent = await marker.evaluate(element => element.style.left);
  expect(Number.parseFloat(leftPercent)).toBe(savedX);
  expect(state.getCreatedLocationPayload()).toMatchObject({
    code: 'WORKSHOP-B',
    name: 'Phòng workshop B',
    locationType: 'WORKSHOP',
    maxCapacity: 45,
    description: longDescription,
    mapX: null,
    mapY: null,
  });

  await page.goto('/organizer/venues');
  await page.getByRole('button', { name: 'Sửa Sân khấu trung tâm' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Chỉnh sửa địa điểm' });
  await editDialog.getByLabel(/Trạng thái/).selectOption('false');
  await editDialog.getByRole('button', { name: 'Lưu địa điểm' }).click();
  expect(state.getUpdatedLocationPayload()).toMatchObject({ active: false });
  expect(state.getUpdatedLocationPayload()).not.toHaveProperty('mapX');
  expect(state.getUpdatedLocationPayload()).not.toHaveProperty('mapY');
});

test('Organizer navigation is URL-driven and restores Activity views with browser history', async ({ page }) => {
  await mockOrganizerSprint5(page);
  await page.goto('/portal');

  await expect(page).toHaveURL(/\/organizer$/);
  await page.getByRole('button', { name: 'Hoạt động', exact: true }).click();
  await expect(page).toHaveURL(/\/organizer\/activities$/);
  await expect(page.getByRole('heading', { name: 'Quản lý hoạt động' })).toBeVisible();

  await page.getByRole('button', { name: /Đề xuất từ đối tác/ }).click();
  await expect(page).toHaveURL(/\/organizer\/activities\?view=proposals$/);
  await expect(page.getByText(proposal.title, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(proposal.title, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Yêu cầu gian hàng', exact: true }).click();
  await expect(page).toHaveURL(/\/organizer\/booth-requests$/);
  await expect(page).not.toHaveURL(/view=|activityView=/);

  await page.goBack();
  await expect(page).toHaveURL(/\/organizer\/activities\?view=proposals$/);
  await expect(page.getByText(proposal.title, { exact: true })).toBeVisible();
});

test('Organizer Event list and detail state survive refresh through canonical URLs', async ({ page }) => {
  await mockOrganizerSprint5(page);
  await page.goto('/organizer/events?status=PUBLISHED&search=V%C4%83n%20h%C3%B3a');

  await expect(page.getByPlaceholder('Tìm tên sự kiện...')).toHaveValue('Văn hóa');
  await expect(page.getByText(event.name, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByPlaceholder('Tìm tên sự kiện...')).toHaveValue('Văn hóa');

  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page).toHaveURL(/\/organizer\/events\/501$/);
  const partnerTab = page.locator('.org-tab-btn').filter({ hasText: 'Hồ sơ đối tác' });
  await partnerTab.click();
  await expect(page).toHaveURL(/\/organizer\/events\/501\?section=partners$/);

  await page.reload();
  await expect(page.locator('.org-tab-btn').filter({ hasText: 'Hồ sơ đối tác' })).toHaveClass(/is-active/);
});

test('Organizer location list shows ten per page and resets filters with visible page controls', async ({ page }) => {
  await mockOrganizerSprint5(page);
  const locations = Array.from({ length: 23 }, (_, index) => ({
    ...location, locationId: index + 1, code: `AREA-${String(index + 1).padStart(2, '0')}`,
    name: `Địa điểm ${String(index + 1).padStart(2, '0')}`,
  }));
  let locationLimit = 23;
  await page.route('**/api/v1/organizer/locations?**', route => {
    const query = new URL(route.request().url()).searchParams;
    const index = Number(query.get('page') || 0);
    expect(query.get('size')).toBe('10');
    const filtered = locations.slice(0, locationLimit).filter(item => item.name.includes(query.get('search') || ''));
    return json(route, { content: filtered.slice(index * 10, index * 10 + 10), page: index,
      size: 10, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / 10) });
  });
  await page.goto('/organizer/venues');
  const rows = page.locator('.venue-table tbody tr');
  const controls = page.getByRole('navigation', { name: 'pagination' });
  await expect(rows).toHaveCount(10);
  await expect(page.locator('.venue-list-heading h2')).toHaveText('Danh sách địa điểm');
  await expect(page.locator('.venue-list-heading h2 span')).toHaveCount(0);
  await expect(controls.locator('[aria-current=page]')).toHaveText('1');
  await expect(controls.getByRole('link', { name: 'Trang trước' })).toBeDisabled();
  await controls.getByRole('link', { name: 'Trang sau' }).click();
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Địa điểm 11');
  await controls.getByRole('link', { name: 'Trang sau' }).click();
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('Địa điểm 21');
  await expect(controls.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
  await controls.getByRole('link', { name: 'Trang trước' }).click();
  await expect(rows.first()).toContainText('Địa điểm 11');
  await page.getByRole('textbox', { name: 'Tìm địa điểm' }).fill('Địa điểm 23');
  await expect(rows).toHaveCount(1);
  await expect(controls.locator('[aria-current=page]')).toHaveText('1');
  await expect(controls.getByRole('link', { name: 'Trang trước' })).toBeDisabled();
  await expect(controls.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Tìm địa điểm' }).fill('Không có kết quả');
  await expect(rows).toHaveCount(0);
  await expect(controls.locator('[aria-current=page]')).toHaveText('1');
  await page.getByRole('textbox', { name: 'Tìm địa điểm' }).fill('');
  await expect(rows).toHaveCount(10);
  await controls.getByRole('link', { name: 'Trang 3', exact: true }).click();
  await expect(rows.first()).toContainText('Địa điểm 21');
  locationLimit = 3;
  await page.getByRole('button', { name: 'Tải lại danh sách' }).click();
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('Địa điểm 01');
  await expect(controls.locator('[aria-current=page]')).toHaveText('1');
  await expect(controls.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
});


test('Creating the eleventh Organizer location adds a reachable second page', async ({ page }) => {
  await mockOrganizerSprint5(page, 10);
  await page.goto('/organizer/venues');
  const rows = page.locator('.venue-table tbody tr');
  const pagination = page.getByRole('navigation', { name: 'pagination', exact: true });
  await expect(rows).toHaveCount(10);
  await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
  await page.getByRole('button', { name: 'Thêm địa điểm', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Thêm địa điểm' });
  await dialog.getByLabel(/Mã địa điểm/).fill('ZZZ-11');
  await dialog.getByLabel(/Tên địa điểm/).fill('Địa điểm thứ 11');
  await dialog.getByLabel(/Sức chứa tối đa/).fill('30');
  await dialog.getByRole('button', { name: 'Lưu địa điểm' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(rows).toHaveCount(10);
  await expect(pagination.getByRole('link', { name: 'Trang 2', exact: true })).toBeVisible();
  await pagination.getByRole('link', { name: 'Trang 2', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Địa điểm thứ 11');
  await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
});


test('Organizer event list displays the shared pagination even with a single event', async ({ page }) => {
  await mockOrganizerSprint5(page);
  await page.goto('/organizer/events');
  await expect(page.getByRole('heading', { name: 'Danh sách sự kiện' })).toBeVisible();
  await expect(page.locator('.org-event-row')).toHaveCount(1);
  const pagination = page.getByRole('navigation', { name: 'pagination', exact: true });
  await expect(pagination).toBeVisible();
  await expect(pagination.locator('[aria-current="page"]')).toHaveText('1');
  await expect(pagination.getByRole('link', { name: 'Trang trước' })).toBeDisabled();
  await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`Organizer event list uses numbered pagination with ten cards at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockOrganizerSprint5(page);
    const events = Array.from({ length: 81 }, (_, index) => ({ ...event,
      eventId: event.eventId + index, name: `Sự kiện ${String(index + 1).padStart(3, '0')}`,
    }));
    await page.route('**/api/v1/organizer/events?**', route => json(route, {
      content: events, page: 0, size: 100, totalElements: events.length, totalPages: 1,
    }));
    await page.goto('/organizer/events?sort=title_asc');
    const cards = page.locator('.org-event-row');
    const pagination = page.getByRole('navigation', { name: 'pagination', exact: true });
    await expect(cards).toHaveCount(10);
    await expect(cards.first()).toContainText('Sự kiện 001');
    await pagination.getByRole('link', { name: 'Trang 2', exact: true }).click();
    await expect(cards).toHaveCount(10);
    await expect(cards.first()).toContainText('Sự kiện 011');
    await expect(pagination.locator('[aria-current="page"]')).toHaveText('2');
    await expect(pagination.locator('.list-pagination-ellipsis')).toBeVisible();
    await expect(page).toHaveURL(/page=2/);
    await page.reload();
    await expect(cards.first()).toContainText('Sự kiện 011');
    await expect(pagination.locator('[aria-current="page"]')).toHaveText('2');
    await pagination.scrollIntoViewIfNeeded();
    const bounds = await pagination.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, viewport: window.innerWidth };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
    await page.screenshot({ path: test.info().outputPath('event-list-pagination.png'), fullPage: true });
    await pagination.getByRole('link', { name: 'Trang 9', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Sự kiện 081');
    await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
    await page.getByPlaceholder('Tìm tên sự kiện...').fill('Sự kiện 081');
    await expect(cards).toHaveCount(1);
    await expect(pagination.locator('[aria-current="page"]')).toHaveText('1');
    await expect(pagination.getByRole('link', { name: 'Trang trước' })).toBeDisabled();
    await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
  });
}
