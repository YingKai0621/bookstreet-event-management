import { expect, type Page, type Route, test } from '@playwright/test';
import type { OrganizerLocationResponse, PartnerActivityProposalResponse, PartnerActivityResponse } from '../../src/types/activity';

const event = {
  eventId: 501,
  name: 'Ngày hội Văn hóa đọc 2027',
  description: 'Sự kiện kiểm thử Partner Sprint 5.',
  startAt: '2027-03-20T02:00:00Z',
  endAt: '2027-03-21T10:00:00Z',
  partnerApplicationDeadlineAt: '2027-03-01T10:00:00Z',
  bannerUrl: null,
  status: 'PUBLISHED',
};

const application = {
  applicationId: 31,
  eventId: 501,
  partnerOrganizationId: 9,
  status: 'APPROVED',
  applicationNote: 'Đơn vị xuất bản và văn hóa đọc.',
  reviewNote: 'Hồ sơ hợp lệ.',
  submittedAt: '2026-10-18T01:00:00Z',
  reviewedAt: '2026-10-18T02:00:00Z',
  withdrawnAt: null,
};

const location: OrganizerLocationResponse = {
  locationId: 41,
  code: 'STAGE-A',
  name: 'Sân khấu trung tâm',
  locationType: 'STAGE',
  description: 'Sân khấu chính.',
  maxCapacity: 120,
  mapX: 35,
  mapY: 42,
  active: true,
  boothAssignmentId: null,
  eligible: true,
  ineligibleReason: null,
};

const proposal: PartnerActivityProposalResponse = {
  activityProposalId: 81,
  eventId: 501,
  eventName: event.name,
  partnerOrganizationId: 9,
  partnerOrganizationName: 'NXB Demo',
  partnerOrganizationStatus: 'ACTIVE',
  location,
  title: 'Workshop làm sách thủ công',
  description: 'Cùng độc giả tự làm một cuốn sách nhỏ.',
  activityType: 'Workshop',
  proposedStartAt: '2027-03-20T05:00:00Z',
  proposedEndAt: '2027-03-20T06:00:00Z',
  capacity: 40,
  status: 'PENDING',
  reviewNote: null,
  submittedAt: '2026-10-18T03:00:00Z',
  updatedAt: '2026-10-18T03:00:00Z',
  reviewedAt: null,
  withdrawnAt: null,
  cancelledAt: null,
  activityId: null,
};

const activity: PartnerActivityResponse = {
  activityId: 71,
  eventId: 501,
  sourceProposalId: 81,
  partnerOrganizationId: 9,
  location,
  title: 'Giao lưu tác giả trẻ',
  description: 'Giao lưu và ký tặng sách.',
  activityType: 'Tọa đàm',
  startAt: '2027-03-20T07:00:00Z',
  endAt: '2027-03-20T08:00:00Z',
  capacity: 100,
  imageUrl: null,
  registrationRequired: false,
  registrationDeadlineAt: null,
  certificateEnabled: false,
  attendanceEarlyScanMinutes: 15,
  attendanceQrAvailable: false,
  attendanceQrToken: null,
  status: 'PUBLISHED',
  createdAt: '2026-10-18T04:00:00Z',
  updatedAt: '2026-10-18T04:00:00Z',
  publishedAt: '2026-10-18T04:00:00Z',
  completedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  cancellationSource: null,
};

