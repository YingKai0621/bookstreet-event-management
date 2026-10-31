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
