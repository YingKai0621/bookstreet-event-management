import { test, expect } from '@playwright/test';

test('Escape closes nested public modal first and releases scroll only after closing the sheet', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    let status = 200;
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test' };
    else if (path.endsWith('/auth/me')) { body = { code: 'AUTHENTICATION_REQUIRED' }; status = 401; }
    else if (path.endsWith('/events')) body = { content: [{ eventId: 1, name: 'Sự kiện sách', description: '', startAt: '2026-12-10T02:00:00Z', endAt: '2026-12-12T02:00:00Z', status: 'PUBLISHED' }], page: 0, totalPages: 1 };
    else if (path.endsWith('/heritages')) body = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    else if (path.endsWith('/events/1/booths')) body = { content: [{ eventId: 1, booth: { boothId: 2, code: 'A02', name: 'Gian sách kiểm thử', maxCapacity: 10, categoryCode: 'BOOK', active: true }, rentalPrice: 5000, enabled: true, availability: 'AVAILABLE' }], page: 0, totalPages: 1 };
    await route.fulfill({ status, json: body });
  });
  await page.goto('/gian-hang');
  await page.locator('.heritage-collection-card').filter({ hasText: 'Gian sách kiểm thử' }).click();
  await expect(page.locator('.modal-overlay')).toBeVisible();
  expect(['hidden', 'clip']).toContain(await page.evaluate(() => document.body.style.overflow));
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-overlay')).toHaveCount(0);
  await expect(page).toHaveURL(/\/gian-hang(?:\?eventId=\d+)?$/);
  expect(['hidden', 'clip']).toContain(await page.evaluate(() => document.body.style.overflow));
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/(?:\?eventId=\d+)?$/);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toMatch(/^(hidden|clip)$/);
});

test('public booth sections show a genuine empty state after loading completes', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    let status = 200;
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test' };
    else if (path.endsWith('/auth/me')) { body = { code: 'AUTHENTICATION_REQUIRED' }; status = 401; }
    else if (path.endsWith('/events')) body = { content: [{ eventId: 1, name: 'Sự kiện chưa có gian hàng', description: '', startAt: '2026-12-10T02:00:00Z', endAt: '2026-12-12T02:00:00Z', status: 'PUBLISHED' }], page: 0, totalPages: 1 };
    else if (path.endsWith('/heritages')) body = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    else if (path.endsWith('/events/1/booths')) body = { content: [], page: 0, totalElements: 0, totalPages: 0 };
    await route.fulfill({ status, json: body });
  });

  await page.goto('/?eventId=1');
  await expect(page.locator('#gian-hang').getByText('Sự kiện này chưa có gian hàng được công bố.')).toBeVisible();
  await expect(page.locator('#gian-hang .skeleton-card')).toHaveCount(0);

  await page.goto('/gian-hang?eventId=1');
  await expect(page.getByRole('heading', { name: 'Chưa có gian hàng được công bố' })).toBeVisible();
  await expect(page.locator('#booths-collection').getByText('Sự kiện này chưa có gian hàng được công bố.')).toBeVisible();
  await expect(page.locator('.heritage-collection .skeleton-card')).toHaveCount(0);
});
