import { expect, Page, test } from '@playwright/test';

interface Credentials {
  username: string;
  password: string;
}

test.skip(
  process.env.E2E_LIVE !== 'true'
    || !process.env.E2E_ORGANIZER_USERNAME
    || !process.env.E2E_ORGANIZER_PASSWORD
    || !process.env.E2E_PARTNER_USERNAME
    || !process.env.E2E_PARTNER_PASSWORD,
  'Đặt E2E_LIVE=true và khai báo đủ credential Organizer/Partner để chạy integration với backend thật.',
);

interface ApiResult<T> {
  status: number;
  body: T;
}

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:8080/api/v1';

function requireCredentials(prefix: 'ORGANIZER' | 'PARTNER'): Credentials {
  const username = process.env[`E2E_${prefix}_USERNAME`];
  const password = process.env[`E2E_${prefix}_PASSWORD`];
  if (!username || !password) {
    throw new Error(`Thiếu E2E_${prefix}_USERNAME hoặc E2E_${prefix}_PASSWORD.`);
  }
  return { username, password };
}

async function browserApi<T>(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  path: string,
  data?: unknown,
): Promise<ApiResult<T>> {
  return page.evaluate(async ({ apiBase, requestMethod, requestPath, requestData }) => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (requestData !== undefined) headers['Content-Type'] = 'application/json';

    if (requestMethod !== 'GET') {
      const csrfResponse = await fetch(`${apiBase}/auth/csrf`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const csrf = await csrfResponse.json() as { headerName: string; token: string };
      headers[csrf.headerName] = csrf.token;
    }

    const response = await fetch(`${apiBase}${requestPath}`, {
      method: requestMethod,
      credentials: 'include',
      headers,
      body: requestData === undefined ? undefined : JSON.stringify(requestData),
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`${requestMethod} ${requestPath} failed (${response.status}): ${text}`);
    }
    return { status: response.status, body };
  }, { apiBase: apiBaseUrl, requestMethod: method, requestPath: path, requestData: data }) as Promise<ApiResult<T>>;
}

async function loginOrganizer(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/portal');
  await page.locator('#portal-username').fill(credentials.username);
  await page.locator('#portal-password').fill(credentials.password);
  await page.getByRole('button', { name: 'Đăng nhập vào Cổng Quản Lý' }).click();
  await expect(page.getByRole('button', { name: 'Sự kiện', exact: true })).toBeVisible();
}

async function loginPartner(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/partner');
  await page.locator('#partner-username').fill(credentials.username);
  await page.locator('#partner-password').fill(credentials.password);
  await page.getByRole('button', { name: 'Đăng nhập vào Cổng Đối tác' }).click();
  await expect(page.getByRole('button', { name: 'Hồ sơ tài khoản' })).toBeVisible();
}

