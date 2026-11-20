import { expect, test, type Page, type Route } from '@playwright/test';

const event = {
  eventId: 501, organizerUserId: 1, name: 'Ngày hội Văn hóa đọc 2027', description: 'Sự kiện kiểm thử.',
  startAt: '2027-03-20T02:00:00Z', endAt: '2027-03-21T10:00:00Z', status: 'PUBLISHED',
  partnerApplicationDeadlineAt: '2027-03-01T10:00:00Z', boothRequestDeadlineAt: '2027-03-05T10:00:00Z',
  activityProposalDeadlineAt: '2027-03-08T10:00:00Z', participantRegistrationDeadlineAt: '2027-03-18T10:00:00Z',
  partnerWithdrawalCutoffAt: '2027-03-10T10:00:00Z', boothCancellationCutoffAt: '2027-03-10T10:00:00Z',
  activityCancellationCutoffAt: '2027-03-10T10:00:00Z', boothPaymentWindowMinutes: 1440,
  maxBoothsPerPartner: 2, maxActivitiesPerPartner: 3, bannerUrl: null,
  createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z',
};

const activity = {
  activityId: 71, eventId: 501, sourceProposalId: null, partnerOrganizationId: null,
  location: { locationId: 41, code: 'STAGE-A', name: 'Sân khấu trung tâm', locationType: 'STAGE', maxCapacity: 120, active: true },
  title: 'Giao lưu tác giả trẻ', description: 'Giao lưu và ký tặng sách.', activityType: 'TALK_SHOW',
  startAt: '2027-03-20T03:00:00Z', endAt: '2027-03-20T04:00:00Z', capacity: 100, imageUrl: null,
  registrationRequired: true, registrationDeadlineAt: '2027-03-19T10:00:00Z', certificateEnabled: true,
  attendanceEarlyScanMinutes: 10, attendanceQrAvailable: true, attendanceQrToken: 'not-rendered-by-participant-screen',
  status: 'PUBLISHED', createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z',
  publishedAt: '2026-10-18T00:00:00Z', completedAt: null, cancelledAt: null, cancellationReason: null, cancellationSource: null,
};

const eventRegistration = {
  eventRegistrationId: 301, eventId: 501, participant: { userId: 42, displayName: 'Nguyễn Minh Anh' }, status: 'ACTIVE',
  registeredAt: '2027-03-01T01:00:00Z', activatedAt: '2027-03-01T01:00:00Z', leftAt: null, updatedAt: '2027-03-01T01:00:00Z',
  seatActiveActivityCount: 1, activityRegistrationCount: 1, attendedActivityCount: 1, noShowActivityCount: 0,
};

const attendance = {
  attendanceId: 501, status: 'VALID', recordedSource: 'SELF_SCAN', attendedAt: '2027-03-20T03:10:00Z',
  createdAt: '2027-03-20T03:10:00Z', updatedAt: '2027-03-20T03:10:00Z', voidedAt: null,
};

const participation = {
  activityRegistrationId: 401, eventRegistrationId: 301, eventId: 501, activityId: 71,
  participant: eventRegistration.participant, registrationStatus: 'ACTIVE', cancellationSource: null, outcome: 'ATTENDED',
  registeredAt: '2027-03-01T01:05:00Z', activatedAt: '2027-03-01T01:05:00Z', cancelledAt: null, noShowAt: null,
  attendance, certificate: { certificateId: 601, certificateCode: 'CERT-2027-001', recipientName: 'Nguyễn Minh Anh', status: 'ISSUED', issuedAt: '2027-03-20T04:10:00Z', revokedAt: null, downloadAvailable: true },
  ratingStatus: 'ACTIVE', latestAdjustmentAt: '2027-03-20T03:12:00Z',
};

const priorAdjustment = {
  attendanceAdjustmentId: 701, activityRegistrationId: 401, actor: { userId: 1, displayName: 'Demo Organizer' },
  idempotencyKey: 'prior-key', previousState: { registrationStatus: 'ACTIVE', cancellationSource: null, attendanceStatus: null, attendedAt: null, derivedDisplayOutcome: 'ACTIVE' },
  newState: { registrationStatus: 'ACTIVE', cancellationSource: null, attendanceStatus: 'VALID', attendedAt: attendance.attendedAt, derivedDisplayOutcome: 'ATTENDED' },
  effectiveAttendedAt: attendance.attendedAt, reason: 'Xác minh từ danh sách tại cổng.', adjustedAt: '2027-03-20T03:12:00Z',
};

function pageOf<T>(content: T[]) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockOrganizerParticipation(page: Page, failFirstCorrection = false, eventRows = () => [eventRegistration]) {
  const correctionKeys: string[] = [];
  const correctionBodies: unknown[] = [];
  const requestedUrls: string[] = [];
  let correctionCount = 0;

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    requestedUrls.push(request.url());

    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path.endsWith('/auth/me')) return json(route, { userId: 1, username: 'organizer', fullName: 'Demo Organizer', email: 'organizer@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'ORGANIZER'] });
    if (path.endsWith('/organizer/events') && method === 'GET') return json(route, pageOf([event]));
    if (path.endsWith('/organizer/activities') && method === 'GET') return json(route, pageOf([activity]));
    if (path.endsWith('/organizer/events/501/event-registrations')) return json(route, pageOf(eventRows()));
    if (path.endsWith('/organizer/activities/71/registrations')) return json(route, pageOf([participation]));
    if (path.endsWith('/organizer/activity-registrations/401/attendance-adjustments') && method === 'GET') return json(route, pageOf([priorAdjustment]));
    if (path.endsWith('/organizer/activity-registrations/401/attendance-adjustments') && method === 'POST') {
      correctionCount += 1;
      correctionKeys.push(request.headers()['idempotency-key']);
      correctionBodies.push(request.postDataJSON());
      if (failFirstCorrection && correctionCount === 1) return json(route, { code: 'TEMPORARY_FAILURE', message: 'Tạm thời chưa lưu được.' }, 500);
      return json(route, {
        participation: { activityRegistrationId: 401, registrationStatus: 'ACTIVE', cancellationSource: null, outcome: 'ATTENDED' },
        attendance: { ...attendance, recordedSource: 'ORGANIZER_CORRECTION' }, adjustment: priorAdjustment,
        certificate: { certificateId: 601, status: 'ISSUED' }, ratingStatus: 'ACTIVE', idempotentReplay: false,
      });
    }
    if (path.endsWith('/organizer/activity-registrations/401')) return json(route, participation);
    return json(route, pageOf([]));
  });

  return { correctionKeys, correctionBodies, requestedUrls, correctionCount: () => correctionCount };
}

