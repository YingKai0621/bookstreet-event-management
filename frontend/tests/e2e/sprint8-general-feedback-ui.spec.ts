import { expect, test, type Page, type Route } from '@playwright/test';

const publicEvent = {
  eventId: 801,
  name: 'Ngày hội Văn hóa Đọc',
  description: 'Sự kiện công khai dùng để kiểm tra góp ý.',
  startAt: '2027-01-11T01:00:00Z',
  endAt: '2027-01-11T10:00:00Z',
  partnerApplicationDeadlineAt: null,
  participantRegistrationDeadlineAt: null,
  bannerUrl: null,
  status: 'PUBLISHED',
};

function pageResponse<T>(content: T[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

type FeedbackHandler = (route: Route, attempt: number) => Promise<void>;

async function mockLanding(page: Page, feedbackHandler: FeedbackHandler) {
  let feedbackAttempts = 0;

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) return json(route, {}, 401);
    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: `feedback-csrf-${feedbackAttempts}` });
    }
    if (path === '/api/v1/events') return json(route, pageResponse([publicEvent]));
    if (path === '/api/v1/public/feedbacks' && route.request().method() === 'POST') {
      feedbackAttempts += 1;
      return feedbackHandler(route, feedbackAttempts);
    }
    return json(route, pageResponse([]));
  });

  return { feedbackAttempts: () => feedbackAttempts };
}

async function openFeedbackForm(page: Page) {
  await page.goto('/#gop-y');
  await expect(page.locator('#gop-y')).toBeVisible();
}

async function fillValidMessage(page: Page) {
  await page.getByLabel('Nội dung góp ý (*):').fill('Không gian Đường Sách rất thân thiện và dễ tìm.');
}

test('inline validation stays on the form and accepts a trimmed contact email', async ({ page }) => {
  let submittedPayload: Record<string, unknown> | undefined;
  const mock = await mockLanding(page, async route => {
    submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
    await json(route, { feedbackId: 101, receivedAt: '2026-10-31T08:20:00Z' }, 201);
  });
  await openFeedbackForm(page);

  await page.getByLabel('Email liên hệ (Không bắt buộc):').fill('abc');
  await page.getByLabel('Nội dung góp ý (*):').fill('1');
  await page.locator('#gop-y .sk05-submit-btn').click();

  await expect(page.locator('#feedback-contact-email-error')).toHaveText('Email liên hệ không đúng định dạng.');
  await expect(page.locator('#feedback-message-error')).toHaveText('Nội dung góp ý phải có từ 10 đến 2.000 ký tự.');
  await expect(page.locator('#gop-y .sk05-feedback-form')).toBeVisible();
  expect(mock.feedbackAttempts()).toBe(0);

  await page.getByLabel('Email liên hệ (Không bắt buộc):').fill('  reader@example.test  ');
  await fillValidMessage(page);
  await page.locator('#gop-y .sk05-submit-btn').click();

  await expect(page.getByRole('heading', { name: 'Gửi góp ý thành công!' })).toBeVisible();
  expect(mock.feedbackAttempts()).toBe(1);
  expect(submittedPayload?.contactEmail).toBe('reader@example.test');
});

test('same-tick duplicate clicks create only one feedback request', async ({ page }) => {
  const mock = await mockLanding(page, async route => {
    await new Promise(resolve => setTimeout(resolve, 150));
    await json(route, { feedbackId: 102, receivedAt: '2026-10-31T08:21:00Z' }, 201);
  });
  await openFeedbackForm(page);
  await fillValidMessage(page);

  await page.locator('#gop-y .sk05-submit-btn').evaluate((element: HTMLButtonElement) => {
    element.click();
    element.click();
  });

  await expect(page.getByRole('heading', { name: 'Gửi góp ý thành công!' })).toBeVisible();
  expect(mock.feedbackAttempts()).toBe(1);
});