async function selectOrganizerEvent(page: Page, eventName: string): Promise<void> {
  await page.getByRole('button', { name: 'Sự kiện', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Danh sách sự kiện' })).toBeVisible();
  await page.getByPlaceholder('Tìm tên sự kiện...').fill(eventName);
  const eventCard = page.locator('.organizer-card').filter({ hasText: eventName });
  await expect(eventCard).toBeVisible();
  await eventCard.getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('heading', { name: eventName, exact: true })).toBeVisible();
}

function futureIso(daysFromNow: number, hour: number): string {
  const value = new Date();
  value.setDate(value.getDate() + daysFromNow);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
}

test('Sprint 2 real FE-BE map flow persists coordinates and creates a price-locked active BoothHold', async ({ browser }) => {
  test.setTimeout(300_000);

  const organizerCredentials = requireCredentials('ORGANIZER');
  const partnerCredentials = requireCredentials('PARTNER');
  const unique = Date.now();
  const eventName = `Sprint 2 integration ${unique}`;
  const boothCode = `E2E-${String(unique).slice(-8)}`;
  const boothName = `Gian kiểm thử ${unique}`;
  const requestNote = `Yêu cầu Sprint 2 ${unique}`;
  const rentalPrice = '2750000';

  const organizerContext = await browser.newContext();
  const partnerContext = await browser.newContext();
  const organizerPage = await organizerContext.newPage();
  const partnerPage = await partnerContext.newPage();
  organizerPage.setDefaultTimeout(15_000);
  partnerPage.setDefaultTimeout(15_000);

  try {
    await loginOrganizer(organizerPage, organizerCredentials);
    const eventResult = await browserApi<{ eventId: number }>(organizerPage, 'POST', '/organizer/events', {
      name: eventName,
      description: 'Fixture cho kiểm thử tích hợp Sprint 2.',
      startAt: futureIso(90, 9),
      endAt: futureIso(91, 17),
      partnerApplicationDeadlineAt: futureIso(10, 9),
      boothRequestDeadlineAt: futureIso(20, 9),
      activityProposalDeadlineAt: futureIso(20, 10),
      participantRegistrationDeadlineAt: futureIso(50, 9),
      partnerWithdrawalCutoffAt: futureIso(30, 9),
      boothCancellationCutoffAt: futureIso(40, 9),
      activityCancellationCutoffAt: futureIso(40, 10),
      boothPaymentWindowMinutes: 1440,
      maxBoothsPerPartner: 2,
      maxActivitiesPerPartner: 2,
      bannerUrl: null,
    });
    const eventId = eventResult.body.eventId;
    await browserApi(organizerPage, 'POST', `/organizer/events/${eventId}/publish`, {});

    await loginPartner(partnerPage, partnerCredentials);
    await browserApi(partnerPage, 'PUT', '/partner/organization', {
      name: 'Demo Partner',
      description: 'Đối tác dùng cho kiểm thử tự động.',
      categoryCode: 'PUBLISHER',
      logoUrl: null,
      contactEmail: 'partner.e2e@example.test',
      contactPhone: '0900000000',
      address: 'Đường Sách TP.HCM',
    });
    const applicationResult = await browserApi<{ applicationId: number }>(
      partnerPage,
      'POST',
      `/events/${eventId}/applications`,
      { applicationNote: `Approved fixture ${unique}` },
    );
    await browserApi(
      organizerPage,
      'POST',
      `/organizer/applications/${applicationResult.body.applicationId}/approve`,
      { reviewNote: 'Đủ điều kiện kiểm thử Sprint 2.' },
    );

    await organizerPage.reload();
    await selectOrganizerEvent(organizerPage, eventName);
    await organizerPage.getByRole('button', { name: 'Yêu cầu gian hàng', exact: true }).click();
    await expect(organizerPage.getByRole('heading', { name: 'Sơ đồ & Quản lý vị trí gian hàng' })).toBeVisible();

    await organizerPage.getByRole('button', { name: 'Thêm gian hàng' }).click();
    await organizerPage.getByPlaceholder('Ví dụ: A01, B02, C10').fill(boothCode);
    await organizerPage.getByPlaceholder(/Ví dụ: Gian Hàng A01/).fill(boothName);
    await organizerPage.getByPlaceholder('Mô tả diện tích gian, lối đi, mái che, khu vực xung quanh...').fill('Gian hàng được tạo từ Playwright với backend thật.');
    await organizerPage.getByRole('button', { name: 'Thêm gian hàng', exact: true }).click();
    await expect(organizerPage.getByRole('status')).toContainText('Đã tạo gian hàng');
    await expect(organizerPage.getByText(boothCode, { exact: true })).toBeVisible();

    await organizerPage.getByRole('button', { name: /Sơ đồ bản đồ gian hàng/ }).click();
    const mapLayer = organizerPage.locator('.booth-map-image-layer');
    const createdMarker = organizerPage.getByRole('button', { name: new RegExp(`${boothCode}.*Còn trống`) });
    await expect(createdMarker).toBeVisible();
    const mapBox = await mapLayer.boundingBox();
    const markerBox = await createdMarker.boundingBox();
    expect(mapBox).not.toBeNull();
    expect(markerBox).not.toBeNull();
    await organizerPage.mouse.move(markerBox!.x + markerBox!.width / 2, markerBox!.y + markerBox!.height / 2);
    await organizerPage.mouse.down();
    await organizerPage.mouse.move(mapBox!.x + mapBox!.width * 0.625, mapBox!.y + mapBox!.height * 0.48, { steps: 8 });
    await organizerPage.mouse.up();
    await organizerPage.getByRole('button', { name: 'Lưu sơ đồ' }).click();
    await expect(organizerPage.getByRole('status')).toContainText('Đã lưu thành công tọa độ 1 gian hàng');

    await organizerPage.reload();
    await selectOrganizerEvent(organizerPage, eventName);
    await organizerPage.getByRole('button', { name: 'Yêu cầu gian hàng', exact: true }).click();
    const persistedMarker = organizerPage.getByRole('button', { name: new RegExp(`${boothCode}.*Còn trống`) });
    await expect(persistedMarker).toBeVisible();

    const boothPage = await browserApi<{
      content: Array<{ boothId: number; code: string; mapX: number | null; mapY: number | null }>;
    }>(organizerPage, 'GET', '/organizer/booths?page=0&size=100&sort=createdAt,desc');
    const persistedBooth = boothPage.body.content.find(booth => booth.code === boothCode);
    expect(persistedBooth?.mapX).not.toBe(50);
    expect(persistedBooth?.mapY).not.toBe(50);
    expect(persistedBooth?.mapX).toBeGreaterThanOrEqual(0);
    expect(persistedBooth?.mapX).toBeLessThanOrEqual(100);
    expect(persistedBooth?.mapY).toBeGreaterThanOrEqual(0);
    expect(persistedBooth?.mapY).toBeLessThanOrEqual(100);
    await expect(persistedMarker).toHaveAttribute(
      'style',
      new RegExp(`left: ${persistedBooth!.mapX}%; top: ${persistedBooth!.mapY}%`),
    );

    await organizerPage.getByRole('button', { name: /Cấu hình sự kiện/ }).click();
    let configRow = organizerPage.locator('.s2-config-row').filter({ hasText: boothCode });
    await expect(configRow).toBeVisible();
    const rentalPriceInput = configRow.locator('input[type="number"]');
    await rentalPriceInput.fill(rentalPrice);
    await rentalPriceInput.press('Tab');
    await expect(organizerPage.getByRole('status')).toContainText(`Đã cập nhật giá thuê cho ${boothCode}`);
    await browserApi(
      organizerPage,
      'PUT',
      `/organizer/events/${eventId}/booth-configs/${persistedBooth!.boothId}`,
      { rentalPrice: Number(rentalPrice), enabled: true },
    );

    await organizerPage.reload();
    await selectOrganizerEvent(organizerPage, eventName);
    await organizerPage.getByRole('button', { name: 'Yêu cầu gian hàng', exact: true }).click();
    await organizerPage.getByRole('button', { name: /Cấu hình sự kiện/ }).click();
    configRow = organizerPage.locator('.s2-config-row').filter({ hasText: boothCode });
    await expect(configRow.locator('input[type="number"]')).toHaveValue(rentalPrice);
    await expect(configRow.getByRole('checkbox')).toBeChecked();
    await expect(configRow.getByText('Còn trống', { exact: true })).toBeVisible();

    await partnerPage.reload();
    await partnerPage.getByRole('button', { name: 'Chọn và thuê gian hàng', exact: true }).click();
    await expect(partnerPage.getByRole('heading', { name: 'Chọn và thuê gian hàng' })).toBeVisible();
    const eventPicker = partnerPage.getByLabel('Sự kiện tham gia');
    if (await eventPicker.isVisible()) {
      await eventPicker.selectOption({ label: eventName });
    }
    const partnerMarker = partnerPage.locator('.booth-map-marker.status-available').filter({ hasText: boothCode });
    await expect(partnerMarker).toBeVisible();
    await partnerMarker.click();
    const boothRequestModal = partnerPage.locator('.s2-booth-request-modal');
    await expect(boothRequestModal).toContainText(boothName);
    await expect(boothRequestModal).toContainText('2.750.000');
    await partnerPage.getByLabel('Ghi chú gửi Ban tổ chức').fill(requestNote);
    await partnerPage.getByRole('button', { name: 'Gửi yêu cầu thuê / đổi gian' }).click();
    await expect(partnerPage.getByRole('status')).toContainText('Đã gửi yêu cầu');
    await expect(partnerPage.getByText('Chờ duyệt', { exact: true })).toBeVisible();

    const pendingAvailability = await browserApi<{
      content: Array<{ booth: { code: string }; availability: string }>;
    }>(partnerPage, 'GET', `/events/${eventId}/booths?page=0&size=100`);
    expect(pendingAvailability.body.content.find(row => row.booth.code === boothCode)?.availability).toBe('AVAILABLE');
    await partnerPage.getByRole('tab', { name: /Sơ đồ gian hàng/ }).click();
    await expect(partnerPage.locator('.booth-map-marker.status-available').filter({ hasText: boothCode })).toBeVisible();

    await organizerPage.getByRole('button', { name: /Duyệt yêu cầu thuê gian hàng/ }).click();
    await organizerPage.getByRole('button', { name: 'Làm mới danh sách' }).click();
    const requestCard = organizerPage.locator('.s2-request-card').filter({ hasText: requestNote });
    await expect(requestCard.getByText('Chờ duyệt', { exact: true })).toBeVisible();
    organizerPage.once('dialog', dialog => dialog.accept());
    await requestCard.getByRole('button', { name: 'Duyệt & Cấp giữ chỗ' }).click();
    await expect(organizerPage.getByRole('status')).toContainText(`Đã duyệt chọn gian "${boothCode}" cho "Demo Partner"`);
    await expect(requestCard.getByText('Đã chọn / Giữ chỗ', { exact: true })).toBeVisible();
    await expect(requestCard).toContainText('2.750.000');

    await partnerPage.getByRole('button', { name: 'Làm mới' }).click();
    await partnerPage.getByRole('tab', { name: /Yêu cầu của tôi/ }).click();
    await expect(partnerPage.getByText('Đã được chọn', { exact: true })).toBeVisible();
    await expect(partnerPage.getByText('Giá thuê được giữ nguyên theo thời điểm duyệt', { exact: true })).toBeVisible();
    await expect(partnerPage.getByText('Thời gian còn lại', { exact: true })).toBeVisible();
    await expect(partnerPage.getByTestId('booth-payment-checkout-card')).toContainText('2.750.000');

    const heldAvailability = await browserApi<{
      content: Array<{ booth: { code: string }; availability: string }>;
    }>(partnerPage, 'GET', `/events/${eventId}/booths?page=0&size=100`);
    expect(heldAvailability.body.content.find(row => row.booth.code === boothCode)?.availability).toBe('ON_HOLD');
    await partnerPage.getByRole('tab', { name: /Sơ đồ gian hàng/ }).click();
    await expect(partnerPage.locator('.booth-map-marker.status-on_hold').filter({ hasText: boothCode })).toBeVisible();

  } finally {
    await organizerContext.close();
    await partnerContext.close();
  }
});
