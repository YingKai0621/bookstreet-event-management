import { expect, test, type Page, type Route } from '@playwright/test';

const organizerAccount = {
  userId: 12,
  username: 'organizer',
  fullName: 'Ban Tổ chức Đường Sách',
  email: 'organizer@example.test',
  emailVerified: true,
  status: 'ACTIVE',
  roles: ['PARTICIPANT', 'ORGANIZER'],
};

type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

function heritageItem(id: number, status: Status, title: string) {
  return {
    heritageContentId: id,
    publicCode: `DI-SAN-${id}`,
    title,
    summary: `Tóm tắt cho ${title}`,
    imageUrl: null,
    locationText: 'Đường Sách Nguyễn Văn Bình',
    status,
    publishedAt: status === 'DRAFT' ? null : '2026-11-01T02:00:00Z',
    createdAt: '2026-11-01T01:00:00Z',
    updatedAt: `2026-11-01T03:00:00.00000${id}Z`,
  };
}

function heritageDetail(id: number, status: Status, title: string) {
  return {
    ...heritageItem(id, status, title),
    content: `Đây là nội dung câu chuyện di sản số ${id} với đầy đủ thông tin cần thiết.`,
  };
}

function pageResponse<T>(content: T[], page = 0, size = 10) {
  return { content, page, size, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockOrganizerShell(page: Page, handler: (route: Route) => Promise<boolean>) {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return json(route, organizerAccount);
    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'heritage-organizer-csrf' });
    }
    if (await handler(route)) return;
    if (path === '/api/v1/organizer/events') return json(route, pageResponse([]));
    return json(route, pageResponse([]));
  });
}