function pageOf(content: unknown[], size = 8) {
  return { content, page: 0, size, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page, overrides: {
  proposal?: Partial<typeof proposal>;
  activity?: Partial<typeof activity>;
} = {}) {
  const servedProposal = { ...proposal, ...overrides.proposal };
  const servedActivity = { ...activity, ...overrides.activity };
  const state = {
    proposalPayload: null as Record<string, unknown> | null,
    locationQueries: [] as string[],
    withdraws: 0,
    changePayload: null as Record<string, unknown> | null,
  };
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path.endsWith('/auth/me')) return json(route, { userId: 2, username: 'partner', fullName: 'Partner Demo', email: 'partner@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'PARTNER'] });
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' });
    if (path.endsWith('/partner/organization')) return json(route, { partnerOrganizationId: 9, name: 'NXB Demo', description: '', categoryCode: 'PUBLISHER', logoUrl: null, contactEmail: 'partner@example.com', contactPhone: null, address: null, status: 'ACTIVE' });
    if (path.endsWith('/partner/applications')) return json(route, pageOf([application], 100));
    if (path.endsWith('/partner/booth-requests')) return json(route, pageOf([], 100));
    if (path.endsWith('/events/501')) return json(route, event);
    if (path.endsWith('/events')) return json(route, pageOf([event], 100));
    if (path.endsWith('/heritages')) return json(route, []);
    if (path.endsWith('/partner/events/501/activity-locations')) {
      state.locationQueries.push(url.search);
      return json(route, [location]);
    }
    if (path.endsWith('/partner/activity-proposals') && method === 'GET') return json(route, pageOf([servedProposal]));
    if (path.endsWith('/partner/activity-proposals/81') && method === 'GET') return json(route, servedProposal);
    if (path.endsWith('/partner/activity-proposals') && method === 'POST') {
      expect(request.headers()['x-csrf-token']).toBe('test-csrf');
      state.proposalPayload = request.postDataJSON();
      return json(route, { ...servedProposal, activityProposalId: 82, ...state.proposalPayload }, 201);
    }
    if (path.endsWith('/partner/activity-proposals/81/withdraw')) {
      state.withdraws += 1;
      return json(route, { ...servedProposal, status: 'WITHDRAWN' });
    }
    if (path.endsWith('/partner/activities') && method === 'GET') return json(route, pageOf([servedActivity]));
    if (path.endsWith('/partner/activities/71') && method === 'GET') return json(route, servedActivity);
    if (path.endsWith('/partner/activities/71/revisions')) return json(route, pageOf([]));
    if (path.endsWith('/partner/activities/71/change-requests') && method === 'POST') {
      state.changePayload = request.postDataJSON();
      return json(route, { activityChangeRequestId: 91, activityId: 71, status: 'PENDING', ...state.changePayload }, 201);
    }
    if (path.endsWith('/partner/activity-change-requests')) return json(route, pageOf([{ activityChangeRequestId: 91, activityId: 71, status: 'PENDING', reason: 'Cần đổi tên để phù hợp nội dung.', requestedTitle: 'Tên hoạt động mới', requestedDescriptionIncluded: false, requestedDescription: null, requestedActivityType: null, requestedLocationId: null, requestedStartAt: null, requestedEndAt: null, requestedCapacity: null, requestedImageUrlIncluded: false, requestedImageUrl: null, reviewNote: null, submittedAt: '2026-10-18T05:00:00Z', handledAt: null, withdrawnAt: null, cancelledAt: null }]));
    if (path.endsWith('/partner/activity-cancellation-requests')) return json(route, pageOf([{ activityCancellationRequestId: 92, activityId: 71, status: 'PENDING', reason: 'Diễn giả không thể tham dự chương trình.', late: true, reviewNote: null, submittedAt: '2026-10-18T06:00:00Z', handledAt: null, withdrawnAt: null, cancelledAt: null }]));
    return json(route, { code: 'TEST_ROUTE_NOT_MOCKED', message: `${method} ${path}` }, 404);
  });
  return state;
}

test('Partner Sprint 5 workspace loads the real event location and submits the exact proposal contract', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/partner/activities?eventId=501');
  await expect(page.getByRole('heading', { name: 'Quản lý hoạt động' })).toBeVisible();
  await expect(page.getByText('Workshop làm sách thủ công', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Đề xuất hoạt động', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Đề xuất hoạt động mới' });
  await expect(dialog.getByLabel('Địa điểm *')).toContainText('Sân khấu trung tâm');
  await expect(dialog.getByLabel('Bắt đầu *')).toHaveAttribute('min', /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  await dialog.getByLabel('Bắt đầu *').fill('2020-01-01T09:00');
  await expect(dialog.getByLabel('Bắt đầu *')).toHaveJSProperty('validity.rangeUnderflow', true);
  await dialog.getByLabel('Tên hoạt động *').fill('Ngày đọc sách gia đình');
  await dialog.getByLabel('Loại hoạt động *').fill('Tọa đàm');
  await dialog.getByLabel('Địa điểm *').selectOption('41');
  await dialog.getByLabel('Bắt đầu *').fill('2027-03-20T14:00');
  await dialog.getByLabel('Kết thúc *').fill('2027-03-20T15:30');
  await expect(dialog.locator('.day-first-date-label').filter({ hasText: '20/03/2027 14:00' })).toBeVisible();
  await expect(dialog.locator('.day-first-date-label').filter({ hasText: '20/03/2027 15:30' })).toBeVisible();
  await dialog.getByLabel('Sức chứa *').fill('80');
  await dialog.getByLabel('Mô tả').fill('Giao lưu về thói quen đọc sách trong gia đình.');
  await dialog.getByRole('button', { name: 'Gửi đề xuất' }).click();

  await expect(page.getByRole('status')).toContainText('Đã gửi đề xuất hoạt động');
  expect(state.proposalPayload).toEqual({
    eventId: 501,
    locationId: 41,
    title: 'Ngày đọc sách gia đình',
    description: 'Giao lưu về thói quen đọc sách trong gia đình.',
    activityType: 'Tọa đàm',
    proposedStartAt: '2027-03-20T07:00:00.000Z',
    proposedEndAt: '2027-03-20T08:30:00.000Z',
    capacity: 80,
  });
  expect(state.locationQueries.some(query => query.includes('startAt=') && query.includes('endAt='))).toBeTruthy();
});

