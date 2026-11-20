import { expect, test, type Page, type Route } from '@playwright/test';

const participant = {
  userId: 42,
  username: 'participantdemo',
  fullName: 'Bạn đọc Demo',
  email: 'reader@example.test',
  emailVerified: true,
  status: 'ACTIVE',
  roles: ['PARTICIPANT'],
};

const eventRegistrations = [
  {
    eventRegistrationId: 301,
    event: {
      eventId: 746,
      name: 'Ngày hội sách mùa xuân',
      startAt: '2027-01-11T02:00:00Z',
      endAt: '2027-01-12T10:00:00Z',
      status: 'PUBLISHED',
    },
    status: 'ACTIVE',
    seatActiveActivityCount: 1,
  },
  {
    eventRegistrationId: 302,
    event: {
      eventId: 900,
      name: 'Sự kiện không liên quan',
      startAt: '2027-02-01T02:00:00Z',
      endAt: '2027-02-01T10:00:00Z',
      status: 'PUBLISHED',
    },
    status: 'ACTIVE',
    seatActiveActivityCount: 1,
  },
];

const activityRegistrations = [
  {
    activityRegistrationId: 401,
    activity: {
      activityId: 91,
      eventId: 746,
      title: 'Giao lưu tác giả trẻ',
      locationCode: 'STAGE-A',
      locationName: 'Sân khấu trung tâm',
      startAt: '2027-01-11T03:00:00Z',
      endAt: '2027-01-11T04:00:00Z',
      status: 'PUBLISHED',
    },
    status: 'ACTIVE',
    outcome: 'PENDING',
    registeredAt: '2026-10-26T10:00:00Z',
    attendance: null,
  },
  {
    activityRegistrationId: 402,
    activity: {
      activityId: 92,
      eventId: 746,
      title: 'Workshop làm sách',
      locationCode: 'WORKSHOP-1',
      locationName: 'Không gian workshop',
      startAt: '2027-01-11T05:00:00Z',
      endAt: '2027-01-11T06:00:00Z',
      status: 'COMPLETED',
    },
    status: 'ACTIVE',
    outcome: 'ATTENDED',
    registeredAt: '2026-10-25T10:00:00Z',
    attendance: { status: 'VALID' },
  },
  {
    activityRegistrationId: 403,
    activity: {
      activityId: 99,
      eventId: 900,
      title: 'Hoạt động thuộc sự kiện khác',
      locationCode: 'STAGE-B',
      locationName: 'Sân khấu phụ',
      startAt: '2027-02-01T03:00:00Z',
      endAt: '2027-02-01T04:00:00Z',
      status: 'PUBLISHED',
    },
    status: 'ACTIVE',
    outcome: 'PENDING',
    registeredAt: '2026-10-24T10:00:00Z',
    attendance: null,
  },
];

const publicActivities = [
  {
    activityId: 91,
    eventId: 746,
    eventName: 'Ngày hội sách mùa xuân',
    location: { locationId: 1, code: 'STAGE-A', name: 'Sân khấu trung tâm', locationType: 'STAGE' },
    title: 'Giao lưu tác giả trẻ',
    description: 'Trò chuyện và giao lưu cùng tác giả.',
    activityType: 'TALK_SHOW',
    startAt: '2027-01-11T03:00:00Z',
    endAt: '2027-01-11T04:00:00Z',
    capacity: 100,
    imageUrl: null,
    registrationRequired: true,
    registrationOpen: true,
    registeredCount: 20,
    availableSeats: 80,
    certificateEnabled: true,
    status: 'PUBLISHED',
  },
  {
    activityId: 93,
    eventId: 746,
    eventName: 'Ngày hội sách mùa xuân',
    location: { locationId: 2, code: 'READING-A', name: 'Không gian đọc sách', locationType: 'AREA' },
    title: 'Đọc sách cùng cộng đồng',
    description: 'Hoạt động công khai chưa được tài khoản đăng ký.',
    activityType: 'COMMUNITY_READING',
    startAt: '2027-01-11T07:00:00Z',
    endAt: '2027-01-11T08:00:00Z',
    capacity: 50,
    imageUrl: null,
    registrationRequired: true,
    registrationOpen: true,
    registeredCount: 10,
    availableSeats: 40,
    certificateEnabled: false,
    status: 'PUBLISHED',
  },
];

