import { expect, test, type Page } from '@playwright/test';

async function mockWorkspace(page: Page, role: 'ADMIN' | 'PARTICIPANT') {
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/csrf')) body = { headerName: 'X-XSRF-TOKEN', token: 'test-token' };
    else if (path.endsWith('/auth/me')) body = { userId: 1, username: 'testreader', fullName: 'Tài khoản kiểm thử', email: 'reader@example.com', emailVerified: true, status: 'ACTIVE', roles: [role] };
    else if (path.endsWith('/auth/profile')) body = { id: 1, fullName: 'Tài khoản kiểm thử', email: 'reader@example.com' };
    else if (path.endsWith('/admin/profile')) body = { id: 1, fullName: 'Tài khoản kiểm thử', email: 'admin@example.com', department: 'Quản trị hệ thống' };
    else if (path === '/api/v1/events') body = { content: [], totalElements: 0, totalPages: 0 };
    else if (path.endsWith('/admin/dashboard')) body = {};
    else if (path.endsWith('/admin/badge-rules')) body = Array.from({ length: 11 }, (_, index) => ({
      id: String(index + 1), code: `BADGE${index + 1}`, name: `Huy hiệu ${String(index + 1).padStart(2, '0')}`,
      nameEn: `Badge ${index + 1}`, title: `Huy hiệu ${String(index + 1).padStart(2, '0')}`, iconName: 'award', minPoints: index * 100,
      status: 'active', statusLabelVi: 'Đang áp dụng', description: 'Hoàn thành hoạt động để tích lũy điểm.', perks: [],
    }));
    else if (path.endsWith('/participant/notifications')) body = Array.from({ length: 11 }, (_, index) => ({ id: String(index + 1), title: `Thông báo ${String(index + 1).padStart(2, '0')}`, message: 'Cập nhật hoạt động', isRead: false, createdAt: '2026-10-25T01:00:00Z' }));
    else if (path.endsWith('/participant/feedbacks')) {
      body = request.method() === 'POST' ? { id: '11' } : Array.from({ length: 10 }, (_, index) => ({
        id: String(index + 1), targetScope: 'entire', targetName: 'Đường Sách TP.HCM', rating: 5,
        comments: `Nội dung góp ý ${String(index + 1).padStart(2, '0')}`, status: 'new',
        createdAt: '2026-10-25T01:00:00Z', source: 'web_landing',
      }));
    }
    await route.fulfill({ json: body });
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
  test(`Admin badge records use ten cards regardless of viewport at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockWorkspace(page, 'ADMIN');
    await page.goto('/admin/badges');
    const cards = page.locator('.adm-badge-item-card');
    const pagination = page.getByRole('navigation', { name: 'pagination', exact: true });
    await expect(cards).toHaveCount(10);
    await pagination.getByRole('link', { name: 'Trang 2', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Huy hiệu 11');
    await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
    await pagination.getByRole('link', { name: 'Trang trước' }).click();
    await expect(cards).toHaveCount(10);
  });
}

test('Submitting the eleventh Participant feedback automatically adds pagination', async ({ page }) => {
  await mockWorkspace(page, 'PARTICIPANT');
  await page.goto('/participant/feedback');
  const pagination = page.getByRole('navigation', { name: 'pagination', exact: true });
  await expect(page.getByText(/Nội dung góp ý \d{2}/)).toHaveCount(10);
  await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
  await page.getByRole('button', { name: 'Gửi góp ý mới', exact: true }).click();
  await page.getByPlaceholder('Nhập nhận xét, trải nghiệm hoặc đề xuất cải tiến của bạn...').fill('Góp ý mới thứ 11');
  await page.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  await expect(page.getByText('Góp ý mới thứ 11', { exact: false })).toBeVisible();
  await expect(page.getByText(/Nội dung góp ý \d{2}/)).toHaveCount(9);
  await pagination.getByRole('link', { name: 'Trang 2', exact: true }).click();
  await expect(page.getByText(/Nội dung góp ý \d{2}/)).toHaveCount(1);
  await expect(page.getByText('Nội dung góp ý 10', { exact: false })).toBeVisible();
});


test('Participant notification list keeps the eleventh notification reachable', async ({ page }) => {
  await mockWorkspace(page, 'PARTICIPANT');
  await page.goto('/participant/feedback');
  await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
  const dropdown = page.getByRole('dialog', { name: 'Thông báo gần đây' });
  const items = dropdown.locator('.notif-dropdown-item');
  const pagination = dropdown.getByRole('navigation', { name: 'pagination', exact: true });
  await expect(items).toHaveCount(10);
  await pagination.getByRole('link', { name: 'Trang 2', exact: true }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Thông báo 11');
  await expect(pagination.getByRole('link', { name: 'Trang sau' })).toBeDisabled();
});