for (const failure of [
  {
    name: 'CSRF',
    response: async (route: Route) => json(route, { code: 'CSRF_INVALID', message: 'Invalid CSRF.', fieldErrors: [] }, 403),
    expected: 'Phiên gửi biểu mẫu đã hết hạn. Vui lòng tải lại trang và thử lại.',
  },
  {
    name: 'network',
    response: async (route: Route) => route.abort('connectionfailed'),
    expected: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
  },
  {
    name: 'server',
    response: async (route: Route) => json(route, { code: 'INTERNAL_ERROR', message: 'Internal error.', fieldErrors: [] }, 500),
    expected: 'Máy chủ đang gặp sự cố khi tiếp nhận góp ý. Vui lòng thử lại sau.',
  },
]) {
  test(`renders a distinct ${failure.name} failure state`, async ({ page }) => {
    await mockLanding(page, failure.response);
    await openFeedbackForm(page);
    await fillValidMessage(page);
    await page.locator('#gop-y .sk05-submit-btn').click();
    await expect(page.locator('#gop-y .sk05-result-error')).toContainText(failure.expected);
    await expect(page.getByRole('heading', { name: 'Gửi góp ý thành công!' })).toHaveCount(0);
  });
}

test('feedback form remains usable without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockLanding(page, route => json(route, { feedbackId: 103, receivedAt: '2026-10-31T08:22:00Z' }, 201));
  await openFeedbackForm(page);

  await expect(page.getByLabel('Email liên hệ (Không bắt buộc):')).toBeVisible();
  await expect(page.getByLabel('Nội dung góp ý (*):')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

const organizerAccount = {
  userId: 12,
  username: 'organizer',
  fullName: 'Ban Tổ chức Đường Sách',
  email: 'organizer@example.test',
  emailVerified: true,
  status: 'ACTIVE',
  roles: ['PARTICIPANT', 'ORGANIZER'],
};

function organizerListItem(
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED',
  feedbackId = 501,
  messagePreview = 'Khu vực sân khấu được hướng dẫn rõ ràng và thân thiện.',
) {
  return {
    feedbackId,
    targetType: 'EVENT',
    event: { eventId: 801, name: 'Ngày hội Văn hóa Đọc' },
    messagePreview,
    status,
    submittedAt: '2026-10-31T08:20:00Z',
    updatedAt: '2026-10-31T08:20:00Z',
  };
}

function organizerDetail(status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED', internalNote: string | null = null) {
  return {
    ...organizerListItem(status),
    submitter: null,
    guestName: 'Minh An',
    contactEmail: 'minhan@example.test',
    message: 'Khu vực sân khấu được hướng dẫn rõ ràng và thân thiện.',
    internalNote,
    lastHandledBy: status === 'NEW' ? null : { userId: 12, fullName: 'Ban Tổ chức Đường Sách' },
    handlingStartedAt: status === 'NEW' ? null : '2026-10-31T08:25:00Z',
    resolvedAt: status === 'RESOLVED' ? '2026-10-31T08:30:00Z' : null,
  };
}

async function mockOrganizerFeedback(page: Page, conflictOnStart = false) {
  let state: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' = 'NEW';
  let note: string | null = null;
  let startAttempts = 0;

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.endsWith('/auth/me')) return json(route, organizerAccount);
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'organizer-feedback-csrf' });
    if (path === '/api/v1/organizer/feedbacks' && method === 'GET') {
      return json(route, { content: [organizerListItem(state)], page: 0, size: 10, totalElements: 1, totalPages: 1 });
    }
    if (path === '/api/v1/organizer/feedbacks/501' && method === 'GET') {
      return json(route, organizerDetail(state, note));
    }
    if (path.endsWith('/501/start-handling') && method === 'POST') {
      startAttempts += 1;
      state = 'IN_PROGRESS';
      if (conflictOnStart && startAttempts === 1) {
        return json(route, { code: 'FEEDBACK_TRANSITION_CONFLICT', message: 'Conflict.', fieldErrors: [] }, 409);
      }
      return json(route, organizerDetail(state, note));
    }
    if (path.endsWith('/501/resolve') && method === 'POST') {
      note = (route.request().postDataJSON() as { internalNote: string }).internalNote;
      state = 'RESOLVED';
      return json(route, organizerDetail(state, note));
    }
    if (path.endsWith('/501/reopen') && method === 'POST') {
      state = 'IN_PROGRESS';
      return json(route, organizerDetail(state, note));
    }
    return json(route, pageResponse([]));
  });

  return { state: () => state, note: () => note };
}

