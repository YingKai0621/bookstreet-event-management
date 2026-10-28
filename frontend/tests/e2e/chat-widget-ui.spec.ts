import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    const body = path.endsWith('/auth/csrf') ? { token: 'test-csrf', headerName: 'X-CSRF-TOKEN' }
      : path.endsWith('/chat/messages') ? { answer: 'Bạn có thể đăng ký sự kiện tại mục Sự kiện.', sources: [] }
      : { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
});

test('floating chatbot preserves the conversation when closed and reopened', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở trợ lý BookStreet', exact: true }).click();
  await page.getByLabel('Câu hỏi của bạn').fill('Tôi đăng ký sự kiện ở đâu?');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.getByText('Bạn có thể đăng ký sự kiện tại mục Sự kiện.', { exact: true })).toBeVisible();
  await expect(page.locator('.bookstreet-chat__header button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Đóng trợ lý BookStreet', exact: true }).click();
  await expect(page.locator('.bookstreet-chat__dismiss')).toHaveCount(0);
  await expect(page.locator('.bookstreet-chat__toggle')).toBeVisible();
  const items = page.locator('.ticket-nav-list > li');
  await expect(items.nth(5)).toContainText('Góp ý');
  await expect(items).toHaveCount(6);
  await expect(page.locator('.ticket-nav-section').getByRole('button', { name: 'Chatbot', exact: true })).toHaveCount(0);
  const circles = await page.locator('.ticket-navigation-group .ticket-item-circle').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }));
  const gaps = circles.slice(1).map((circle, index) => circle.x - circles[index].x);
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(2);
  expect(Math.max(...circles.map(circle => circle.y)) - Math.min(...circles.map(circle => circle.y))).toBeLessThan(2);
  await expect(page.locator('.header-ticket-bar').getByRole('button', { name: 'Chatbot', exact: true })).toHaveCount(0);
  await expect(page.locator('.bookstreet-chat__toggle')).toBeVisible();
  await expect(page.locator('.bookstreet-chat__panel')).toHaveCount(0);
  await expect(page.locator('.ticket-nav-section').getByRole('button', { name: 'Chatbot', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở trợ lý BookStreet', exact: true }).click();
  await expect(page.getByText('Bạn có thể đăng ký sự kiện tại mục Sự kiện.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Câu hỏi của bạn')).toBeFocused();
  await expect(page.locator('.bookstreet-chat__toggle')).toBeVisible();
});

test('old dismissal preferences no longer hide the floating chatbot', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('bookstreet:chat-launcher-dismissed', 'true'));
  await page.goto('/');
  await page.reload();
  await expect(page.locator('.header-ticket-bar').getByRole('button', { name: 'Chatbot', exact: true })).toHaveCount(0);
  await expect(page.locator('.bookstreet-chat__toggle')).toBeVisible();
  await expect(page.locator('.bookstreet-chat__panel')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.bookstreet-chat__toggle')).toBeVisible();
});

test('mobile keeps only the floating chatbot launcher', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.bookstreet-chat__dismiss')).toHaveCount(0);
  await expect(page.locator('.header-ticket-bar').getByRole('button', { name: 'Chatbot', exact: true })).toHaveCount(0);
  await expect(page.locator('.bookstreet-chat__toggle')).toBeVisible();
  await expect(page.locator('.bookstreet-chat__panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở trợ lý BookStreet', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Cuộc trò chuyện' })).toBeVisible();
  await expect(page.locator('#mobile-navigation-drawer')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
