import { expect, test, type Page, type Route } from '@playwright/test';

const participant = {
  userId: 42,
  username: 'ratingreader',
  fullName: 'Độc giả Đánh giá',
  email: 'rating-reader@example.test',
  emailVerified: true,
  status: 'ACTIVE',
  roles: ['PARTICIPANT'],
};

const eventRegistration = {
  eventRegistrationId: 301,
  event: {
    eventId: 746,
    name: 'Ngày hội sách mùa xuân',
    startAt: '2026-10-20T02:00:00Z',
    endAt: '2026-10-25T10:00:00Z',
    status: 'COMPLETED',
  },
  status: 'ACTIVE',
  seatActiveActivityCount: 0,
};

interface MockRating {
  activityRatingId: number;
  activityId: number;
  score: number;
  comment: string | null;
  status: 'ACTIVE' | 'INVALIDATED';
  createdAt: string;
  updatedAt: string;
  invalidatedAt: string | null;
}

const activeRating: MockRating = {
  activityRatingId: 801,
  activityId: 92,
  score: 3,
  comment: 'Nội dung hữu ích.',
  status: 'ACTIVE',
  createdAt: '2026-10-25T10:00:00Z',
  updatedAt: '2026-10-25T10:00:00Z',
  invalidatedAt: null,
};

const invalidatedRating: MockRating = {
  activityRatingId: 802,
  activityId: 94,
  score: 2,
  comment: 'Đánh giá cũ đã bị vô hiệu hóa.',
  status: 'INVALIDATED',
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-25T11:00:00Z',
  invalidatedAt: '2026-10-25T11:00:00Z',
};

function activityRegistration(
  activityId: number,
  title: string,
  activityStatus: string,
  attendanceStatus: string,
  rating: MockRating | null,
) {
  return {
    activityRegistrationId: 400 + activityId,
    activity: {
      activityId,
      eventId: 746,
      title,
      locationCode: 'STAGE-A',
      locationName: 'Sân khấu trung tâm',
      startAt: '2026-10-24T03:00:00Z',
      endAt: '2026-10-24T04:00:00Z',
      status: activityStatus,
    },
    status: 'ACTIVE',
    outcome: 'ATTENDED',
    registeredAt: '2026-10-20T10:00:00Z',
    attendance: { status: attendanceStatus },
    rating,
  };
}

function pageOf<T>(content: T[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockRatings(
  page: Page,
  options: { failFirstList?: boolean; failFirstSave?: boolean } = {},
) {
  let listFailures = options.failFirstList ? 1 : 0;
  let saveFailures = options.failFirstSave ? 1 : 0;
  let registrations = [
    activityRegistration(91, 'Workshop làm sách', 'COMPLETED', 'VALID', null),
    activityRegistration(92, 'Giao lưu cùng tác giả', 'COMPLETED', 'VALID', activeRating),
    activityRegistration(93, 'Trưng bày bản thảo', 'PUBLISHED', 'VALID', null),
    activityRegistration(94, 'Tọa đàm đã điều chỉnh điểm danh', 'COMPLETED', 'VOIDED', invalidatedRating),
  ];
  const requests: string[] = [];

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    requests.push(`${method} ${path}`);

    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'rating-csrf' });
    if (path.endsWith('/auth/me')) return json(route, participant);
    if (path.endsWith('/auth/profile')) return json(route, {
      id: participant.userId,
      fullName: participant.fullName,
      email: participant.email,
      emailVerified: true,
      phone: null,
      avatarUrl: null,
    });
    if (path === '/api/v1/participant/event-registrations') return json(route, pageOf([eventRegistration]));
    if (path === '/api/v1/participant/activity-registrations') {
      if (listFailures > 0) {
        listFailures -= 1;
        return json(route, { code: 'TEMPORARILY_UNAVAILABLE', message: 'Dịch vụ đánh giá đang bận.' }, 503);
      }
      return json(route, pageOf(registrations));
    }
    if (path === '/api/v1/participant/notifications') return json(route, pageOf([]));
    if (path === '/api/v1/participant/notifications/unread-count') return json(route, { unreadCount: 0 });
    if (path === '/api/v1/participant/activities/92/rating' && method === 'GET') {
      return json(route, activeRating);
    }
    if (/\/api\/v1\/participant\/activities\/\d+\/rating$/.test(path) && method === 'PUT') {
      if (saveFailures > 0) {
        saveFailures -= 1;
        return json(route, {
          code: 'RATING_ACTIVITY_NOT_COMPLETED',
          message: 'Hoạt động chưa hoàn thành nên chưa thể đánh giá.',
        }, 409);
      }
      const activityId = Number(path.split('/').at(-2));
      const body = request.postDataJSON() as { score: number; comment: string };
      const previous = registrations.find(item => item.activity.activityId === activityId)?.rating;
      const saved = {
        activityRatingId: previous?.activityRatingId || 900 + activityId,
        activityId,
        score: body.score,
        comment: body.comment || null,
        status: 'ACTIVE' as const,
        createdAt: previous?.createdAt || '2026-10-26T01:00:00Z',
        updatedAt: '2026-10-26T02:00:00Z',
        invalidatedAt: null,
      };
      registrations = registrations.map(item => item.activity.activityId === activityId
        ? { ...item, rating: saved }
        : item);
      return json(route, saved);
    }
    return json(route, []);
  });

  return requests;
}

