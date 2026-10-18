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

async function mockOrganizerSprint5(page: Page) {
  let locations = [location];
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
    if (path.endsWith('/organizer/activities/71') && method === 'GET') return json(route, activity);
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
    if (path.endsWith('/organizer/locations/41') && method === 'PATCH') {
      updatedLocationPayload = request.postDataJSON();
      locations = locations.map(item => item.locationId === 41 ? { ...item, ...updatedLocationPayload } as typeof location : item);
      return json(route, locations[0]);
    }
    if (path.endsWith('/organizer/locations') && method === 'GET') return json(route, pageOf(locations));
    if (path.endsWith('/organizer/locations') && method === 'POST') {
      createdLocationPayload = request.postDataJSON();
      const created = {
        ...createdLocationPayload,
        locationId: 42,
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
  await edit.getByLabel('URL hình ảnh').fill('https://cdn.example.com/activity-updated.jpg');
  await edit.getByLabel(/Lý do thay đổi/).fill('Cập nhật hình ảnh đại diện theo nội dung đã duyệt.');
  await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();

  await expect(page.getByText(`Đã cập nhật hoạt động “${activity.title}”.`)).toBeVisible();
  expect(state.getUpdatedActivityPayload()).toMatchObject({
    imageUrl: 'https://cdn.example.com/activity-updated.jpg',
    changeReason: 'Cập nhật hình ảnh đại diện theo nội dung đã duyệt.',
  });
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
  await dialog.getByLabel('Tọa độ X').fill('20.5');
  await dialog.getByLabel('Tọa độ Y').fill('65');
  await dialog.getByRole('button', { name: 'Lưu địa điểm' }).click();

  await expect(page.getByText('Đã thêm địa điểm tổ chức mới.', { exact: true })).toBeVisible();
  expect(state.getCreatedLocationPayload()).toMatchObject({
    code: 'WORKSHOP-B',
    name: 'Phòng workshop B',
    locationType: 'WORKSHOP',
    maxCapacity: 45,
    mapX: 20.5,
    mapY: 65,
  });

  await page.getByRole('button', { name: 'Sửa Sân khấu trung tâm' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Chỉnh sửa địa điểm' });
  await editDialog.getByLabel(/Cho phép sử dụng địa điểm/).uncheck();
  await editDialog.getByRole('button', { name: 'Lưu địa điểm' }).click();
  expect(state.getUpdatedLocationPayload()).toMatchObject({ active: false });
});
