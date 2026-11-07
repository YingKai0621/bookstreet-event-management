import { expect, test } from '@playwright/test';

for (const [route, heading] of [['/su-kien', 'Hội ngộ tác giả.'], ['/gian-hang', null]] as const) {
  test(`${route} opens above the landing page on a first visit`, async ({ page }) => {
    await page.route('**/api/v1/**', async request => {
      const path = new URL(request.request().url()).pathname;
      if (path.endsWith('/auth/me')) {
        return request.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"AUTHENTICATION_REQUIRED"}' });
      }
      if (path.endsWith('/auth/csrf')) return request.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } });
      return request.fulfill({ json: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } });
    });

    await page.goto(route);

    const sheet = page.locator('.heritage-sheet.is-open');
    await expect(sheet).toHaveCSS('position', 'fixed');
    await expect.poll(async () => (await sheet.boundingBox())?.x).toBe(0);
    if (heading) await expect(page.getByRole('heading', { name: heading })).toBeInViewport();
  });
}
