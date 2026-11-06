import { expect, test } from '@playwright/test';

for (const width of [360, 390, 640]) {
  test(`Participant phone navigation and connected layout at ${width}px`, async ({ page }) => {
    // November 2026 needs six calendar rows, the tallest month the Dashboard can show.
    await page.clock.setFixedTime(new Date('2026-11-06T03:00:00Z'));
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const account = { userId: 42, username: 'reader', fullName: 'Nguyễn Minh Anh', email: 'reader@example.test', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT'] };
      const body = path.endsWith('/auth/me') ? account
        : path.endsWith('/auth/profile') ? { ...account, id: 42 }
        : path.endsWith('/auth/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'test' }
        : path.endsWith('/unread-count') ? { unreadCount: 0 }
        : { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto('/participant');
    // Bottom nav bar is removed in favor of the top taskbar/drawer
    await expect(page.locator('.participant-bottom-nav')).toHaveCount(0);
    await expect(page.locator('.participant-mobile-agenda')).toBeVisible();
    const calendar = await page.locator('.dashboard-calendar-card').boundingBox();
    expect(calendar!.height).toBeLessThan(700);
    await expect(page.locator('.participant-calendar-day[aria-pressed="true"] .participant-day-number'))
      .toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('.role-sidebar')).toHaveCSS('box-shadow', 'none');
    await page.screenshot({ path: `test-results/participant-dashboard-mobile-${width}.png`, fullPage: true });

    for (const route of ['/participant/events', '/participant/rewards', '/participant/certificates', '/participant/feedback', '/participant/notifications', '/participant/profile']) {
      await page.goto(route);
      await expect(page.locator('.participant-main-viewport h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const main = await page.locator('.participant-main-viewport').boundingBox();
      expect(main!.x).toBeLessThanOrEqual(16);
    }

    // Navigate via top-bar hamburger toggle and RoleSidebar drawer
    const toggle = page.locator('.participant-mobile-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    const sidebar = page.locator('.role-sidebar.is-mobile-open');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).not.toHaveCSS('box-shadow', 'none');
    await sidebar.getByRole('button', { name: 'Sự kiện' }).click();
    await expect(page).toHaveURL(/\/participant\/events$/);

    const chat = await page.locator('.bookstreet-chat').boundingBox();
    if (chat) {
      expect(chat.y + chat.height).toBeLessThanOrEqual(844);
      expect(chat.x + chat.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: `test-results/participant-mobile-${width}.png`, fullPage: true });
  });
}
