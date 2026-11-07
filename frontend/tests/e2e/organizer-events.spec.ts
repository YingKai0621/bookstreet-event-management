import { expect, test, type Page } from '@playwright/test';

const organizerUsername = process.env.E2E_ORGANIZER_USERNAME;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD;
const runLiveE2E = process.env.E2E_LIVE === 'true';

test.skip(
  !runLiveE2E || !organizerUsername || !organizerPassword,
  'Đặt E2E_LIVE=true và khai báo credential Organizer để chạy integration với backend thật.',
);

function requireOrganizerCredentials(): { username: string; password: string } {
  if (!organizerUsername || !organizerPassword) {
    throw new Error(
      'Thiếu E2E_ORGANIZER_USERNAME hoặc E2E_ORGANIZER_PASSWORD. '
      + 'Hãy khai báo tài khoản ORGANIZER cục bộ trong file .env ở thư mục gốc.',
    );
  }

  return {
    username: organizerUsername,
    password: organizerPassword,
  };
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

test('organizer creates, completes, and publishes an event', async ({ page }) => {
  const credentials = requireOrganizerCredentials();
  const uniqueEventName = `Playwright E2E ${Date.now()}`;

  const startAt = futureDateTimeLocal(90, 9);
  const invalidEndAt = futureDateTimeLocal(90, 8);
  const endAt = futureDateTimeLocal(91, 17);

  await page.goto('/portal');
  await page.locator('#portal-username').fill(credentials.username);
  await page.locator('#portal-password').fill(credentials.password);
  await page.getByRole('button', { name: 'Đăng nhập vào Cổng Quản Lý' }).click();

  await expect(page.getByRole('button', { name: 'Sự kiện', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sự kiện', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Danh sách sự kiện' })).toBeVisible();

  await page.getByRole('button', { name: 'Tạo sự kiện mới' }).click();
  await expect(page.getByRole('heading', { name: 'Tạo sự kiện mới' })).toBeVisible();

  await page.getByLabel('Tên sự kiện *').fill(uniqueEventName);
  await page.getByLabel('Mô tả').fill('Sự kiện được tạo tự động để kiểm thử luồng Organizer.');
  await fillDateTime(page, 'Bắt đầu', startAt);
  await page.getByLabel('Thời lượng sự kiện').selectOption('CUSTOM');
  await fillDateTime(page, 'Kết thúc', invalidEndAt);
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();

  await expect(page.getByText('Thời gian kết thúc phải sau thời gian bắt đầu.')).toBeVisible();

  await fillDateTime(page, 'Kết thúc', endAt);
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();

  await expect(page.getByRole('heading', { name: uniqueEventName })).toBeVisible();
  await expect(page.getByText('Bản nháp').first()).toBeVisible();

  await page.getByRole('button', { name: 'Công bố', exact: true }).click();
  const incompletePublishDialog = page.getByRole('dialog', { name: 'Chưa thể công bố' });
  await expect(incompletePublishDialog).toBeVisible();
  await expect(incompletePublishDialog.getByText('Hạn đối tác đăng ký chưa được thiết lập.')).toBeVisible();

  await incompletePublishDialog.getByRole('button', { name: 'Chỉnh sửa bản nháp' }).click();
  await expect(page.getByRole('heading', { name: 'Chỉnh sửa bản nháp' })).toBeVisible();

  await fillDateTime(page, 'Hạn đối tác đăng ký', futureDateTimeLocal(10, 9));
  await fillDateTime(page, 'Hạn yêu cầu gian hàng', futureDateTimeLocal(20, 9));
  await fillDateTime(page, 'Hạn đề xuất hoạt động', futureDateTimeLocal(20, 10));
  await fillDateTime(page, 'Hạn người tham gia đăng ký', futureDateTimeLocal(50, 9));
  await page.getByLabel('Thời hạn giữ chỗ gian hàng').fill('24');
  await page.getByLabel('Đơn vị thời hạn giữ chỗ').selectOption('HOURS');
  await page.getByLabel('Số gian hàng tối đa / đối tác').fill('2');
  await page.getByLabel('Số hoạt động tối đa / đối tác').fill('3');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();

  await expect(page.getByRole('heading', { name: uniqueEventName })).toBeVisible();
  await page.getByRole('button', { name: 'Công bố', exact: true }).click();
  const publishDialog = page.getByRole('dialog', { name: 'Công bố sự kiện' });
  await expect(publishDialog).toBeVisible();
  await publishDialog.getByRole('button', { name: 'Công bố', exact: true }).click();

  await expect(page.getByText('Đã công bố').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Công bố', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sự kiện', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sự kiện', exact: true }).click();
  await page.getByPlaceholder('Tìm tên sự kiện...').fill(uniqueEventName);

  await expect(page.getByText(uniqueEventName, { exact: true })).toBeVisible();
  await expect(page.getByText('Đã công bố').first()).toBeVisible();
});
