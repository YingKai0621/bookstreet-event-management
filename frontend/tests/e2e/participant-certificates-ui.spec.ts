import { expect, test, type Page, type Route } from '@playwright/test';

const participant = {
  userId: 42,
  username: 'participantdemo',
  fullName: 'Bạn đọc Demo',
  email: 'reader@example.test',
  emailVerified: true,
  status: 'ACTIVE',
  roles: ['PARTICIPANT'],
};

const certificateSummaries = [
  {
    certificateId: 601,
    certificateCode: 'BKS-2027-8F3KQ2M9',
    recipientName: 'Bạn đọc Demo',
    status: 'ISSUED',
    issuedAt: '2027-01-11T03:00:05Z',
    revokedAt: null,
    downloadAvailable: true,
  },
  {
    certificateId: 602,
    certificateCode: 'BKS-2027-REVOKED',
    recipientName: 'Bạn đọc Demo',
    status: 'REVOKED',
    issuedAt: '2027-01-10T03:00:05Z',
    revokedAt: '2027-01-12T05:00:00Z',
    downloadAvailable: false,
  },
];

function pageOf<T>(content: T[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockCertificateWorkspace(
  page: Page,
  options: { failFirstList?: boolean; failFirstDownload?: boolean } = {},
) {
  let certificateListRequests = 0;
  let certificateDownloadRequests = 0;

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/csrf')) return json(route, { headerName: 'X-CSRF-TOKEN', token: 'test-csrf-token' });
    if (path.endsWith('/auth/me')) return json(route, participant);
    if (path.endsWith('/auth/profile')) return json(route, {
      id: participant.userId,
      fullName: participant.fullName,
      email: participant.email,
      emailVerified: true,
      phone: null,
      avatarUrl: null,
      certificatesCount: 2,
    });
    if (path === '/api/v1/participant/event-registrations') return json(route, pageOf([]));
    if (path === '/api/v1/participant/activity-registrations') return json(route, pageOf([]));
    if (path === '/api/v1/participant/notifications') return json(route, pageOf([]));
    if (path === '/api/v1/participant/notifications/unread-count') return json(route, { unreadCount: 0 });

    if (path === '/api/v1/participant/certificates') {
      certificateListRequests += 1;
      if (options.failFirstList && certificateListRequests === 1) {
        return json(route, {
          code: 'CERTIFICATE_RENDER_UNAVAILABLE',
          message: 'Tạm thời chưa thể tải chứng nhận.',
          fieldErrors: [],
          path,
        }, 503);
      }
      return json(route, pageOf(certificateSummaries));
    }

    if (path === '/api/v1/participant/certificates/601') {
      return json(route, {
        certificate: certificateSummaries[0],
        activity: {
          activityId: 91,
          title: 'Giao lưu tác giả trẻ',
          startAt: '2027-01-11T02:00:00Z',
          endAt: '2027-01-11T03:00:00Z',
        },
        event: { eventId: 7, name: 'Ngày hội Văn hóa Đọc 2027' },
      });
    }

    if (path === '/api/v1/participant/certificates/602') {
      return json(route, {
        certificate: certificateSummaries[1],
        activity: {
          activityId: 92,
          title: 'Workshop làm sách',
          startAt: '2027-01-10T02:00:00Z',
          endAt: '2027-01-10T03:00:00Z',
        },
        event: { eventId: 7, name: 'Ngày hội Văn hóa Đọc 2027' },
      });
    }

    if (path === '/api/v1/participant/certificates/601/download') {
      certificateDownloadRequests += 1;
      if (options.failFirstDownload && certificateDownloadRequests === 1) {
        return json(route, {
          code: 'CERTIFICATE_RENDER_UNAVAILABLE',
          message: 'Tạm thời chưa thể tạo tệp PDF.',
          fieldErrors: [],
          path,
        }, 503);
      }
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="certificate-BKS-2027-8F3KQ2M9.pdf"',
        },
        body: '%PDF-1.4\n% test certificate',
      });
    }

    if (path === '/api/v1/participant/certificates/602/download') {
      certificateDownloadRequests += 1;
      return json(route, { code: 'CERTIFICATE_REVOKED', message: 'Revoked certificate cannot be downloaded.' }, 409);
    }

    return json(route, []);
  });

  return {
    get certificateListRequests() { return certificateListRequests; },
    get certificateDownloadRequests() { return certificateDownloadRequests; },
  };
}

