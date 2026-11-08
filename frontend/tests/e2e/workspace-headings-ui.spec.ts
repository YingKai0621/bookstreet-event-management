import { expect, test, type Page } from '@playwright/test';

type Role = 'ADMIN' | 'ORGANIZER' | 'PARTNER' | 'PARTICIPANT';
const emptyPage = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 };
const sampleEvent = { eventId: 501, organizerUserId: 1, name: 'Sự kiện kiểm thử', description: 'Đọc sách tại đường sách',
  startAt: '2027-03-20T02:00:00Z', endAt: '2027-03-21T10:00:00Z', status: 'PUBLISHED',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};
async function mockWorkspace(page: Page, role: Role) {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/me')) body = { userId: 1, username: 'testreader', fullName: 'Tài khoản kiểm thử', email: 'reader@example.com', emailVerified: true, status: 'ACTIVE', roles: [role] };
    else if (path.endsWith('/auth/csrf')) body = { headerName: 'X-CSRF-TOKEN', token: 'test' };
    else if (path.endsWith('/auth/profile') || path.endsWith('/admin/profile')) body = { id: 1, fullName: 'Tài khoản kiểm thử', email: 'reader@example.com', phone: '0901234567', department: 'Quản trị hệ thống' };
    else if ((path.endsWith('/organizations/me') || path.endsWith('/partner/organization'))) body = { partnerOrganizationId: 9, representativeUserId: 1, name: 'Nhà xuất bản kiểm thử', description: '', categoryCode: 'PUBLISHER', logoUrl: null, address: null, contactEmail: 'partner@example.com', contactPhone: '0901234567', status: 'ACTIVE' };
    else if (path === '/api/v1/events' || path === '/api/v1/organizer/events') body = { ...emptyPage, content: [sampleEvent], totalElements: 1, totalPages: 1 };
    else if (/^\/api\/v1\/admin\/(venues|assets|booths)$/.test(path)) body = { data: [], campuses: [] };
    else if (path === '/api/v1/admin/badges' || path === '/api/v1/admin/users') body = emptyPage;
    else if (path === '/api/v1/admin/dashboard') body = { accounts: { total: 0, byRole: { PARTICIPANT: 0, PARTNER: 0, ORGANIZER: 0, ADMIN: 0 }, byStatus: { ACTIVE: 0, DISABLED: 0 } }, events: { total: 0, byStatus: { DRAFT: 0, PUBLISHED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 } }, activeBoothAssignments: 0, boothRevenue: 0, auditByDay: Array.from({ length: 7 }, (_, index) => ({ date: `2026-11-0${index + 1}`, count: 0 })) };
    else if (path === '/api/v1/admin/settings') body = [{ key: 'admin.system', value: {
      general: { systemName: 'Book Street', slogan: '', logoUrl: '', supportEmail: '', supportPhone: '', physicalAddress: '', primaryColor: '#059669' },
      security: { minPasswordLength: 8, requireSpecialChar: true, maxFailedAttempts: 5, sessionTimeoutMinutes: 60, twoFactorEnabled: false },
      notifications: { sendWelcomeEmail: true, alertOnFailedLogins: true, notifyRoleChanges: true, dailyDigestEmail: false },
    } }];
    else if (path === '/api/v1/organizer/reports') body = { eventId: 501, eventName: 'Sự kiện kiểm thử', totalParticipants: 0, attended: 0, pending: 0, cancelled: 0, totalBooths: 0, totalActivities: 0, attendanceRate: 0, averageRating: 0, ratingCount: 0, activityStats: [], ratingDistribution: [] };
    else if (path.endsWith('/organizer/events/501/event-registrations')) body = emptyPage;
    else if (path === '/api/v1/participant/notifications') body = emptyPage;
    else if (path === '/api/v1/participant/notifications/unread-count') body = { unreadCount: 0 };
    else if (path === '/api/v1/participant/rewards/summary') body = {
      totalPoints: 0, totalVisits: 0, earnedBadgeCount: 0, activeBadgeCount: 0, nextBadge: null,
    };
    else if (path === '/api/v1/participant/rewards/badges') body = { ...emptyPage, size: 12 };
    else if (path === '/api/v1/participant/rewards/point-transactions') body = emptyPage;
    else if (path.endsWith('/dashboard') || path.endsWith('/dashboard/summary')) body = {};
    else if (path.includes('/organizer/') && /booths|locations|activities|requests|proposals|applications/.test(path)) body = emptyPage;
    else if (path.includes('/partner/') && /applications|booth-requests|activities|proposals/.test(path)) body = emptyPage;
    await route.fulfill({ json: body });
  });
}