test('organizer queue renders loading and empty states', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return json(route, organizerAccount);
    if (url.pathname.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'organizer-state-csrf' });
    }
    if (url.pathname === '/api/v1/organizer/feedbacks') {
      await new Promise(resolve => setTimeout(resolve, 500));
      return json(route, pageResponse([]));
    }
    return json(route, pageResponse([]));
  });

  await page.goto('/organizer');
  await page.getByRole('button', { name: 'Góp ý', exact: true }).click();
  await expect(page.getByText('Đang tải góp ý…')).toBeVisible();
  await expect(page.getByText('Không tìm thấy góp ý nào. Hãy thử từ khóa hoặc trạng thái khác.')).toBeVisible();
});

for (const queueFailure of [
  {
    name: 'forbidden',
    status: 403,
    body: { code: 'ACCESS_DENIED', message: 'Forbidden.', fieldErrors: [] },
    expected: 'Tài khoản hiện tại không có quyền Organizer để xem hàng đợi góp ý.',
  },
  {
    name: 'server failure',
    status: 500,
    body: { code: 'INTERNAL_ERROR', message: 'Không tải được hàng đợi góp ý.', fieldErrors: [] },
    expected: 'Không tải được hàng đợi góp ý.',
  },
]) {
  test(`organizer queue renders the ${queueFailure.name} state`, async ({ page }) => {
    await page.route('**/api/v1/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/auth/me')) return json(route, organizerAccount);
      if (url.pathname.endsWith('/auth/csrf')) {
        return json(route, { headerName: 'X-CSRF-TOKEN', token: 'organizer-error-csrf' });
      }
      if (url.pathname === '/api/v1/organizer/feedbacks') {
        return json(route, queueFailure.body, queueFailure.status);
      }
      return json(route, pageResponse([]));
    });

    await page.goto('/organizer/feedback');
    await expect(page.getByRole('alert')).toContainText(queueFailure.expected);
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
}

test('organizer uses the real shared queue, detail and legal actions', async ({ page }) => {
  const mock = await mockOrganizerFeedback(page);
  await page.goto('/organizer/feedback');

  await expect(page.getByRole('heading', { name: 'Góp ý trải nghiệm' })).toBeVisible();
  await expect(page.locator('.organizer-feedback-heading')).not.toContainText(';');
  await expect(page.getByRole('textbox', { name: 'Tìm theo nội dung góp ý' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Người gửi hoặc email' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tên sự kiện' })).toBeVisible();
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.getByText('Khu vực sân khấu được hướng dẫn rõ ràng và thân thiện.')).toBeVisible();
  await expect(page.locator('.organizer-feedback-card svg.lucide-star')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  const overlay = page.locator('.organizer-feedback-overlay');
  await expect(overlay).toBeVisible();
  await expect.poll(() => overlay.evaluate(element => getComputedStyle(element).position)).toBe('fixed');
  const dialogBox = await page.getByRole('dialog').boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height);
  await expect(page.getByText('minhan@example.test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xử lý góp ý' })).toBeVisible();

  await page.getByRole('button', { name: 'Xử lý góp ý' }).click();
  await expect(page.getByText('Chỉ Ban Tổ chức xem được. Nội dung này không gửi cho khách.')).toBeVisible();
  await page.getByPlaceholder('Nhập kết quả hoặc hướng xử lý nội bộ...').fill('  Đã   chuyển cho nhóm vận hành.  ');
  await page.getByRole('button', { name: 'Đánh dấu đã giải quyết' }).click();

  await expect(page.getByText('Ghi chú nội bộ')).toBeVisible();
  await expect(page.getByText('Đã chuyển cho nhóm vận hành.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở lại xử lý' })).toBeVisible();
  expect(mock.state()).toBe('RESOLVED');
  expect(mock.note()).toBe('Đã chuyển cho nhóm vận hành.');

  await page.getByRole('button', { name: 'Đóng' }).first().click();
  await expect(overlay).toHaveCount(0);
  await expect.poll(() => page.locator('.organizer-main-viewport').evaluate(element => element.style.overflow)).toBe('');
});