test('participant creates a rating from an eligible completed activity', async ({ page }) => {
  const requests = await mockRatings(page);
  await page.goto('/participant/feedback');

  await expect(page.getByRole('heading', { name: 'Đánh giá hoạt động' })).toBeVisible();
  const workshop = page.locator('.participant-rating-card').filter({ hasText: 'Workshop làm sách' });
  await expect(workshop.getByText('Có thể đánh giá')).toBeVisible();
  await workshop.getByRole('button', { name: 'Đánh giá', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Workshop làm sách' });
  await dialog.getByRole('radio', { name: '4 sao' }).click();
  await dialog.getByPlaceholder('Chia sẻ điều bạn thích hoặc góp ý cho hoạt động...').fill('Tổ chức rõ ràng và nội dung thực tế.');
  await dialog.getByRole('button', { name: 'Lưu đánh giá' }).click();

  await expect(page.getByText('Đã lưu đánh giá cho “Workshop làm sách”.')).toBeVisible();
  await expect(workshop.getByText('Có thể đánh giá')).toHaveCount(0);
  await expect(workshop.getByText('4/5')).toBeVisible();
  await expect(workshop.getByText('Tổ chức rõ ràng và nội dung thực tế.')).toBeVisible();
  expect(requests).toContain('PUT /api/v1/participant/activities/91/rating');
  expect(requests.some(request => request.includes('/participant/feedbacks'))).toBe(false);
});

test('participant loads and updates an existing rating while invalidated history stays read-only', async ({ page }) => {
  const requests = await mockRatings(page);
  await page.goto('/participant/feedback');

  const existing = page.locator('.participant-rating-card').filter({ hasText: 'Giao lưu cùng tác giả' });
  await existing.getByRole('button', { name: 'Chỉnh sửa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Giao lưu cùng tác giả' });
  await expect(dialog.getByPlaceholder('Chia sẻ điều bạn thích hoặc góp ý cho hoạt động...')).toHaveValue('Nội dung hữu ích.');
  await dialog.getByRole('radio', { name: '5 sao' }).click();
  await dialog.getByRole('button', { name: 'Lưu đánh giá' }).click();
  await expect(existing.getByText('5/5')).toBeVisible();

  const invalidated = page.locator('.participant-rating-card').filter({ hasText: 'Tọa đàm đã điều chỉnh điểm danh' });
  await expect(invalidated.getByText('Đã vô hiệu hóa')).toBeVisible();
  await expect(invalidated.getByRole('button', { name: /Đánh giá|Chỉnh sửa/ })).toHaveCount(0);
  expect(requests).toContain('GET /api/v1/participant/activities/92/rating');
  expect(requests).toContain('PUT /api/v1/participant/activities/92/rating');
});

test('rating list and save failures remain recoverable', async ({ page }) => {
  await mockRatings(page, { failFirstList: true, failFirstSave: true });
  await page.goto('/participant/feedback');

  await expect(page.getByRole('alert')).toContainText('Dịch vụ đánh giá đang bận.');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  const workshop = page.locator('.participant-rating-card').filter({ hasText: 'Workshop làm sách' });
  await expect(workshop).toBeVisible();
  await workshop.getByRole('button', { name: 'Đánh giá', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Workshop làm sách' });
  await dialog.getByRole('button', { name: 'Lưu đánh giá' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Hoạt động chưa hoàn thành nên chưa thể đánh giá.');
  await dialog.getByRole('button', { name: 'Lưu đánh giá' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(workshop.getByText('5/5')).toBeVisible();
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`activity ratings remain readable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockRatings(page);
    await page.goto('/participant/feedback');
    const firstCard = page.locator('.participant-rating-card').first();
    await expect(firstCard).toBeInViewport();
    await expect(firstCard.getByRole('heading')).toBeVisible();
  });
}