const workspaces: Array<{ role: Role; routes: string[] }> = [
  { role: 'ORGANIZER', routes: ['/organizer', '/organizer/events', '/organizer/booths', '/organizer/venues', '/organizer/activities', '/organizer/booth-requests', '/organizer/participants', '/organizer/profile'] },
  { role: 'ADMIN', routes: ['/admin', '/admin/users', '/admin/badges', '/admin/roles', '/admin/organizations', '/admin/audit', '/admin/notifications', '/admin/profile'] },
  { role: 'PARTNER', routes: ['/partner', '/partner/events', '/partner/events/apply', '/partner/profile', '/partner/booths', '/partner/booth-requests', '/partner/activities'] },
  { role: 'PARTICIPANT', routes: ['/participant', '/participant/certificates', '/participant/profile', '/participant/events', '/participant/rewards'] },
];
const topBarSelectors: Record<Role, string> = {
  ORGANIZER: '.organizer-topbar',
  ADMIN: '.admin-topbar',
  PARTNER: '.partner-top-bar',
  PARTICIPANT: '.participant-top-bar',
};

for (const workspace of workspaces) {
  test(`${workspace.role} top bar omits the global search`, async ({ page }) => {
    await mockWorkspace(page, workspace.role);
    await page.goto(workspace.routes[0]);

    await expect(page.locator(topBarSelectors[workspace.role])).toBeVisible();
    await expect(page.locator(
      '.organizer-top-search, .admin-top-search, .partner-top-search, .participant-top-search'
    )).toHaveCount(0);
  });
}

test('ORGANIZER omits the unused Assets tab and redirects its legacy URL', async ({ page }) => {
  await mockWorkspace(page, 'ORGANIZER');
  await page.goto('/organizer/assets');

  await expect(page).toHaveURL(/\/organizer$/);
  await expect(page.getByRole('complementary', { name: 'Điều hướng ban quản lý' }).getByText('Thiết bị', { exact: true })).toHaveCount(0);
});