async function openCorrectionForm(page: Page) {
  await page.getByRole('tab', { name: 'Đăng ký hoạt động' }).click();
  await expect(page).toHaveURL(/view=activity/);
  await expect(page.getByText('Nguyễn Minh Anh').first()).toBeVisible();
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page.getByRole('heading', { name: 'Nguyễn Minh Anh' })).toBeVisible();
  await expect(page.getByText('Xác minh từ danh sách tại cổng.')).toBeVisible();
  await page.getByRole('button', { name: 'Điều chỉnh điểm danh' }).click();
  await page.getByLabel('Trạng thái sau điều chỉnh').selectOption('VALID');
  await page.getByLabel('Thời điểm tham gia').fill('2027-03-20T10:15');
  await page.getByLabel('Lý do điều chỉnh').fill('Xác minh trực tiếp từ biên bản tại cổng vào.');
  await page.getByText('Tôi xác nhận thay đổi này là chính xác').click();
}

test('Organizer sees newly recorded registrations on cross-tab changes and when returning to the screen', async ({ page }) => {
  let registered = false;
  await mockOrganizerParticipation(page, false, () => registered ? [eventRegistration] : []);
  await page.goto('/organizer/participants?eventId=501');
  await expect(page.getByText('Chưa có người tham gia', { exact: true })).toBeVisible();
  registered = true;
  await page.evaluate(() => {
    const publisher = new BroadcastChannel('bookstreet:participation');
    publisher.postMessage({ type: 'changed', sender: 'external-test-tab' });
    publisher.close();
  });
  await expect(page.getByText('Nguyễn Minh Anh', { exact: true })).toBeVisible();
  registered = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Chưa có người tham gia', { exact: true })).toBeVisible();
});

test('organizer browses event and activity registrations without legacy endpoints', async ({ page }) => {
  const state = await mockOrganizerParticipation(page);
  await page.goto('/organizer/participants?eventId=501');

  await expect(page.getByRole('heading', { name: 'Người tham gia' })).toBeVisible();
  await expect(page.getByText('Nguyễn Minh Anh')).toBeVisible();
  await expect(page.getByText('1 bản ghi theo bộ lọc hiện tại')).toBeVisible();
  const requestCountAtIdle = state.requestedUrls.length;
  await page.waitForTimeout(1_100);
  expect(state.requestedUrls).toHaveLength(requestCountAtIdle);

  await openCorrectionForm(page);
  await page.getByRole('button', { name: 'Xác nhận điều chỉnh' }).click();
  await expect(page.getByText('Đã lưu điều chỉnh điểm danh và lịch sử kiểm toán.')).toBeVisible();

  expect(state.correctionKeys).toHaveLength(1);
  expect(state.correctionKeys[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(state.correctionBodies[0]).toEqual({
    targetAttendanceStatus: 'VALID', effectiveAttendedAt: '2027-03-20T03:15:00.000Z',
    reason: 'Xác minh trực tiếp từ biên bản tại cổng vào.',
  });
  expect(state.requestedUrls.some(url => url.includes('/organizer/participants'))).toBe(false);
  expect(state.requestedUrls.some(url => url.includes('/organizer/checkin'))).toBe(false);
  expect(state.requestedUrls.some(url => url.includes('/organizer/events/501/event-registrations') && url.includes('page=0') && url.includes('size=20'))).toBe(true);
  expect(state.requestedUrls.some(url => url.includes('/organizer/activities/71/registrations') && url.includes('page=0') && url.includes('size=20'))).toBe(true);
});

test('correction retry reuses the same idempotency key', async ({ page }) => {
  const state = await mockOrganizerParticipation(page, true);
  await page.goto('/organizer/participants?eventId=501&view=activity&activityId=71');
  await openCorrectionForm(page);

  await page.getByRole('button', { name: 'Xác nhận điều chỉnh' }).click();
  await expect(page.getByText('Tạm thời chưa lưu được.')).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận điều chỉnh' }).click();
  await expect(page.getByText('Đã lưu điều chỉnh điểm danh và lịch sử kiểm toán.')).toBeVisible();

  expect(state.correctionCount()).toBe(2);
  expect(state.correctionKeys[0]).toBe(state.correctionKeys[1]);
  expect(state.correctionBodies[0]).toEqual(state.correctionBodies[1]);
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`participant management remains usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockOrganizerParticipation(page);
    await page.goto('/organizer/participants?eventId=501&view=activity&activityId=71');
    await expect(page.getByRole('heading', { name: 'Người tham gia' })).toBeVisible();
    await page.getByRole('button', { name: 'Xem chi tiết' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const box = await page.getByRole('dialog').boundingBox();
    expect(box).not.toBeNull();
    // Animated transforms can report fractional pixel rounding (e.g. 390.000004).
    expect(box!.width).toBeLessThanOrEqual(viewport.width + 1);
  });
}
