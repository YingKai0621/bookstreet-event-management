// Invoked by RewardManagementIntegrationTests with an isolated database schema and ephemeral credentials.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const backend = new URL(process.env.S7B_BACKEND_URL);
const dist = path.resolve('dist');
const artifacts = path.resolve('../docs/development/assets/sprint7-developer-b');
await mkdir(artifacts, { recursive: true });
const server = http.createServer(async (request, response) => {
  if (request.url.startsWith('/api/')) {
    const headers = { ...request.headers, host: backend.host };
    // Emulate the application's same-origin development reverse proxy.
    if (headers.origin) headers.origin = backend.origin;
    const proxy = http.request(new URL(request.url, backend), { method: request.method, headers }, upstream => {
      response.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(response);
    });
    proxy.on('error', () => { response.writeHead(502); response.end(); });
    request.pipe(proxy); return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const requested = path.resolve(dist, '.' + pathname);
    if (requested !== dist && !requested.startsWith(dist + path.sep)) { response.writeHead(400); response.end(); return; }
    const extension = path.extname(requested);
    const file = extension ? requested : path.join(dist, 'index.html');
    const content = await readFile(file);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type }); response.end(content);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function login(username) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const csrf = await (await context.request.get(origin + '/api/v1/auth/csrf')).json();
  const response = await context.request.post(origin + '/api/v1/auth/login', {
    headers: { [csrf.headerName]: csrf.token }, data: { username, password: process.env.S7B_PASSWORD },
  });
  assert.equal(response.status(), 200, 'Real session login succeeds');
  return context;
}

async function post(context, endpoint, data) {
  const csrf = await (await context.request.get(origin + '/api/v1/auth/csrf')).json();
  return context.request.post(origin + '/api/v1' + endpoint, { headers: { [csrf.headerName]: csrf.token }, data });
}

try {
  const participant = await login(process.env.S7B_PARTICIPANT);
  const first = await post(participant, '/participant/booth-visits/scan', { token: process.env.S7B_SCAN_TOKEN });
  assert.equal(first.status(), 200, 'Real Booth scan succeeds');
  assert.equal((await first.json()).newlyAwardedPoints, 10);
  const duplicate = await post(participant, '/participant/booth-visits/scan', { token: process.env.S7B_SCAN_TOKEN });
  assert.equal((await duplicate.json()).newlyAwardedPoints, 0);

  const organizer = await login(process.env.S7B_ORGANIZER);
  const organizerPage = await organizer.newPage();
  await organizerPage.goto(`${origin}/organizer/participants?eventId=${process.env.S7B_EVENT_ID}&view=booth`);
  await expect(organizerPage.getByRole('button', { name: 'Xem lượt ghé A01' })).toBeVisible();
  await organizerPage.screenshot({ path: path.join(artifacts, 'organizer-groups.png'), fullPage: true });
  await organizerPage.getByRole('button', { name: 'Xem lượt ghé A01' }).click();
  await expect(organizerPage.getByText('Bạn đọc kiểm thử', { exact: true })).toBeVisible();
  await organizerPage.screenshot({ path: path.join(artifacts, 'organizer-visits.png'), fullPage: true });
  await organizerPage.locator('.participant-event-select select').selectOption(process.env.S7B_EMPTY_EVENT_ID);
  await expect(organizerPage.getByText('Chưa có lượt ghé phù hợp', { exact: true })).toBeVisible();
  await organizerPage.screenshot({ path: path.join(artifacts, 'organizer-empty.png'), fullPage: true });
  const foreign = await login(process.env.S7B_FOREIGN_ORGANIZER);
  const denied = await foreign.request.get(`${origin}/api/v1/organizer/events/${process.env.S7B_EVENT_ID}/booth-visits/summary`);
  assert.equal(denied.status(), 404);

  const admin = await login(process.env.S7B_ADMIN);
  const adminPage = await admin.newPage();
  const apiCalls = [];
  adminPage.on('request', request => { if (request.url().includes('/api/v1/')) apiCalls.push(new URL(request.url()).pathname); });
  await adminPage.goto(origin + '/admin/badges');
  await expect(adminPage.getByText('Chưa có huy hiệu phù hợp', { exact: true })).toBeVisible();
  await adminPage.getByRole('button', { name: 'Thêm huy hiệu', exact: true }).click();
  const dialog = adminPage.getByRole('dialog');
  await dialog.getByLabel('Tên huy hiệu').fill('Bạn của Đường Sách');
  await dialog.getByLabel('Ngưỡng điểm').fill('10');
  await dialog.getByLabel('Trạng thái áp dụng').selectOption('true');
  await dialog.getByLabel('Mô tả').fill('Ghé thăm gian hàng và tích lũy điểm qua các sự kiện.');
  await adminPage.screenshot({ path: path.join(artifacts, 'admin-create.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Lưu huy hiệu' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(adminPage.getByText('Còn người đủ điều kiện chưa nhận huy hiệu', { exact: true })).toBeVisible();
  await adminPage.screenshot({ path: path.join(artifacts, 'admin-pending-sync.png'), fullPage: true });
  await adminPage.getByRole('button', { name: 'Đồng bộ phần thưởng', exact: true }).click();
  await expect(adminPage.locator('.badge-notice')).toContainText('Đã đồng bộ đầy đủ');
  await expect(adminPage.getByText('Đã đồng bộ theo ngưỡng hiện tại', { exact: true })).toBeVisible();
  await adminPage.screenshot({ path: path.join(artifacts, 'admin-synchronized.png'), fullPage: true });
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await adminPage.waitForTimeout(350); // let the shared sidebar slide offscreen after resize
  await adminPage.screenshot({ path: path.join(artifacts, 'admin-mobile.png'), fullPage: true });
  assert.equal(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Admin mobile has no horizontal page overflow');
  assert.ok(apiCalls.every(endpoint => endpoint.startsWith('/api/v1/auth/') || endpoint.startsWith('/api/v1/admin/badges')), 'Badge screen uses approved APIs only');
  const summary = await (await participant.request.get(origin + '/api/v1/participant/rewards/summary')).json();
  assert.equal(summary.totalPoints, 10); assert.equal(summary.earnedBadgeCount, 1);
  const inbox = await (await participant.request.get(origin + '/api/v1/participant/notifications?type=BADGE_UNLOCKED')).json();
  assert.equal(inbox.content.filter(item => item.type === 'BADGE_UNLOCKED').length, 1);
  await adminPage.getByRole('button', { name: 'Đồng bộ phần thưởng', exact: true }).click();
  await expect(adminPage.locator('.badge-notice')).toContainText('cấp mới 0 huy hiệu');
  console.log('PASS: real Session/CSRF, first/duplicate scan, Organizer owned/empty/foreign monitoring, Admin create/synchronize/retry, Participant Badge and one Notification; desktop/mobile screenshots saved.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
