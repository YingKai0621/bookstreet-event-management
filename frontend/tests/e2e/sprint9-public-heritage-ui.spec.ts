import { expect, test, type Page, type Route } from '@playwright/test';

const heritageListItem = {
  publicCode: 'NVB-BOOK-STREET',
  title: 'Đường Sách Nguyễn Văn Bình',
  summary: 'Không gian văn hóa đọc giữa lòng Thành phố Hồ Chí Minh.',
  imageUrl: 'https://example.test/book-street.jpg',
  locationText: 'Nguyễn Văn Bình, Quận 1',
  publishedAt: '2026-11-01T02:00:00Z',
};

const heritageDetail = {
  ...heritageListItem,
  content: 'Đường Sách là nơi kết nối bạn đọc, tác giả và các đơn vị xuất bản.\n\nKhông gian này lưu giữ nhiều câu chuyện văn hóa đọc.',
};

function pageResponse<T>(content: T[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockPublicHeritage(page: Page, detailStatus = 200, list = [heritageListItem]) {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) return json(route, {}, 401);
    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'heritage-csrf' });
    }
    if (path === '/api/v1/heritages') return json(route, pageResponse(list));
    if (path === '/api/v1/heritages/NVB-BOOK-STREET') {
      if (detailStatus === 404) {
        return json(route, { code: 'HERITAGE_NOT_FOUND', message: 'Not found.', fieldErrors: [] }, 404);
      }
      return json(route, heritageDetail);
    }
    return json(route, pageResponse([]));
  });
}

test('landing carousel keeps navigation available for exactly three heritage stories', async ({ page }) => {
  const stories = [
    heritageListItem,
    { ...heritageListItem, publicCode: 'NHA-THO-DUC-BA', title: 'Nhà thờ Đức Bà Sài Gòn' },
    { ...heritageListItem, publicCode: 'BUU-DIEN-THANH-PHO', title: 'Bưu điện Thành phố Hồ Chí Minh' },
  ];
  await mockPublicHeritage(page, 200, stories);
  await page.goto('/');

  const next = page.getByRole('button', { name: 'Di tích tiếp theo' });
  await expect(next).toBeVisible();
  await expect(page.getByText(/\/ 3 di sản$/)).toBeVisible();
  const currentCard = page.locator('.heritage-fan-card[aria-current="true"]');
  await expect(currentCard).toHaveCount(1);
  const firstHref = await currentCard.getAttribute('href');

  await next.click();

  await expect.poll(() => currentCard.getAttribute('href')).not.toBe(firstHref);
  await expect(page).toHaveURL(/\/$/);

  const sideCard = page.locator('.heritage-fan-card:not([aria-current="true"])').first();
  const sideHref = await sideCard.getAttribute('href');
  expect(sideHref).toBeTruthy();
  await sideCard.dispatchEvent('click');
  await expect(page).toHaveURL(/\/$/);

  const newlyCenteredCard = page.locator(`.heritage-fan-card[href="${sideHref}"]`);
  await expect(newlyCenteredCard).toHaveAttribute('aria-current', 'true');
  await newlyCenteredCard.dispatchEvent('click');
  await expect(page).toHaveURL(new RegExp(`${sideHref}$`));
});

test('public heritage collection opens a story backed by the Heritage API', async ({ page }) => {
  await mockPublicHeritage(page);
  await page.goto('/di-san');

  await expect(page.getByRole('heading', { name: 'Mỗi địa danh là một câu chuyện' })).toBeVisible();
  await expect(page.getByText('1 nội dung')).toBeVisible();
  await page.locator('.heritage-collection-card').click();

  await expect(page).toHaveURL(/\/di-san\/NVB-BOOK-STREET$/);
  await expect(page.getByRole('heading', { name: heritageDetail.title, level: 1 })).toBeVisible();
  await expect(page.getByText('Đường Sách là nơi kết nối bạn đọc, tác giả và các đơn vị xuất bản.')).toBeVisible();
  await expect(page.locator('.heritage-qr-code')).toHaveCount(0);
  await expect(page.getByText('NVB-BOOK-STREET')).toHaveCount(0);
});

test('direct heritage links load independently and unpublished content has a clear state', async ({ page }) => {
  await mockPublicHeritage(page, 404);
  await page.goto('/di-san/NVB-BOOK-STREET');

  await expect(page.getByRole('heading', { name: 'Không tìm thấy nội dung di sản' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Về danh mục di sản' })).toHaveAttribute('href', '/di-san');
});

test('heritage collection distinguishes API failure from an empty collection', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return json(route, {}, 401);
    if (path.endsWith('/auth/csrf')) {
      return json(route, { headerName: 'X-CSRF-TOKEN', token: 'heritage-error-csrf' });
    }
    if (path === '/api/v1/heritages') {
      return json(route, { code: 'INTERNAL_ERROR', message: 'Unavailable.', fieldErrors: [] }, 500);
    }
    return json(route, pageResponse([]));
  });

  await page.goto('/di-san');
  await expect(page.getByRole('heading', { name: 'Chưa thể tải nội dung di sản' })).toBeVisible();
  await expect(page.getByText('Chưa có nội dung di sản được công bố')).toHaveCount(0);
});
