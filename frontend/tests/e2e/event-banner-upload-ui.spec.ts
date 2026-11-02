import { expect, test } from '@playwright/test';

test('Organizer uploads a local banner before creating the Event', async ({ page }) => {
  let uploaded = false;
  let createdBannerUrl: string | null | undefined;
  let createdRequest: Record<string, unknown> | null = null;

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const fulfill = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path.endsWith('/auth/me')) return fulfill({ userId: 1, username: 'organizer', fullName: 'Organizer Demo', email: 'organizer@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'ORGANIZER'] });
    if (path.endsWith('/auth/csrf')) return fulfill({ headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path.endsWith('/organizer/dashboard')) return fulfill({ activeEventCount: 0, pendingPartnerApplicationCount: 0, pendingBoothRequestCount: 0, eventStatusCounts: {}, partnerApplicationStatusCounts: {}, priorityTasks: [] });
    if (path.endsWith('/organizer/event-banners') && method === 'POST') {
      expect(request.headers()['content-type']).toContain('multipart/form-data');
      expect(request.headers()['x-csrf-token']).toBe('test-token');
      uploaded = true;
      return fulfill({ url: '/api/v1/media/event-banners/11111111-1111-4111-8111-111111111111.png' }, 201);
    }
    if (path.endsWith('/organizer/events') && method === 'POST') {
      const body = request.postDataJSON() as { bannerUrl?: string | null; name: string };
      createdRequest = body;
      createdBannerUrl = body.bannerUrl;
      return fulfill({
        ...body,
        eventId: 701,
        organizerUserId: 1,
        status: 'DRAFT',
        createdAt: '2026-10-29T00:00:00Z',
        updatedAt: '2026-10-29T00:00:00Z',
      }, 201);
    }
    if (path.endsWith('/organizer/events') && method === 'GET') return fulfill({ content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
    if (path.endsWith('/organizer/notifications')) return fulfill([]);
    if (path.includes('/booths') || path.includes('/venues') || path.includes('/heritages')) return fulfill([]);
    return fulfill({ code: 'TEST_ROUTE_NOT_MOCKED', message: `${method} ${path}` }, 404);
  });

  await page.goto('/organizer/events');
  await page.getByRole('button', { name: 'Tạo sự kiện mới' }).first().click();
  await page.getByLabel('Tên sự kiện *').fill('Sự kiện có banner tải lên');
  const startAtInput = page.getByLabel('Bắt đầu - ngày');
  await page.locator('.org-event-form-label').filter({ hasText: 'Bắt đầu' }).click();
  await expect(startAtInput).not.toBeFocused();
  await expect(startAtInput).toHaveAttribute('min', /\d{4}-\d{2}-\d{2}/);
  await startAtInput.locator('..').click();
  await expect(startAtInput).toBeFocused();
  await startAtInput.fill('2020-01-01');
  await expect(startAtInput).toHaveJSProperty('validity.rangeUnderflow', true);
  await startAtInput.fill('2027-05-10');
  const startTimeInput = page.getByLabel('Bắt đầu - giờ');
  await startTimeInput.fill('09:17');
  await startTimeInput.fill('50:00');
  await expect(startTimeInput).toHaveValue('09:17');
  await page.locator('.org-event-form-label').filter({ hasText: 'Thời lượng sự kiện' }).click();
  await expect(page.getByLabel('Thời lượng sự kiện')).not.toBeFocused();
  await page.getByLabel('Thời lượng sự kiện').selectOption('PLUS_ONE_DAY');
  await expect(page.getByText('11/05/2027 lúc 09:17')).toBeVisible();
  await page.getByRole('button', { name: /Mốc thời hạn/ }).click();
  const partnerDeadlineInput = page.getByLabel('Hạn đối tác đăng ký - ngày');
  await page.locator('.org-event-form-label').filter({ hasText: 'Hạn đối tác đăng ký' }).click();
  await expect(partnerDeadlineInput).not.toBeFocused();
  await expect(partnerDeadlineInput).toHaveAttribute('min', /\d{4}-\d{2}-\d{2}/);
  await expect(partnerDeadlineInput).toHaveAttribute('max', '2027-05-10');
  await expect(page.getByLabel('Mẫu lịch trình')).toHaveValue('STANDARD');
  await page.getByLabel('Mẫu lịch trình').selectOption('COMPACT');
  await page.getByRole('button', { name: 'Tạo lịch trình', exact: true }).click();
  await expect(partnerDeadlineInput).toHaveValue('2027-04-30');
  await page.getByLabel('Mẫu lịch trình').selectOption('EXTENDED');
  await page.getByRole('button', { name: 'Tạo lịch trình', exact: true }).click();
  await expect(partnerDeadlineInput).toHaveValue('2027-03-15');
  await page.getByLabel('Mẫu lịch trình').selectOption('STANDARD');
  await page.getByRole('button', { name: 'Tạo lịch trình', exact: true }).click();
  await expect(partnerDeadlineInput).toHaveValue('2027-04-12');
  await expect(partnerDeadlineInput.locator('..').getByText('12/04/2027')).toBeVisible();
  await expect(page.getByLabel('Hạn yêu cầu gian hàng - ngày')).toHaveValue('2027-04-19');

  await page.getByLabel('Số gian hàng tối đa / đối tác').fill('0');
  await page.getByLabel('Số hoạt động tối đa / đối tác').fill('0');
  await expect(page.getByLabel('Hạn yêu cầu gian hàng - ngày')).toHaveCount(0);
  await expect(page.getByLabel('Hạn đề xuất hoạt động - ngày')).toHaveCount(0);
  await expect(page.getByLabel('Thời hạn giữ chỗ gian hàng')).toHaveCount(0);
  await page.getByLabel('Số gian hàng tối đa / đối tác').fill('1');
  await page.getByLabel('Số hoạt động tối đa / đối tác').fill('1');

  await expect(page.getByLabel('Hạn yêu cầu gian hàng - ngày')).toHaveAttribute('min', '2027-04-13');
  await expect(page.getByLabel('Hạn đề xuất hoạt động - ngày')).toHaveAttribute('min', '2027-04-13');
  await page.getByLabel('Hạn yêu cầu gian hàng - ngày').fill('2027-04-12');
  await expect(page.getByText('Phải sau hạn đối tác đăng ký ít nhất 24 giờ để Ban tổ chức có thời gian duyệt hồ sơ.')).toBeVisible();
  await expect(page.getByText('1 mốc cần sửa trước khi công bố')).toBeVisible();
  await partnerDeadlineInput.fill('2027-04-15');
  await expect(page.getByLabel('Hạn yêu cầu gian hàng - ngày')).toHaveValue('2027-04-16');
  await expect(page.getByLabel('Hạn yêu cầu gian hàng - ngày')).toHaveAttribute('min', '2027-04-16');
  await partnerDeadlineInput.fill('2027-04-12');
  await page.getByLabel('Hạn yêu cầu gian hàng - ngày').fill('2027-04-19');
  await expect(page.getByText('Phải sau hạn đối tác đăng ký ít nhất 24 giờ để Ban tổ chức có thời gian duyệt hồ sơ.')).toHaveCount(0);
  await page.getByLabel('Ảnh banner', { exact: true }).setInputFiles({
    name: 'banner-demo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });

  const cropDialog = page.getByRole('dialog', { name: 'Căn chỉnh ảnh sự kiện' });
  await expect(cropDialog).toBeVisible();
  await cropDialog.getByRole('button', { name: 'Lưu vị trí ảnh' }).click();
  await expect(cropDialog).toHaveCount(0);
  await expect(page.getByAltText('Xem trước banner sự kiện')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByText('banner-demo-cropped.png')).toBeVisible();
  await page.getByRole('button', { name: /Căn chỉnh vị trí/ }).click();
  await expect(cropDialog).toBeVisible();
  await expect(cropDialog.getByRole('alert')).toHaveCount(0);
  await cropDialog.getByRole('button', { name: 'Hủy', exact: true }).click();

  await page.getByLabel('Hạn yêu cầu gian hàng - ngày').fill('2027-05-10');
  await page.getByLabel('Hạn yêu cầu gian hàng - giờ').fill('09:17');
  await expect(page.getByText('Hạn yêu cầu gian hàng cộng thời gian thanh toán phải kết thúc trước sự kiện ít nhất 24 giờ để chuẩn bị gian hàng.')).toBeVisible();
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();

  await expect.poll(() => uploaded).toBe(true);
  await expect.poll(() => createdBannerUrl).toBe('/api/v1/media/event-banners/11111111-1111-4111-8111-111111111111.png');
  expect(createdRequest).toMatchObject({
    startAt: new Date('2027-05-10T09:17').toISOString(),
    endAt: new Date('2027-05-11T09:17').toISOString(),
    partnerApplicationDeadlineAt: new Date('2027-04-12T09:17').toISOString(),
    boothRequestDeadlineAt: new Date('2027-05-10T09:17').toISOString(),
  });
});

test('Organizer can save non-schedule changes on a legacy draft with past dates', async ({ page }) => {
  const bannerUrl = '/api/v1/media/event-banners/22222222-2222-4222-8222-222222222222.png';
  const draft = {
    eventId: 702,
    organizerUserId: 1,
    name: 'Sự kiện đã có banner tải lên',
    description: 'Mô tả ban đầu',
    startAt: '2020-06-10T02:00:00Z',
    endAt: '2020-06-22T02:00:00Z',
    partnerApplicationDeadlineAt: null,
    boothRequestDeadlineAt: null,
    activityProposalDeadlineAt: null,
    participantRegistrationDeadlineAt: null,
    partnerWithdrawalCutoffAt: null,
    boothCancellationCutoffAt: null,
    activityCancellationCutoffAt: null,
    boothPaymentWindowMinutes: 1440,
    maxBoothsPerPartner: 1,
    maxActivitiesPerPartner: 1,
    bannerUrl,
    status: 'DRAFT',
    createdAt: '2026-10-29T00:00:00Z',
    updatedAt: '2026-10-29T00:00:00Z',
  };
  let updatedBannerUrl: string | null | undefined;
  let updatedDescription: string | null | undefined;

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const fulfill = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path === bannerUrl) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
      });
    }
    if (path.endsWith('/auth/me')) return fulfill({ userId: 1, username: 'organizer', fullName: 'Organizer Demo', email: 'organizer@example.com', emailVerified: true, status: 'ACTIVE', roles: ['PARTICIPANT', 'ORGANIZER'] });
    if (path.endsWith('/auth/csrf')) return fulfill({ headerName: 'X-CSRF-TOKEN', token: 'test-token' });
    if (path.endsWith('/organizer/dashboard')) return fulfill({ activeEventCount: 0, pendingPartnerApplicationCount: 0, pendingBoothRequestCount: 0, eventStatusCounts: {}, partnerApplicationStatusCounts: {}, priorityTasks: [] });
    if (path.endsWith('/organizer/events') && method === 'GET') {
      return fulfill({ content: [draft], page: 0, size: 100, totalElements: 1, totalPages: 1 });
    }
    if (path.endsWith('/organizer/events/702') && method === 'PATCH') {
      const body = request.postDataJSON() as { bannerUrl?: string | null; description?: string | null };
      updatedBannerUrl = body.bannerUrl;
      updatedDescription = body.description;
      return fulfill({ ...draft, ...body, updatedAt: '2026-10-29T01:00:00Z' });
    }
    if (path.endsWith('/organizer/events/702') && method === 'GET') return fulfill(draft);
    if (path.endsWith('/organizer/notifications')) return fulfill([]);
    if (path.includes('/booths') || path.includes('/venues') || path.includes('/heritages')) return fulfill([]);
    return fulfill({ code: 'TEST_ROUTE_NOT_MOCKED', message: `${method} ${path}` }, 404);
  });

  await page.goto('/organizer/events');
  await expect(page.getByText(draft.name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();

  const bannerInput = page.locator('#event-banner-url');
  await expect(page.getByLabel('Thời lượng sự kiện')).toHaveValue('CUSTOM');
  await expect(page.getByLabel('Thời lượng sự kiện').locator('option:checked')).toHaveText('Tùy chỉnh · 12 ngày');
  await expect(page.getByLabel('Bắt đầu - ngày')).not.toHaveAttribute('min');
  await expect(page.getByLabel('Kết thúc - ngày')).not.toHaveAttribute('min');
  await expect(bannerInput).toHaveValue(bannerUrl);
  await expect(bannerInput).toHaveAttribute('type', 'text');
  await expect(bannerInput).toHaveJSProperty('validity.valid', true);

  await page.getByLabel('Mô tả').fill('Mô tả đã chỉnh sửa');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();

  await expect.poll(() => updatedBannerUrl).toBe(bannerUrl);
  await expect.poll(() => updatedDescription).toBe('Mô tả đã chỉnh sửa');
});