function pageOf<T>(content: T[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockParticipantWorkflow(
  page: Page,
  options: {
    failEventRefreshAfterActivityMutation?: boolean;
    rejectActivityRegistration?: boolean;
  } = {},
) {
  let registrations = [...activityRegistrations];
  let activityMutationCompleted = false;
  const requestedPaths: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    requestedPaths.push(`${method} ${path}`);

    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf-token' });
    if (path.endsWith('/auth/me')) return json(route, participant);
    if (path.endsWith('/auth/profile')) return json(route, {
      id: participant.userId,
      fullName: participant.fullName,
      email: participant.email,
      emailVerified: true,
      phone: null,
      avatarUrl: null,
    });
    if (path === '/api/v1/participant/event-registrations') {
      if (options.failEventRefreshAfterActivityMutation && activityMutationCompleted) {
        return json(route, { code: 'TEMPORARILY_UNAVAILABLE' }, 503);
      }
      return json(route, pageOf(eventRegistrations));
    }
    if (path === '/api/v1/participant/activity-registrations') return json(route, pageOf(registrations));
    if (path === '/api/v1/participant/activities/93/register' && method === 'POST') {
      if (options.rejectActivityRegistration) {
        return json(route, {
          code: 'ACTIVITY_CAPACITY_FULL',
          message: 'Hoạt động đã hết chỗ.',
          fieldErrors: [],
          path,
        }, 409);
      }
      registrations = [...registrations, {
        activityRegistrationId: 404,
        activity: {
          activityId: 93,
          eventId: 746,
          title: 'Đọc sách cùng cộng đồng',
          locationCode: 'READING-A',
          locationName: 'Không gian đọc sách',
          startAt: '2027-01-11T07:00:00Z',
          endAt: '2027-01-11T08:00:00Z',
          status: 'PUBLISHED',
        },
        status: 'ACTIVE',
        outcome: 'PENDING',
        registeredAt: '2026-10-26T11:00:00Z',
        attendance: null,
      }];
      activityMutationCompleted = true;
      return json(route, registrations.at(-1), 201);
    }
    if (path === '/api/v1/participant/activities/91/register' && method === 'POST') {
      registrations = registrations.map(registration => registration.activity.activityId === 91
        ? {
            ...registration,
            status: 'ACTIVE',
            outcome: 'PENDING',
            cancellationSource: null,
            cancelledAt: null,
          }
        : registration);
      activityMutationCompleted = true;
      return json(route, registrations.find(registration => registration.activity.activityId === 91));
    }
    if (path === '/api/v1/participant/activities/91/cancel-registration' && method === 'POST') {
      registrations = registrations.map(registration => registration.activity.activityId === 91
        ? {
            ...registration,
            status: 'CANCELLED',
            outcome: 'CANCELLED_BY_PARTICIPANT',
            cancellationSource: 'PARTICIPANT',
            cancelledAt: '2026-10-26T12:00:00Z',
          }
        : registration);
      activityMutationCompleted = true;
      return json(route, registrations.find(registration => registration.activity.activityId === 91));
    }
    if (path === '/api/v1/activities') return json(route, pageOf(publicActivities));
    if (path === '/api/v1/participant/certificates' || path === '/api/v1/participant/badges') {
      return json(route, { code: 'DEPENDENCY_UNAVAILABLE' }, 503);
    }
    if (path === '/api/v1/participant/notifications') return json(route, pageOf([]));
    if (path === '/api/v1/participant/notifications/unread-count') return json(route, { unreadCount: 0 });
    return json(route, []);
  });
  return requestedPaths;
}