for (const workspace of workspaces) for (const width of [1440, 390]) {
  test(`${workspace.role} page headings match Dashboard typography at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await mockWorkspace(page, workspace.role);
    for (const route of workspace.routes) {
      await page.goto(route);
      await expect(page.getByText('Đang kiểm tra phiên đăng nhập...')).toHaveCount(0, { timeout: 30_000 });
      const title = page.locator('h1.workspace-page-title').first();
      const subtitle = page.locator('p.workspace-page-subtitle').first();
      if (route === '/partner/reports') {
        await expect(page.locator('main')).toHaveCSS('padding-top', '36px');
        await expect(page.locator('main')).toContainText('Chưa có API báo cáo');
        continue;
      }
      await expect(title, `Missing workspace title at ${route}`).toBeVisible({ timeout: 20_000 });
      await expect(subtitle, `Missing workspace subtitle at ${route}`).toBeVisible({ timeout: 20_000 });

      const isPartnerHero = workspace.role === 'PARTNER' && ['/partner', '/partner/events', '/partner/events/apply'].includes(route);
      if (isPartnerHero) {
        // Hero headings inside cards must maintain comfortable padding so text does not collide with the card border
        const heroCopy = page.locator('.event-hub-hero-copy, .partner-workspace-hero-copy').first();
        const copyPadding = await heroCopy.evaluate(element => {
          const style = getComputedStyle(element);
          return {
            top: parseFloat(style.paddingTop),
            left: parseFloat(style.paddingLeft),
          };
        });
        expect(copyPadding.top, `${route} hero copy top padding`).toBeGreaterThanOrEqual(16);
        expect(copyPadding.left, `${route} hero copy left padding`).toBeGreaterThanOrEqual(20);
      } else {
        const expectedTopInset = workspace.role === 'PARTICIPANT' && width === 390 ? 16 : 36;
        await expect.poll(async () => {
          const topInset = await title.evaluate(element => {
            const main = element.closest('main')!;
            return element.getBoundingClientRect().top - main.getBoundingClientRect().top;
          });
          return Math.abs(topInset - expectedTopInset);
        }, { message: route }).toBeLessThanOrEqual(1);
        const inlineInset = await title.evaluate(element => {
          const main = element.closest('main')!;
          return element.getBoundingClientRect().left - main.getBoundingClientRect().left;
        });
        const expectedInlineInset = workspace.role === 'PARTICIPANT' && width === 390 ? 14 : 48;
        expect(Math.abs(inlineInset - expectedInlineInset), route).toBeLessThanOrEqual(1);
      }

      const styles = await title.evaluate(element => {
        const style = getComputedStyle(element);
        return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, color: style.color, lineHeight: style.lineHeight, margin: style.margin, width: element.getBoundingClientRect().width };
      });
      expect(styles.family, route).toContain('Noto Serif');
      const participantMobile = workspace.role === 'PARTICIPANT' && width === 390;
      expect(styles.size, route).toBe(width === 1440 ? '32px' : participantMobile ? '22.4px' : '30px');
      expect(styles.weight, route).toBe('700');
      expect(styles.color, route).toBe('rgb(16, 37, 31)');
      expect(styles.lineHeight, route).toBe(width === 1440 ? '38.4px' : participantMobile ? '26.88px' : '36px');
      expect(styles.margin, route).toBe('0px');
      const subStyles = await subtitle.evaluate(element => {
        const style = getComputedStyle(element);
        return { family: style.fontFamily, size: style.fontSize, color: style.color, marginTop: style.marginTop, weight: style.fontWeight, lineHeight: style.lineHeight };
      });
      expect(subStyles.family, route).toContain('Be Vietnam Pro');
      expect(subStyles.size, route).toBe(participantMobile ? '13px' : '15.6px');
      expect(subStyles.color, route).toBe('rgb(92, 112, 105)');
      expect(subStyles.marginTop, route).toBe('3.2px');
      expect(subStyles.weight, route).toBe('400');
      expect(subStyles.lineHeight, route).toBe(participantMobile ? '17.55px' : '21.06px');
    }
    expect(pageErrors).toEqual([]);
    await page.screenshot({ path: test.info().outputPath('workspace-headings.png'), fullPage: true });
  });
}

for (const workspace of workspaces) for (const width of [1440, 390]) {
  test(`${workspace.role} harmonious components at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    await mockWorkspace(page, workspace.role);
    for (const route of workspace.routes) {
      await page.goto(route);
      await expect(page.locator('h1.workspace-page-title').first()).toBeVisible();
      await expect(page.locator('.role-sidebar-item').first()).toHaveCSS('border-top-left-radius', '10px');
      await expect(page.locator('.participant-app-shell, .partner-app-shell, .organizer-app-shell, .admin-app-shell').first())
        .toHaveCSS('--workspace-control-radius', '8px');
      await expect(page.locator('.participant-app-shell, .partner-app-shell, .organizer-app-shell, .admin-app-shell').first())
        .toHaveCSS('--workspace-tag-radius', '4px');
      const largeSurfaces = page.locator('.adm-card, .adm-kpi-card, .org-dashboard-panel, .org-dashboard-chart-card, .org-metric-card, .partner-card, .partner-stat-card, .partner-workspace-panel, .partner-workspace-stat, .summary-stat-card, .participant-event-card, .participant-rating-card, .participant-event-overview-card, .booth-kpi-card, .booth-card');
      for (const surface of await largeSurfaces.all()) {
        await expect(surface, `Square outer surface at ${route}`).toHaveCSS('border-radius', '0px');
      }
      const outerGroups = page.locator('.participant-summary-grid, .participant-featured-banner, .participant-calendar-wrapper, .participant-mobile-agenda, .rewards-collection-section, .certificate-card-row, .participant-event-summary, .participant-notification-filters, .partner-todo-section, .booth-map-container, .notifications-list-container, .event-hub-hero, .booth-kpi-grid, .booth-card-item, .adm-profile-details-grid, .adm-profile-form, .org-event-list, .org-event-form-section, .org-toolbar, .org-dashboard-kpi, .obr-toolbar, .booth-crud-toolbar, .organizer-feedback-toolbar, .organizer-feedback-total, .organizer-feedback-card, .review-list-pane, .facility-stat, .facility-panel');
      for (const group of await outerGroups.all()) {
        await expect(group, `Square container at ${route}`).toHaveCSS('border-radius', '0px');
      }
      if (workspace.role === 'PARTNER' && route === '/partner') {
        for (const surface of await page.locator('.partner-workspace-hero, .partner-workspace-stats, .partner-workspace-panel, .partner-workspace-activity, .partner-workspace-event, .partner-workspace-task, .partner-workspace-empty').all()) {
          await expect(surface).toHaveCSS('border-radius', '0px');
        }
        await expect(page.locator('.partner-workspace-stat-icon').first()).toHaveCSS('border-radius', '10px');
        await expect(page.locator('.partner-workspace-primary-action')).toHaveCSS('border-radius', '10px');
        await expect(page.locator('.partner-workspace-secondary-action')).toHaveCSS('border-radius', '10px');
      }
      // Every workspace keeps feature-owned rounded details after lazy loading.
      const roundedBoxes = await page.locator(
        '.participant-app-shell *, .partner-app-shell *, .organizer-app-shell *, .admin-app-shell *'
      ).evaluateAll(elements =>
        elements.filter(element => {
          if (!(element instanceof HTMLElement) || !element.getClientRects().length) return false;
          if (element.closest('.role-sidebar, .participant-top-bar, .partner-top-bar, .organizer-topbar, .admin-topbar, .reader-profile-page, .partner-profile-page, .org-profile-container, .adm-profile-view')) return false;
          return [null, '::before', '::after'].some(pseudo => {
            const style = getComputedStyle(element, pseudo);
            return [style.borderTopLeftRadius, style.borderTopRightRadius,
              style.borderBottomLeftRadius, style.borderBottomRightRadius]
              .some(radius => radius !== '0px');
          });
        }).map(element => `${element.tagName}.${element.className}`).slice(0, 12)
      );
      if (route === workspace.routes[0]) {
        expect(roundedBoxes.length, `Rounded dashboard details at ${route}`).toBeGreaterThan(0);
        await page.screenshot({ path: test.info().outputPath('harmonious-dashboard.png'), fullPage: true });
      }
    }
  });
}
