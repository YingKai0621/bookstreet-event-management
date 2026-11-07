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

function requireCredentials(
  usernameVariable: string,
  passwordVariable: string,
  accountLabel: string,
): Credentials {
  const username = process.env[usernameVariable];
  const password = process.env[passwordVariable];

  if (!username || !password) {
    throw new Error(
      `Thiếu ${usernameVariable} hoặc ${passwordVariable}. `
      + `Hãy khai báo tài khoản ${accountLabel} cục bộ trong file .env ở thư mục gốc.`,
    );
  }

  return { username, password };
}

function futureDateTimeLocal(daysFromNow: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);

  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

async function fillDateTime(page: Page, label: string, value: string): Promise<void> {
  const [date, time] = value.split('T');
  await page.getByLabel(`${label} - ngày`).fill(date);
  await page.getByLabel(`${label} - giờ`).fill(time);
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

async function createPublishedEvent(page: Page, eventName: string): Promise<void> {
  await page.getByRole('button', { name: 'Sự kiện', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Danh sách sự kiện' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo sự kiện mới' }).click();

  await page.getByLabel('Tên sự kiện *').fill(eventName);
  await page.getByLabel('Mô tả').fill('Sự kiện kiểm thử luồng đăng ký của Partner.');
  await fillDateTime(page, 'Bắt đầu', futureDateTimeLocal(90, 9));
  await page.getByLabel('Thời lượng sự kiện').selectOption('PLUS_ONE_DAY');
  await fillDateTime(page, 'Hạn đối tác đăng ký', futureDateTimeLocal(10, 9));
  await fillDateTime(page, 'Hạn yêu cầu gian hàng', futureDateTimeLocal(20, 9));
  await fillDateTime(page, 'Hạn đề xuất hoạt động', futureDateTimeLocal(20, 10));
  await fillDateTime(page, 'Hạn người tham gia đăng ký', futureDateTimeLocal(50, 9));
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();

  await expect(page.getByRole('heading', { name: eventName })).toBeVisible();
  await page.getByRole('button', { name: 'Công bố', exact: true }).click();
  await expect(page.getByText('Đã công bố').first()).toBeVisible();
  await page.getByRole('button', { name: 'Quay lại danh sách sự kiện' }).click();
}

async function savePartnerOrganization(page: Page, organizationName: string): Promise<void> {
  await page.getByRole('button', { name: 'Hồ sơ tài khoản' }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ tổ chức & Cài đặt', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();

  await page.getByLabel('Tên tổ chức *').fill(organizationName);
  await page.getByLabel('Mô tả').fill('Tổ chức được cập nhật trong kiểm thử E2E.');
  await page.getByLabel('Mã loại hình *').fill('PUBLISHER');
  await page.getByLabel('Email liên hệ').fill('partner.e2e@example.com');
  await page.getByLabel('Số điện thoại liên hệ').fill('0900000000');
  await page.getByLabel('Địa chỉ').fill('Đường Sách TP.HCM');
  await page.getByRole('button', { name: /Lưu thay đổi|Tạo hồ sơ tổ chức/ }).click();

  await expect(page.getByRole('status')).toContainText(/Đã lưu thay đổi|Đã tạo/);
}

async function submitApplication(page: Page, eventName: string, note: string): Promise<void> {
  await page.getByRole('button', { name: 'Khám phá & đăng ký' }).click();
  const eventCard = page.locator('article').filter({ hasText: eventName }).first();
  await expect(eventCard).toBeVisible();
  await eventCard.getByRole('button', { name: /Xem & đăng ký/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Ghi chú đăng ký (không bắt buộc)').fill(note);
  await dialog.getByRole('button', { name: 'Gửi hồ sơ đăng ký' }).click();
  await expect(page.getByRole('status')).toContainText('Gửi hồ sơ đăng ký thành công');
  await page.getByRole('link', { name: /Xem hồ sơ của tôi/ }).click();
  await expect(page.locator('article').filter({ hasText: eventName }).getByText('Chờ duyệt')).toBeVisible();
}

test('Partner submits, withdraws, and receives Organizer approval', async ({ browser }) => {
  test.setTimeout(150_000);

  const organizerCredentials = requireCredentials(
    'E2E_ORGANIZER_USERNAME',
    'E2E_ORGANIZER_PASSWORD',
    'ORGANIZER',
  );
  const partnerCredentials = requireCredentials(
    'E2E_PARTNER_USERNAME',
    'E2E_PARTNER_PASSWORD',
    'PARTNER',
  );

  const uniqueSuffix = Date.now();
  const approvalEventName = `Partner approval E2E ${uniqueSuffix}`;
  const withdrawalEventName = `Partner withdrawal E2E ${uniqueSuffix}`;
  const organizationName = `E2E Publisher ${uniqueSuffix}`;

  const organizerContext = await browser.newContext();
  const partnerContext = await browser.newContext();
  const organizerPage = await organizerContext.newPage();
  const partnerPage = await partnerContext.newPage();

  try {
    await loginOrganizer(organizerPage, organizerCredentials);
    await createPublishedEvent(organizerPage, approvalEventName);
    await createPublishedEvent(organizerPage, withdrawalEventName);

    await loginPartner(partnerPage, partnerCredentials);
    await savePartnerOrganization(partnerPage, organizationName);
    await partnerPage.getByRole('button', { name: 'Hồ sơ sự kiện của tôi' }).click();
    await expect(partnerPage.getByRole('heading', { name: 'Hồ sơ sự kiện của tôi' })).toBeVisible();

    await submitApplication(partnerPage, approvalEventName, 'Hồ sơ dùng để kiểm thử thao tác duyệt.');
    await submitApplication(partnerPage, withdrawalEventName, 'Hồ sơ dùng để kiểm thử thao tác rút.');

    const withdrawalApplication = partnerPage.locator('article').filter({
      hasText: withdrawalEventName,
    }).last();
    await withdrawalApplication.getByRole('button', { name: 'Rút hồ sơ' }).click();
    await partnerPage.getByRole('dialog').getByRole('button', { name: 'Xác nhận rút hồ sơ' }).click();
    await expect(partnerPage.getByRole('status')).toContainText('Đã rút hồ sơ');
    await expect(withdrawalApplication.getByText('Đã rút')).toBeVisible();

    await organizerPage.getByPlaceholder('Tìm tên sự kiện...').fill(approvalEventName);
    const eventRow = organizerPage.locator('.organizer-card').filter({ hasText: approvalEventName });
    await eventRow.getByRole('button', { name: 'Xem' }).click();
    await organizerPage.getByRole('button', { name: /Hồ sơ đối tác/ }).click();

    const applicationRow = organizerPage.locator('tr').filter({
      hasText: 'Hồ sơ dùng để kiểm thử thao tác duyệt.',
    });
    await expect(applicationRow).toContainText('Chờ duyệt');
    organizerPage.once('dialog', dialog => dialog.accept('Hồ sơ phù hợp với sự kiện.'));
    await applicationRow.getByRole('button', { name: 'Duyệt' }).click();
    await expect(applicationRow).toContainText('Đã duyệt');
    await expect(applicationRow).toContainText('Hồ sơ phù hợp với sự kiện.');

    await partnerPage.getByRole('button', { name: 'Làm mới' }).click();
    await partnerPage.getByRole('tab', { name: /Đã duyệt/ }).click();
    const approvedApplication = partnerPage.locator('article').filter({
      hasText: approvalEventName,
    }).last();
    await expect(approvedApplication.getByText('Đã duyệt')).toBeVisible();
    await expect(approvedApplication).toContainText('Hồ sơ phù hợp với sự kiện.');
  } finally {
    await organizerContext.close();
    await partnerContext.close();
  }
});