test('Organizer creates a draft then publishes it with the raw concurrency token', async ({ page }) => {
  await page.clock.install();
  await page.route('**/assets/heritage/uploads/*.png', route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ1cAAAAASUVORK5CYII=', 'base64'),
  }));
  let rows: ReturnType<typeof heritageItem>[] = [];
  let createPayload: Record<string, unknown> | null = null;
  let publishPayload: Record<string, unknown> | null = null;

  await mockOrganizerShell(page, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path === '/api/v1/organizer/heritages' && method === 'GET') {
      await json(route, pageResponse(rows));
      return true;
    }
    if (path === '/api/v1/organizer/heritages' && method === 'POST') {
      createPayload = route.request().postDataJSON() as Record<string, unknown>;
      rows = [heritageItem(21, 'DRAFT', 'Bưu điện Thành phố Hồ Chí Minh')];
      await json(route, heritageDetail(21, 'DRAFT', rows[0].title), 201);
      return true;
    }
    if (path === '/api/v1/organizer/heritage-images' && method === 'POST') {
      await json(route, { imageUrl: '/assets/heritage/uploads/00000000-0000-0000-0000-000000000009.png' }, 201);
      return true;
    }
    if (path.endsWith('/organizer/heritages/21/publish') && method === 'POST') {
      publishPayload = route.request().postDataJSON() as Record<string, unknown>;
      rows = [heritageItem(21, 'PUBLISHED', rows[0].title)];
      await json(route, heritageDetail(21, 'PUBLISHED', rows[0].title));
      return true;
    }
    return false;
  });

  await page.goto('/organizer/public-content');
  await expect(page.getByRole('heading', { name: 'Nội dung di sản', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm nội dung' }).first().click();
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();
  await expect(page.getByRole('alert')).toContainText('Tiêu đề phải có từ 2 đến 200 ký tự');
  await page.getByLabel('Địa chỉ hoặc vị trí (không bắt buộc)').fill('Công xã Paris, Quận 1');
  await page.getByLabel('Tiêu đề *').fill('Bưu điện Thành phố Hồ Chí Minh');
  await page.getByLabel('Tóm tắt').fill('Một công trình kiến trúc tiêu biểu bên cạnh Đường Sách.');
  await page.getByLabel('Nội dung *').fill('Công trình được xây dựng vào cuối thế kỷ XIX và gắn với không gian trung tâm thành phố.');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'buu-dien.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });
  await expect(page.getByAltText('Ảnh xem trước')).toBeVisible();
  const imageUrl = page.getByRole('textbox', { name: 'Ảnh minh họa (không bắt buộc)', exact: true });
  await imageUrl.scrollIntoViewIfNeeded();
  const urlBounds = await imageUrl.boundingBox();
  const uploadBounds = await page.getByRole('button', { name: 'Chọn ảnh từ máy', exact: true }).boundingBox();
  const previewBounds = await page.locator('.image-url-field-preview').boundingBox();
  expect(uploadBounds!.y).toBeGreaterThanOrEqual(urlBounds!.y + urlBounds!.height);
  expect(previewBounds!.x).toBeGreaterThan(urlBounds!.x + urlBounds!.width);
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();

  const createNotice = page.getByText('Đã tạo nội dung di sản ở trạng thái bản nháp.');
  await expect(createNotice).toBeVisible();
  await page.clock.fastForward(5000);
  await expect(createNotice).not.toBeVisible();
  expect(createPayload).toMatchObject({
    title: 'Bưu điện Thành phố Hồ Chí Minh',
    locationText: 'Công xã Paris, Quận 1',
    imageUrl: '/assets/heritage/uploads/00000000-0000-0000-0000-000000000009.png',
  });
  expect(createPayload).not.toHaveProperty('publicCode');

  await page.getByRole('button', { name: 'Công bố' }).click();
  const publishDialog = page.getByRole('dialog');
  await expect(publishDialog.getByRole('heading', { name: 'Công bố nội dung di sản?' })).toBeVisible();
  await publishDialog.getByRole('button', { name: 'Công bố', exact: true }).click();
  await expect(page.getByText('Đã công bố nội dung di sản.')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng thông báo' }).click();
  await expect(page.getByText('Đã công bố nội dung di sản.')).not.toBeVisible();
  expect(publishPayload).toEqual({ expectedUpdatedAt: '2026-11-01T03:00:00.0000021Z' });
  await expect(page.getByRole('link', { name: 'Trang công khai', exact: true })).toHaveAttribute('href', '/di-san/DI-SAN-21');
});

test('Organizer lifecycle actions use only legal actions for each status', async ({ page }) => {
  let rows = [
    heritageItem(1, 'DRAFT', 'Bản nháp một'),
    heritageItem(2, 'PUBLISHED', 'Nội dung công khai'),
    heritageItem(3, 'ARCHIVED', 'Nội dung lưu trữ'),
  ];
  const calls: string[] = [];

  await mockOrganizerShell(page, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path === '/api/v1/organizer/heritages' && method === 'GET') {
      await json(route, pageResponse(rows));
      return true;
    }
    if (path.endsWith('/organizer/heritages/1') && method === 'DELETE') {
      calls.push(`${method} ${path} ${url.searchParams.get('expectedUpdatedAt')}`);
      rows = rows.filter(item => item.heritageContentId !== 1);
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/organizer/heritages/2/archive') && method === 'POST') {
      calls.push(`${method} ${path}`);
      rows = rows.map(item => item.heritageContentId === 2 ? heritageItem(2, 'ARCHIVED', item.title) : item);
      await json(route, heritageDetail(2, 'ARCHIVED', 'Nội dung công khai'));
      return true;
    }
    if (path.endsWith('/organizer/heritages/3/republish') && method === 'POST') {
      calls.push(`${method} ${path}`);
      rows = rows.map(item => item.heritageContentId === 3 ? heritageItem(3, 'PUBLISHED', item.title) : item);
      await json(route, heritageDetail(3, 'PUBLISHED', 'Nội dung lưu trữ'));
      return true;
    }
    return false;
  });

  await page.goto('/organizer/public-content');
  const draft = page.locator('.heritage-management-card').filter({ hasText: 'Bản nháp một' });
  const published = page.locator('.heritage-management-card').filter({ hasText: 'Nội dung công khai' });
  const archived = page.locator('.heritage-management-card').filter({ hasText: 'Nội dung lưu trữ' });

  await expect(draft.getByRole('button', { name: 'Xóa' })).toBeVisible();
  await expect(published.getByRole('button', { name: 'Xóa' })).toHaveCount(0);
  await expect(archived.getByRole('button', { name: 'Công bố lại' })).toBeVisible();

  await published.getByRole('button', { name: 'Lưu trữ' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu trữ', exact: true }).click();
  await expect(page.getByText('Đã lưu trữ nội dung di sản.')).toBeVisible();

  await page.locator('.heritage-management-card').filter({ hasText: 'Nội dung lưu trữ' }).getByRole('button', { name: 'Công bố lại' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Công bố lại', exact: true }).click();
  await expect(page.getByText('Đã công bố lại nội dung di sản.')).toBeVisible();

  await page.locator('.heritage-management-card').filter({ hasText: 'Bản nháp một' }).getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa bản nháp', exact: true }).click();
  await expect(page.getByText('Đã xóa bản nháp di sản.')).toBeVisible();
  expect(calls).toContain('POST /api/v1/organizer/heritages/2/archive');
  expect(calls).toContain('POST /api/v1/organizer/heritages/3/republish');
  expect(calls).toContain('DELETE /api/v1/organizer/heritages/1 2026-11-01T03:00:00.000001Z');
});

test('stale update reloads the token while preserving the Organizer form', async ({ page }) => {
  const item = heritageItem(7, 'DRAFT', 'Tiêu đề ban đầu');
  let detail = heritageDetail(7, 'DRAFT', item.title);
  let detailReads = 0;

  await mockOrganizerShell(page, async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/api/v1/organizer/heritages' && method === 'GET') {
      await json(route, pageResponse([item]));
      return true;
    }
    if (path.endsWith('/organizer/heritages/7') && method === 'GET') {
      detailReads += 1;
      if (detailReads > 1) detail = { ...detail, updatedAt: '2026-11-01T03:30:00.123456Z' };
      await json(route, detail);
      return true;
    }
    if (path.endsWith('/organizer/heritages/7') && method === 'PATCH') {
      await json(route, { code: 'HERITAGE_STALE_WRITE', message: 'Conflict.', fieldErrors: [] }, 409);
      return true;
    }
    return false;
  });

  await page.goto('/organizer/public-content');
  await page.getByRole('button', { name: 'Xem và chỉnh sửa' }).click();
  const title = page.getByLabel('Tiêu đề *');
  await title.fill('Tiêu đề tôi đang chỉnh sửa');
  await page.getByRole('button', { name: 'Lưu cập nhật' }).click();

  await expect(page.getByRole('alert')).toContainText('Phiên bản dữ liệu mới nhất đã được tải');
  await expect(title).toHaveValue('Tiêu đề tôi đang chỉnh sửa');
  expect(detailReads).toBe(2);
});

test('search status and sort are sent as independent server-owned filters', async ({ page }) => {
  let latestQuery = new URLSearchParams();
  await mockOrganizerShell(page, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/organizer/heritages') {
      latestQuery = url.searchParams;
      await json(route, pageResponse([]));
      return true;
    }
    return false;
  });

  await page.goto('/organizer/public-content');
  await page.getByRole('textbox', { name: 'Tìm nội dung di sản' }).fill('Bưu điện');
  await page.getByRole('combobox', { name: 'Lọc trạng thái di sản' }).selectOption('PUBLISHED');
  await page.getByRole('combobox', { name: 'Sắp xếp di sản' }).selectOption('title,asc');

  await expect.poll(() => ({
    search: latestQuery.get('search'),
    status: latestQuery.get('status'),
    sort: latestQuery.get('sort'),
  })).toEqual({
    search: 'Bưu điện',
    status: 'PUBLISHED',
    sort: 'title,asc',
  });
});

test('Heritage management remains reachable and usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockOrganizerShell(page, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/organizer/heritages') {
      await json(route, pageResponse([heritageItem(9, 'PUBLISHED', 'Di sản trên điện thoại')]));
      return true;
    }
    return false;
  });

  await page.goto('/organizer');
  await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
  await page.getByRole('button', { name: 'Di sản', exact: true }).click();
  await expect(page).toHaveURL(/\/organizer\/public-content$/);
  await expect(page.getByRole('heading', { name: 'Nội dung di sản', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
