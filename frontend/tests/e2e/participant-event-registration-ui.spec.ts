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

async function mockParticipantRegistration(page: Page, rejectJoin = false, failRefreshAfterJoin = false, registrationState = { joined: false }, deadline: string | null = null) {
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
    if (path === '/api/v1/events') return json(route, pageResponse([{ ...publicEvent, participantRegistrationDeadlineAt: deadline }]));
    if (path === `/api/v1/events/${publicEvent.eventId}/booths`) return json(route, pageResponse([]));
    if (path === '/api/v1/heritages') return json(route, []);
    if (path === '/api/v1/participant/event-registrations') {
      if (registrationState.joined && failRefreshAfterJoin) return json(route, { code: 'TEMPORARILY_UNAVAILABLE' }, 503);
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
      return json(route, pageResponse(registrationState.joined ? [registration] : []));
    }
    if (path === `/api/v1/participant/events/${publicEvent.eventId}/join` && method === 'POST') {
      joinCount += 1;
      expect(route.request().headers()['x-csrf-token']).toBe('test-csrf-token');
      if (rejectJoin) {
        return json(route, { code: 'EVENT_REGISTRATION_CLOSED', message: 'Đã hết hạn đăng ký.' }, 409);
      }
      registrationState.joined = true;
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
  await expect(registrationDialog).toContainText('11/01/2027, 19:31 – 12/01/2027, 17:31');
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

test('committed event join stays successful when the registration list refresh fails', async ({ page }) => {
  await mockParticipantRegistration(page, false, true);
  await page.goto('/');
  await page.locator('#su-kien .event-coverflow-register-btn').click();
  await page.getByRole('button', { name: 'Xác nhận Đăng ký Tham dự' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng ký tham dự thành công!' })).toBeVisible();
});

test('mobile event registration survives a full reload from the server registration list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockParticipantRegistration(page);
  await page.goto('/');
  await page.locator('#su-kien .event-coverflow-register-btn').click();
  await page.getByRole('button', { name: 'Xác nhận Đăng ký Tham dự' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng ký tham dự thành công!' })).toBeVisible();
  await page.goto('/participant/events');
  await page.reload();
  await expect(page.getByRole('heading', { name: publicEvent.name })).toBeVisible();
  expect(state.joinCount()).toBe(1);
});

for (const width of [1366, 390]) {
  test(`calendar changes to registered colour and retains its status after reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2027-01-10T03:00:00Z'));
    const state = await mockParticipantRegistration(page);
    await page.goto('/participant');
    if (width < 640) await page.locator('.participant-calendar-day[aria-label^="2027-01-11"]').click();
    const entry = page.locator(`${width < 640 ? '.participant-agenda-item' : '.participant-calendar-entry'}[data-calendar-id="event-744"]`).first();
    await expect(entry).toHaveAttribute('data-registered', 'false');
    const before = await entry.evaluate(element => getComputedStyle(element).backgroundColor);
    await entry.click();
    const dialog = page.getByRole('dialog', { name: 'Đăng ký trên lịch' });
    await dialog.getByRole('button', { name: 'Xác nhận Đăng ký', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(entry).toHaveAttribute('data-registered', 'true');
    await expect(entry).toContainText('Đã đăng ký');
    expect(await entry.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(before);
    await page.reload();
    if (width < 640) await page.locator('.participant-calendar-day[aria-label^="2027-01-11"]').click();
    await expect(entry).toHaveAttribute('data-registered', 'true');
    expect(state.joinCount()).toBe(1);
  });
}

test('failed calendar registration keeps the unregistered state and shows the API error', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-10T03:00:00Z'));
  await mockParticipantRegistration(page, true);
  await page.goto('/participant');
  const entry = page.locator('.participant-calendar-entry[data-calendar-id="event-744"]').first();
  await entry.click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký trên lịch' });
  await dialog.getByRole('button', { name: 'Xác nhận Đăng ký', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Đã hết hạn đăng ký.');
  await expect(entry).toHaveAttribute('data-registered', 'false');
});

test('a registration in another tab refreshes the overview without reloading the page', async ({ page, context }) => {
  const shared = { joined: false };
  await page.clock.setFixedTime(new Date('2027-01-10T03:00:00Z'));
  await mockParticipantRegistration(page, false, false, shared);
  await page.goto('/participant');
  const entry = page.locator('.participant-calendar-entry[data-calendar-id="event-744"]').first();
  await expect(entry).toHaveAttribute('data-registered', 'false');
  const otherTab = await context.newPage();
  await mockParticipantRegistration(otherTab, false, false, shared);
  await otherTab.goto('/');
  await otherTab.locator('#su-kien .event-coverflow-register-btn').click();
  await otherTab.getByRole('button', { name: 'Xác nhận Đăng ký Tham dự' }).click();
  await expect(otherTab.getByRole('heading', { name: 'Đăng ký tham dự thành công!' })).toBeVisible();
  await page.bringToFront();
  await expect(entry).toHaveAttribute('data-registered', 'true');
  await expect(entry).toContainText('Đã đăng ký');
});

test('an ongoing event past its registration deadline disables registration on the homepage and public detail', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-11T13:00:00Z'));
  const state = await mockParticipantRegistration(page, false, false, { joined: false }, '2027-01-11T12:00:00Z');
  await page.goto('/');
  await expect(page.locator('#su-kien .event-coverflow-register-btn')).toHaveText('Đã quá hạn đăng ký');
  await expect(page.locator('#su-kien .event-coverflow-register-btn')).toBeDisabled();
  await page.goto('/su-kien/744');
  await expect(page.getByRole('button', { name: 'Đã quá hạn đăng ký', exact: true })).toBeDisabled();
  expect(state.joinCount()).toBe(0);
});

for (const width of [1366, 390]) {
  test(`calendar disables an expired ongoing event at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2027-01-11T13:00:00Z'));
    const state = await mockParticipantRegistration(page, false, false, { joined: false }, '2027-01-11T12:00:00Z');
    await page.goto('/participant');
    if (width < 640) await page.locator('.participant-calendar-day[aria-label^="2027-01-11"]').click();
    await page.locator(`${width < 640 ? '.participant-agenda-item' : '.participant-calendar-entry'}[data-calendar-id="event-744"]`).first().click();
    const dialog = page.getByRole('dialog', { name: 'Đăng ký trên lịch' });
    await expect(dialog.getByRole('button', { name: 'Đã quá hạn đăng ký', exact: true })).toBeDisabled();
    expect(state.joinCount()).toBe(0);
  });
}

test('a registered event stays registered after its deadline', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-11T13:00:00Z'));
  await mockParticipantRegistration(page, false, false, { joined: true }, '2027-01-11T12:00:00Z');
  await page.goto('/participant');
  const entry = page.locator('.participant-calendar-entry[data-calendar-id="event-744"]').first();
  await expect(entry).toHaveAttribute('data-registered', 'true');
  await entry.click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký trên lịch' });
  await expect(dialog).toContainText('Đã đăng ký');
  await expect(dialog.getByRole('button', { name: 'Đã quá hạn đăng ký', exact: true })).toHaveCount(0);
});

test('registration closes immediately after the inclusive deadline while the page stays open', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-01-11T11:59:00Z') });
  await page.clock.pauseAt(new Date('2027-01-11T12:00:00Z'));
  await mockParticipantRegistration(page, false, false, { joined: false }, '2027-01-11T12:00:00Z');
  await page.goto('/');
  const button = page.locator('#su-kien .event-coverflow-register-btn');
  await expect(button).toBeEnabled();
  await page.clock.runFor(1);
  await expect(button).toHaveText('Đã quá hạn đăng ký');
  await expect(button).toBeDisabled();
});

for (const width of [1366, 390]) {
  test(`landing event card shows saved registration, including after the deadline, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2027-01-11T13:00:00Z'));
    const state = await mockParticipantRegistration(page, false, false, { joined: true }, '2027-01-11T12:00:00Z');
    await page.goto('/');
    await expect(page.locator('#su-kien .event-coverflow-registered-badge[data-event-id="744"]')).toHaveText('Đã đăng ký');
    await expect(page.locator('#su-kien .event-coverflow-register-btn')).toHaveText('Đã đăng ký');
    await expect(page.locator('#su-kien .event-coverflow-register-btn')).toBeDisabled();
    expect(state.joinCount()).toBe(0);
  });
}

test('landing badge updates after successful registration and remains after reloading', async ({ page }) => {
  const state = await mockParticipantRegistration(page);
  await page.goto('/');
  await page.locator('#su-kien .event-coverflow-register-btn').click();
  await page.getByRole('button', { name: 'Xác nhận Đăng ký Tham dự' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng ký tham dự thành công!' })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng biểu mẫu đăng ký', exact: true }).click();
  const badge = page.locator('#su-kien .event-coverflow-registered-badge[data-event-id="744"]');
  await expect(badge).toHaveText('Đã đăng ký');
  await page.reload();
  await expect(badge).toHaveText('Đã đăng ký');
  expect(state.joinCount()).toBe(1);
});

for (const target of [{ path: '/participant/events', width: 1366 }, { path: '/participant/events/744', width: 390 }]) {
  test(`event leave confirmation supports cancelling and saving at ${target.path}`, async ({ page }) => {
    await page.setViewportSize({ width: target.width, height: 844 });
    await mockParticipantRegistration(page, false, false, { joined: true });
    let leaveCount = 0;
    await page.route('**/api/v1/participant/events/744/leave', async route => {
      leaveCount += 1;
      expect(route.request().headers()['x-csrf-token']).toBe('test-csrf-token');
      await json(route, { eventRegistrationId: 301, event: publicEvent, status: 'LEFT', seatActiveActivityCount: 0 });
    });
    await page.goto(target.path);
    const leave = page.getByRole('button', { name: 'Rời sự kiện', exact: true });
    await leave.click();
    const modal = page.getByRole('alertdialog', { name: 'Rời sự kiện?' });
    await expect(modal).toContainText(publicEvent.name);
    await expect(modal.getByRole('button', { name: 'Ở lại', exact: true })).toBeFocused();
    expect(leaveCount).toBe(0);
    await page.screenshot({ path: `test-results/leave-event-confirmation-${target.width}.png` });
    await modal.getByRole('button', { name: 'Ở lại', exact: true }).click();
    await expect(modal).toHaveCount(0);
    expect(leaveCount).toBe(0);
    await expect(leave).toBeFocused();
    await leave.click();
    await modal.getByRole('button', { name: 'Rời sự kiện', exact: true }).click();
    await expect(page).toHaveURL('/participant');
    expect(leaveCount).toBe(1);
  });
}

test('failed leave keeps the confirmation open and shows the backend reason', async ({ page }) => {
  await mockParticipantRegistration(page, false, false, { joined: true });
  await page.route('**/api/v1/participant/events/744/leave', route => json(route, {
    code: 'EVENT_LEAVE_BLOCKED_BY_ACTIVE_ACTIVITY', message: 'Bạn cần hủy đăng ký hoạt động trước khi rời sự kiện.',
  }, 409));
  await page.goto('/participant/events');
  await page.getByRole('button', { name: 'Rời sự kiện', exact: true }).click();
  const modal = page.getByRole('alertdialog', { name: 'Rời sự kiện?' });
  await modal.getByRole('button', { name: 'Rời sự kiện', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Bạn cần hủy đăng ký hoạt động');
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('heading', { name: publicEvent.name })).toBeVisible();
});

test('calendar modal for a registered event shows cancel registration button and persists via leave API', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-10T03:00:00Z'));
  const registrationState = { joined: true };
  await mockParticipantRegistration(page, false, false, registrationState);
  let leaveCount = 0;
  await page.route('**/api/v1/participant/events/744/leave', async route => {
    leaveCount += 1;
    expect(route.request().headers()['x-csrf-token']).toBe('test-csrf-token');
    registrationState.joined = false;
    await json(route, { eventRegistrationId: 301, event: publicEvent, status: 'LEFT', seatActiveActivityCount: 0 });
  });

  await page.goto('/participant');
  const entry = page.locator('.participant-calendar-entry[data-calendar-id="event-744"]').first();
  await expect(entry).toHaveAttribute('data-registered', 'true');
  await entry.click();

  const dialog = page.getByRole('dialog', { name: 'Đăng ký trên lịch' });
  const cancelBtn = dialog.getByRole('button', { name: 'Hủy đăng ký', exact: true });
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();

  await expect(dialog).not.toBeVisible();
  expect(leaveCount).toBe(1);
  await expect(entry).toHaveAttribute('data-registered', 'false');
  await expect(entry).toContainText('Chưa đăng ký');
});