test('certificate API is route-scoped and renders issued and revoked history', async ({ page }) => {
  const requests = await mockCertificateWorkspace(page);

  await page.goto('/participant');
  await expect(page.getByRole('heading', { name: /Xin chào/ })).toBeVisible();
  expect(requests.certificateListRequests).toBe(0);

  await page.goto('/participant/certificates');
  await expect(page.getByText('BKS-2027-8F3KQ2M9')).toBeVisible();
  await expect(page.getByText('BKS-2027-REVOKED')).toBeVisible();
  await expect(page.getByText('Có hiệu lực', { exact: true })).toBeVisible();
  await expect(page.getByText('Đã thu hồi', { exact: true })).toBeVisible();
  expect(requests.certificateListRequests).toBe(1);

  const issuedCard = page.locator('article').filter({ hasText: 'BKS-2027-8F3KQ2M9' });
  await issuedCard.getByRole('button', { name: 'Chi tiết' }).click();
  const detailDialog = page.getByRole('dialog', { name: 'Chứng nhận tham gia' });
  await expect(detailDialog.getByText('11/01/2027', { exact: true })).toBeVisible();
  await expect(detailDialog.getByText('Giao lưu tác giả trẻ')).toBeVisible();
  await expect(detailDialog.getByText('Ngày hội Văn hóa Đọc 2027')).toBeVisible();
  await detailDialog.getByRole('button', { name: 'Đóng', exact: true }).click();

  const revokedCard = page.locator('article').filter({ hasText: 'BKS-2027-REVOKED' });
  await expect(revokedCard).toContainText('Thu hồi ngày: 12/01/2027');
  await expect(revokedCard.getByRole('button', { name: 'Tải PDF' })).toBeDisabled();
  expect(requests.certificateDownloadRequests).toBe(0);
});

test('issued certificate downloads the backend PDF with its server filename', async ({ page }) => {
  const requests = await mockCertificateWorkspace(page);
  await page.goto('/participant/certificates');

  const issuedCard = page.locator('article').filter({ hasText: 'BKS-2027-8F3KQ2M9' });
  const downloadPromise = page.waitForEvent('download');
  await issuedCard.getByRole('button', { name: 'Tải PDF' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('certificate-BKS-2027-8F3KQ2M9.pdf');
  expect(requests.certificateDownloadRequests).toBe(1);
});

test('certificate list failure has an explicit retry state', async ({ page }) => {
  const requests = await mockCertificateWorkspace(page, { failFirstList: true });
  await page.goto('/participant/certificates');

  await expect(page.getByRole('alert')).toContainText('Tạm thời chưa thể tải chứng nhận.');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText('BKS-2027-8F3KQ2M9')).toBeVisible();
  expect(requests.certificateListRequests).toBe(2);
});

test('temporary PDF rendering failure keeps issued metadata and allows retry', async ({ page }) => {
  const requests = await mockCertificateWorkspace(page, { failFirstDownload: true });
  await page.goto('/participant/certificates');

  const issuedCard = page.locator('article').filter({ hasText: 'BKS-2027-8F3KQ2M9' });
  await issuedCard.getByRole('button', { name: 'Tải PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('Tạm thời chưa thể tạo tệp PDF.');
  await expect(issuedCard.getByText('Có hiệu lực', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await issuedCard.getByRole('button', { name: 'Tải PDF' }).click();
  await downloadPromise;
  expect(requests.certificateDownloadRequests).toBe(2);
});
