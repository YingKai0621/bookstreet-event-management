import { expect, test, type Page, type Route } from '@playwright/test';

const participantAccount = {
  userId: 42,
  username: 'participantdemo',
  fullName: 'Bạn đọc Demo',
  email: 'reader@example.test',
  emailVerified: true,
  status: 'ACTIVE',
  roles: ['PARTICIPANT'],
};

const publicEvent = {
  eventId: 744,
  name: 'Sự kiện qua đêm',
  description: 'Sự kiện dùng để kiểm tra luồng ghi danh.',
  startAt: '2027-01-11T12:31:00Z',
  endAt: '2027-01-12T10:31:00Z',
  partnerApplicationDeadlineAt: null,
  bannerUrl: null,
  status: 'PUBLISHED',
};

function pageResponse<T>(content: T[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockParticipantRegistration(page: Page, rejectJoin = false) {
  let joined = false;
  let joinCount = 0;

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf-token' });
    }
    if (path.endsWith('/auth/me')) return json(route, participantAccount);
    if (path.endsWith('/auth/profile')) {
      return json(route, {
        id: participantAccount.userId,
        fullName: participantAccount.fullName,
        email: participantAccount.email,
        emailVerified: true,
        phone: null,
        avatarUrl: null,
      });
    }
    if (path === '/api/v1/events') return json(route, pageResponse([publicEvent]));
    if (path === `/api/v1/events/${publicEvent.eventId}/booths`) return json(route, pageResponse([]));
    if (path === '/api/v1/heritages') return json(route, []);
    if (path === '/api/v1/participant/event-registrations') {
      const registration = {
        eventRegistrationId: 301,
        event: {
          eventId: publicEvent.eventId,
          name: publicEvent.name,
          startAt: publicEvent.startAt,
          endAt: publicEvent.endAt,
          status: publicEvent.status,
        },
        status: 'ACTIVE',
        registeredAt: '2026-10-26T10:00:00Z',
        activatedAt: '2026-10-26T10:00:00Z',
        leftAt: null,
        updatedAt: '2026-10-26T10:00:00Z',
        seatActiveActivityCount: 0,
      };
      return json(route, pageResponse(joined ? [registration] : []));
    }
    if (path === `/api/v1/participant/events/${publicEvent.eventId}/join` && method === 'POST') {
      joinCount += 1;
      expect(route.request().headers()['x-csrf-token']).toBe('test-csrf-token');
      if (rejectJoin) {
        return json(route, { code: 'EVENT_REGISTRATION_CLOSED', message: 'Đã hết hạn đăng ký.' }, 409);
      }
      joined = true;
      return json(route, {
        eventRegistrationId: 301,
        event: publicEvent,
        status: 'ACTIVE',
        seatActiveActivityCount: 0,
      });
    }
    if (path === '/api/v1/participant/activity-registrations') return json(route, pageResponse([]));
    if (path === '/api/v1/participant/notifications') return json(route, pageResponse([]));
    if (path === '/api/v1/participant/notifications/unread-count') return json(route, { unreadCount: 0 });
    return json(route, []);
  });

  return { joinCount: () => joinCount };
}

test('public registration calls the join API and the joined event appears in My Events', async ({ page }) => {
  const state = await mockParticipantRegistration(page);

  await page.goto('/');
  await expect(page.locator('#su-kien .event-coverflow-details h3')).toHaveText(publicEvent.name);
  await page.locator('#su-kien .event-coverflow-register-btn').click();

  const registrationDialog = page.getByRole('dialog', { name: 'Đăng ký tham dự sự kiện' });
  await expect(registrationDialog).toContainText('2027-01-11, 19:31 – 2027-01-12, 17:31');
  await registrationDialog.getByRole('button', { name: 'Xác nhận Đăng ký Tham dự' }).click();

  await expect(page.getByRole('heading', { name: 'Đăng ký tham dự thành công!' })).toBeVisible();
  expect(state.joinCount()).toBe(1);

  await page.getByRole('link', { name: 'Xem sự kiện của tôi' }).click();
  await expect(page).toHaveURL('/participant/events');
  await expect(page.getByRole('heading', { name: 'Sự kiện của tôi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: publicEvent.name })).toBeVisible();
});

test('a rejected join never displays a false success state', async ({ page }) => {
  const state = await mockParticipantRegistration(page, true);

  await page.goto('/');
  await expect(page.locator('#su-kien .event-coverflow-details h3')).toHaveText(publicEvent.name);
  await page.locator('#su-kien .event-coverflow-register-btn').click();
  await page.getByRole('button', { name: 'Xác nhận Đăng ký Tham dự' }).click();

  await expect(page.locator('.figma-reg-form').getByRole('alert')).toContainText('Đã hết hạn đăng ký.');
  await expect(page.getByRole('heading', { name: 'Đăng ký tham dự thành công!' })).toHaveCount(0);
  expect(state.joinCount()).toBe(1);
});