test('Partner navigates all Sprint 5 queues and uses controlled actions only', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/partner/activities?eventId=501');

  await page.getByRole('button', { name: /Hoạt động chính thức/ }).click();
  await expect(page.getByText('Giao lưu tác giả trẻ', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  const activityDialog = page.getByRole('dialog', { name: /Hoạt động #71 · Giao lưu tác giả trẻ/ });
  await expect(activityDialog.getByRole('button', { name: 'Yêu cầu thay đổi' })).toBeVisible();
  await expect(activityDialog.getByText(/Điểm danh|QR tham dự/i)).toHaveCount(0);
  await activityDialog.getByRole('button', { name: 'Yêu cầu thay đổi' }).click();
  await activityDialog.getByLabel('Trường cần đổi').selectOption('schedule');
  await expect(activityDialog.getByLabel('Bắt đầu mới')).toHaveAttribute('min', /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  await activityDialog.getByLabel('Bắt đầu mới').fill('2020-01-01T09:00');
  await activityDialog.getByLabel('Kết thúc mới').fill('2020-01-01T10:00');
  await activityDialog.getByLabel('Lý do *').fill('Kiểm tra không cho đổi lịch về quá khứ.');
  await activityDialog.getByRole('button', { name: 'Gửi yêu cầu' }).click();
  await expect(activityDialog.getByRole('alert')).toContainText('Thời gian bắt đầu mới phải ở tương lai');
  await activityDialog.getByLabel('Trường cần đổi').selectOption('title');
  await activityDialog.getByLabel('Nội dung mới').fill('Giao lưu tác giả Việt trẻ');
  await activityDialog.getByLabel('Lý do *').fill('Điều chỉnh tên để phản ánh đúng nội dung.');
  await activityDialog.getByRole('button', { name: 'Gửi yêu cầu' }).click();
  await expect(page.getByRole('status')).toContainText('Đã gửi yêu cầu thay đổi');
  expect(state.changePayload).toMatchObject({ requestedTitle: 'Giao lưu tác giả Việt trẻ' });

  await page.getByRole('button', { name: /Yêu cầu thay đổi/ }).click();
  await expect(page.getByText('Cần đổi tên để phù hợp nội dung.')).toBeVisible();
  await page.getByRole('button', { name: /Yêu cầu hủy/ }).click();
  await expect(page.getByText('Diễn giả không thể tham dự chương trình.')).toBeVisible();
  await expect(page.getByText('Trễ hạn', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Đề xuất của tôi/ }).click();
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Rút đề xuất' }).click();
  await expect(page.getByRole('status')).toContainText('Đã rút hồ sơ');
  expect(state.withdraws).toBe(1);
});

test('Approved proposal shows the current state of its cancelled official activity', async ({ page }) => {
  await setup(page, {
    proposal: {
      status: 'APPROVED',
      activityId: 71,
      title: activity.title,
      reviewedAt: '2026-10-18T04:00:00Z',
    },
    activity: {
      status: 'CANCELLED',
      cancelledAt: '2026-10-18T07:00:00Z',
      cancellationReason: 'Ban tổ chức điều chỉnh lịch chương trình.',
      cancellationSource: 'ORGANIZER',
    },
  });
  await page.goto('/partner/activities?eventId=501');

  const proposalCard = page.getByRole('article');
  await expect(proposalCard.getByText('Hoạt động liên kết hiện đã bị hủy', { exact: true })).toBeVisible();
  await expect(proposalCard.getByText('Đã duyệt đề xuất', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem hoạt động' }).click();

  await expect(page).toHaveURL(/view=activities/);
  const dialog = page.getByRole('dialog', { name: new RegExp(`Hoạt động #71 · ${activity.title}`) });
  await expect(dialog.getByText('Đã hủy', { exact: true })).toBeVisible();
});

test('Partner activity workspace and proposal dialog stay inside a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto('/partner/activities?eventId=501');
  await expect(page.getByRole('heading', { name: 'Quản lý hoạt động' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Đề xuất hoạt động', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Đề xuất hoạt động mới' });
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
