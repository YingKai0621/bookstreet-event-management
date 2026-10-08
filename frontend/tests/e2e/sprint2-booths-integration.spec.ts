import { expect, Page, test } from '@playwright/test';

interface Credentials {
  username: string;
  password: string;
}

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

function futureIso(daysFromNow: number, hour: number): string {
  const value = new Date();
  value.setDate(value.getDate() + daysFromNow);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
}

test('Sprint 2 real FE-BE flow creates a price-locked active BoothHold', async ({ browser }) => {
  test.setTimeout(180_000);

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
    await organizerPage.getByRole('button', { name: 'Yêu cầu gian hàng', exact: true }).click();
    await expect(organizerPage.getByRole('heading', { name: 'Gian hàng & yêu cầu đối tác' })).toBeVisible();
    await organizerPage.getByLabel('Sự kiện đang quản lý').selectOption({ label: eventName });

    await organizerPage.getByRole('button', { name: 'Thêm gian hàng' }).click();
    await organizerPage.getByLabel('Mã gian hàng').fill(boothCode);
    await organizerPage.getByLabel('Tên gian hàng').fill(boothName);
    await organizerPage.getByLabel('Sức chứa').fill('8');
    await organizerPage.getByLabel('Mã danh mục').fill('PUBLISHER');
    await organizerPage.getByLabel('Mô tả').fill('Gian hàng được tạo từ Playwright với backend thật.');
    await organizerPage.getByRole('button', { name: 'Lưu gian hàng' }).click();
    await expect(organizerPage.getByRole('status')).toContainText('Đã tạo gian hàng vật lý');
    await expect(organizerPage.getByText(boothCode, { exact: true })).toBeVisible();

    await organizerPage.getByRole('button', { name: /Cấu hình sự kiện/ }).click();
    const configRow = organizerPage.locator('.s2-config-row').filter({ hasText: boothCode });
    await expect(configRow).toBeVisible();
    await configRow.getByLabel('Giá thuê (VND)').fill(rentalPrice);
    const enabled = configRow.getByRole('checkbox');
    if (!(await enabled.isChecked())) await enabled.check();
    await configRow.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(organizerPage.getByRole('status')).toContainText(`Đã cập nhật cấu hình ${boothCode}`);
    await expect(configRow.getByText('Còn trống', { exact: true })).toBeVisible();

    await partnerPage.reload();
    await partnerPage.getByRole('button', { name: 'Yêu cầu gian hàng', exact: true }).click();
    await expect(partnerPage.getByRole('heading', { name: 'Chọn gian hàng cho sự kiện' })).toBeVisible();
    await partnerPage.getByLabel('Sự kiện đã được duyệt').selectOption({ label: eventName });
    const boothCard = partnerPage.locator('.s2-booth-card').filter({ hasText: boothCode });
    await expect(boothCard.getByText('Còn trống', { exact: true })).toBeVisible();
    await boothCard.getByRole('button', { name: 'Xem & gửi yêu cầu' }).click();
    await partnerPage.getByLabel('Ghi chú cho Organizer (không bắt buộc)').fill(requestNote);
    await partnerPage.getByRole('button', { name: 'Gửi yêu cầu gian hàng' }).click();
    await expect(partnerPage.getByRole('status')).toContainText('Đã gửi yêu cầu');
    await expect(partnerPage.getByText('Chờ duyệt', { exact: true })).toBeVisible();

    await organizerPage.getByRole('button', { name: /Yêu cầu đối tác/ }).click();
    await organizerPage.getByRole('button', { name: 'Làm mới' }).click();
    const requestCard = organizerPage.locator('.s2-request-card').filter({ hasText: requestNote });
    await expect(requestCard.getByText('Chờ duyệt', { exact: true })).toBeVisible();
    organizerPage.once('dialog', dialog => dialog.accept());
    await requestCard.getByRole('button', { name: 'Chọn & giữ chỗ' }).click();
    await expect(organizerPage.getByRole('status')).toContainText('Đã chọn yêu cầu và tạo giữ chỗ');
    await expect(requestCard.getByText('Đã chọn', { exact: true })).toBeVisible();
    await expect(requestCard).toContainText('2.750.000');

    await partnerPage.getByRole('button', { name: 'Làm mới' }).click();
    await expect(partnerPage.getByText('Đã được chọn', { exact: true })).toBeVisible();
    await expect(partnerPage.getByText('Giá đã khóa', { exact: false })).toBeVisible();
    await expect(partnerPage.getByText('Thời gian còn lại', { exact: true })).toBeVisible();
    await expect(partnerPage.locator('.s2-hold-card')).toContainText('2.750.000');
  } finally {
    await organizerContext.close();
    await partnerContext.close();
  }
});