test('organizer feedback is reachable from desktop and mobile navigation', async ({ page }) => {
  await mockOrganizerFeedback(page);
  await page.goto('/organizer');

  await page.getByRole('button', { name: 'Góp ý', exact: true }).click();
  await expect(page).toHaveURL(/\/organizer\/feedback$/);
  await expect(page.getByRole('heading', { name: 'Góp ý trải nghiệm' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/organizer');
  await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
  await page.getByRole('button', { name: 'Góp ý', exact: true }).click();
  await expect(page).toHaveURL(/\/organizer\/feedback$/);
  await expect(page.getByRole('heading', { name: 'Góp ý trải nghiệm' })).toBeVisible();
});

test('older queue responses cannot overwrite newer search results', async ({ page }) => {
  await mockOrganizerFeedback(page);
  await page.route('**/api/v1/organizer/feedbacks?*', async route => {
    const search = new URL(route.request().url()).searchParams.get('search');
    if (search === 'old') {
      await new Promise(resolve => setTimeout(resolve, 500));
      return json(route, {
        content: [organizerListItem('NEW', 601, 'Kết quả cũ không được phép ghi đè.')],
        page: 0, size: 10, totalElements: 1, totalPages: 1,
      });
    }
    if (search === 'new') {
      await new Promise(resolve => setTimeout(resolve, 20));
      return json(route, {
        content: [organizerListItem('NEW', 602, 'Kết quả mới nhất phải được giữ lại.')],
        page: 0, size: 10, totalElements: 1, totalPages: 1,
      });
    }
    return json(route, {
      content: [organizerListItem('NEW')], page: 0, size: 10, totalElements: 1, totalPages: 1,
    });
  });

  await page.goto('/organizer/feedback');
  const search = page.getByPlaceholder('Nhập nội dung cần tìm...');
  await search.fill('old');
  await page.waitForTimeout(350);
  await search.fill('new');

  await expect(page.getByText('Kết quả mới nhất phải được giữ lại.')).toBeVisible();
  await page.waitForTimeout(550);
  await expect(page.getByText('Kết quả mới nhất phải được giữ lại.')).toBeVisible();
  await expect(page.getByText('Kết quả cũ không được phép ghi đè.')).toHaveCount(0);
});

test('organizer filters content, sender and event name independently', async ({ page }) => {
  await mockOrganizerFeedback(page);
  let latestQuery = new URLSearchParams();
  await page.route('**/api/v1/organizer/feedbacks?*', route => {
    latestQuery = new URL(route.request().url()).searchParams;
    return json(route, {
      content: [organizerListItem('NEW')], page: 0, size: 10, totalElements: 1, totalPages: 1,
    });
  });

  await page.goto('/organizer/feedback');
  await page.getByRole('textbox', { name: 'Tìm theo nội dung góp ý' }).fill('sân khấu');
  await page.getByRole('textbox', { name: 'Người gửi hoặc email' }).fill('minhan@example.test');
  await page.getByRole('textbox', { name: 'Tên sự kiện' }).fill('Ngày hội Văn hóa Đọc');

  await expect.poll(() => ({
    search: latestQuery.get('search'),
    senderSearch: latestQuery.get('senderSearch'),
    eventNameSearch: latestQuery.get('eventNameSearch'),
    eventId: latestQuery.get('eventId'),
  })).toEqual({
    search: 'sân khấu',
    senderSearch: 'minhan@example.test',
    eventNameSearch: 'Ngày hội Văn hóa Đọc',
    eventId: null,
  });

  await page.getByRole('combobox', { name: 'Phạm vi' }).selectOption('BOOK_STREET');
  await expect(page.getByRole('textbox', { name: 'Tên sự kiện' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Tên sự kiện' })).toHaveValue('');
  await expect.poll(() => latestQuery.get('eventNameSearch')).toBeNull();
});

test('closing one detail prevents its late response from replacing the next detail', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return json(route, organizerAccount);
    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'detail-race-csrf' });
    }
    if (path === '/api/v1/organizer/feedbacks') {
      return json(route, {
        content: [
          organizerListItem('NEW', 501, 'Góp ý thứ nhất.'),
          organizerListItem('NEW', 502, 'Góp ý thứ hai.'),
        ],
        page: 0, size: 10, totalElements: 2, totalPages: 1,
      });
    }
    if (path.endsWith('/organizer/feedbacks/501')) {
      await new Promise(resolve => setTimeout(resolve, 450));
      return json(route, { ...organizerDetail('NEW'), feedbackId: 501, guestName: 'Người gửi cũ' });
    }
    if (path.endsWith('/organizer/feedbacks/502')) {
      return json(route, { ...organizerDetail('NEW'), feedbackId: 502, guestName: 'Người gửi mới' });
    }
    return json(route, pageResponse([]));
  });

  await page.goto('/organizer/feedback');
  await page.getByRole('button', { name: 'Xem chi tiết' }).nth(0).click();
  await page.getByRole('button', { name: 'Đóng' }).first().click();
  await page.getByRole('button', { name: 'Xem chi tiết' }).nth(1).click();

  await expect(page.getByText('Người gửi mới')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText('Người gửi mới')).toBeVisible();
  await expect(page.getByText('Người gửi cũ')).toHaveCount(0);
});