test('event detail survives a direct refresh and shows only registrations from that event', async ({ page }) => {
  const requestedPaths = await mockParticipantWorkflow(page);

  await page.goto('/participant/events/746');
  await expect(page.getByText('11/01/2027 09:00 – 12/01/2027 17:00', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ngày hội sách mùa xuân' })).toBeVisible();
  await page.getByRole('button', { name: 'Hoạt động sự kiện (2)' }).click();
  await expect(page.getByRole('heading', { name: 'Đọc sách cùng cộng đồng' })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng ký hoạt động' }).evaluate(button => {
    (button as HTMLElement).click();
    (button as HTMLElement).click();
  });
  await expect(page.getByRole('link', { name: 'Xem đăng ký' }).last()).toBeVisible();

  await page.getByRole('button', { name: 'Đã đăng ký (3)' }).click();

  await expect(page.getByRole('heading', { name: 'Giao lưu tác giả trẻ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workshop làm sách' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đọc sách cùng cộng đồng' })).toBeVisible();
  await expect(page.getByText('Hoạt động thuộc sự kiện khác')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ngày hội sách mùa xuân' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Giao lưu tác giả trẻ' })).toBeVisible();
  expect(requestedPaths.filter(path => path === 'POST /api/v1/participant/activities/93/register')).toHaveLength(1);
  expect(requestedPaths.filter(path => path.includes('/participant/certificates'))).toHaveLength(0);
  expect(requestedPaths.filter(path => path.includes('/participant/badges'))).toHaveLength(0);
});

test('successful registration remains successful when the follow-up event refresh fails', async ({ page }) => {
  const requestedPaths = await mockParticipantWorkflow(page, {
    failEventRefreshAfterActivityMutation: true,
  });

  await page.goto('/participant/events/746?section=discover');
  await page.getByRole('button', { name: 'Đăng ký hoạt động' }).click();

  await expect(page.getByRole('link', { name: 'Xem đăng ký' }).last()).toBeVisible();
  await expect(page.getByText('Không thể đăng ký hoạt động.')).toHaveCount(0);
  expect(requestedPaths.filter(path => path === 'POST /api/v1/participant/activities/93/register')).toHaveLength(1);
});

test('a rejected activity registration keeps the catalog unregistered and shows the backend reason', async ({ page }) => {
  const requestedPaths = await mockParticipantWorkflow(page, {
    rejectActivityRegistration: true,
  });

  await page.goto('/participant/events/746?section=discover');
  await page.getByRole('button', { name: 'Đăng ký hoạt động' }).click();

  await expect(page.getByRole('alert')).toContainText('Hoạt động đã hết chỗ.');
  await expect(page.getByRole('button', { name: 'Đăng ký hoạt động' })).toBeVisible();
  expect(requestedPaths.filter(path => path === 'POST /api/v1/participant/activities/93/register')).toHaveLength(1);
});

test('activity cancellation uses the mutation response without unrelated participant APIs', async ({ page }) => {
  const requestedPaths = await mockParticipantWorkflow(page);
  page.on('dialog', dialog => dialog.accept());

  await page.goto('/participant/activities/detail/91');
  await page.getByRole('button', { name: 'Hủy đăng ký' }).click();

  await expect(page.getByText('Đã hủy đăng ký', { exact: true })).toBeVisible();
  expect(requestedPaths.filter(path => path === 'POST /api/v1/participant/activities/91/cancel-registration')).toHaveLength(1);
  expect(requestedPaths.filter(path => path.includes('/participant/certificates'))).toHaveLength(0);
  expect(requestedPaths.filter(path => path.includes('/participant/badges'))).toHaveLength(0);
});

test('participant can cancel and re-register the same activity registration', async ({ page }) => {
  const requestedPaths = await mockParticipantWorkflow(page);
  page.on('dialog', dialog => dialog.accept());

  await page.goto('/participant/events/746?section=activities');
  const registeredActivity = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'Giao lưu tác giả trẻ' }),
  });
  await registeredActivity.getByRole('button', { name: 'Hủy đăng ký' }).click();
  await expect(registeredActivity.getByText('Đã hủy đăng ký', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Hoạt động sự kiện (2)' }).click();
  const catalogActivity = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'Giao lưu tác giả trẻ' }),
  });
  await catalogActivity.getByRole('button', { name: 'Đăng ký hoạt động' }).click();
  await expect(catalogActivity.getByRole('link', { name: 'Xem đăng ký' })).toBeVisible();

  expect(requestedPaths.filter(path => path === 'POST /api/v1/participant/activities/91/cancel-registration')).toHaveLength(1);
  expect(requestedPaths.filter(path => path === 'POST /api/v1/participant/activities/91/register')).toHaveLength(1);
});

test('the overview calendar shows ISO-dated activity registrations and updates after cancellation', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-10T03:00:00Z'));
  await mockParticipantWorkflow(page);
  await page.goto('/participant');
  const entry = page.locator('.participant-calendar-entry[data-calendar-id="activity-91"]');
  await expect(entry).toHaveAttribute('data-registered', 'true');
  await expect(entry).toContainText('Đã đăng ký');
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/participant/activities/detail/91');
  await page.getByRole('button', { name: 'Hủy đăng ký' }).click();
  await expect(page.getByText('Đã hủy đăng ký', { exact: true })).toBeVisible();
  await page.goto('/participant');
  await expect(entry).toHaveAttribute('data-registered', 'false');
  await expect(entry).toContainText('Chưa đăng ký');
});

test('activity detail requires an exact registration and reports attendance honestly', async ({ page }) => {
  await mockParticipantWorkflow(page);

  await page.goto('/participant/activities/detail/92');
  await expect(page.getByRole('heading', { name: 'Workshop làm sách' })).toBeVisible();
  await expect(page.getByText('Đã ghi nhận hợp lệ')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem chứng nhận' })).toBeVisible();

  await page.goto('/participant/activities/detail/999999');
  await expect(page.getByText('Không tìm thấy đăng ký hoạt động')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Giao lưu tác giả trẻ' })).toHaveCount(0);
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`registered activities remain readable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockParticipantWorkflow(page);

    await page.goto('/participant/events/746?section=discover');
    await expect(page.getByRole('heading', { name: 'Giao lưu tác giả trẻ' })).toBeVisible();

    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  });
}