test('queue returns to the last valid page after a transition shrinks pagination', async ({ page }) => {
  let transitioned = false;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/me')) return json(route, organizerAccount);
    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'csrf' });
    if (path === '/api/v1/organizer/feedbacks' && method === 'GET') {
      const requestedPage = Number(url.searchParams.get('page') || '0');
      const totalPages = transitioned ? 2 : 3;
      const content = requestedPage < totalPages
        ? [organizerListItem('NEW', 700 + requestedPage, `Nội dung trang ${requestedPage + 1}.`)]
        : [];
      return json(route, {
        content, page: requestedPage, size: 10, totalElements: totalPages, totalPages,
      });
    }
    if (path.endsWith('/organizer/feedbacks/702') && method === 'GET') {
      return json(route, { ...organizerDetail('NEW'), feedbackId: 702 });
    }
    if (path.endsWith('/organizer/feedbacks/702/start-handling') && method === 'POST') {
      transitioned = true;
      return json(route, { ...organizerDetail('IN_PROGRESS'), feedbackId: 702 });
    }
    return json(route, pageResponse([]));
  });

  await page.goto('/organizer/feedback');
  await page.getByRole('button', { name: 'Trang sau' }).click();
  await expect(page.getByText('Trang 2/3')).toBeVisible();
  await page.getByRole('button', { name: 'Trang sau' }).click();
  await expect(page.getByText('Trang 3/3')).toBeVisible();
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.getByRole('button', { name: 'Xử lý góp ý' }).click();

  await expect(page.getByText('Trang 2/2')).toBeVisible();
  await expect(page.getByText('Nội dung trang 2.')).toBeVisible();
  await expect(page.getByText('Trang 3/2')).toHaveCount(0);
});

test('organizer conflict reloads durable state and mobile layout remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockOrganizerFeedback(page, true);
  await page.goto('/organizer/feedback');
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.getByRole('button', { name: 'Xử lý góp ý' }).click();

  await expect(page.getByText('Góp ý vừa được Organizer khác cập nhật. Dữ liệu mới nhất đã được tải lại.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đánh dấu đã giải quyết' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
