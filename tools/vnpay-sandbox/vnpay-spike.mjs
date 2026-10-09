import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_STORE = resolve(ROOT_DIR, "local-data/vnpay-spike-orders.json");
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function hmacSha512(data, secret) {
  return createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

function constantTimeHexEquals(received, expected) {
  if (!received || !/^[a-f0-9]{128}$/i.test(received)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

export function canonicalQuery(parameters) {
  const sortedEntries = [...parameters.entries()]
    .filter(([key, value]) => key.startsWith("vnp_") && key !== "vnp_SecureHash" && key !== "vnp_SecureHashType" && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));

  return new URLSearchParams(sortedEntries).toString();
}

export function sign(parameters, secret) {
  return hmacSha512(canonicalQuery(parameters), secret);
}

export function verifySignature(parameters, secret) {
  const received = parameters.get("vnp_SecureHash")?.toLowerCase();
  if (!received || !/^[a-f0-9]{128}$/.test(received)) {
    return false;
  }

  return constantTimeHexEquals(received, sign(parameters, secret));
}

export function isVerifiedSuccess(parameters) {
  return parameters.get("vnp_ResponseCode") === "00"
    && parameters.get("vnp_TransactionStatus") === "00";
}

export function mapProviderPaymentStatus(responseCode, transactionStatus) {
  if (responseCode === "00" && transactionStatus === "00") {
    return "SUCCESS";
  }
  if (transactionStatus === "02") {
    return "FAILED";
  }
  return "PENDING";
}

export function formatVnpayTimestamp(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}`;
}

export function buildPaymentUrl({
  amountVnd,
  bankCode,
  clientIp,
  createdAt,
  expiresAt,
  orderInfo,
  paymentUrl,
  returnUrl,
  secret,
  tmnCode,
  txnRef,
}) {
  const parameters = new URLSearchParams({
    vnp_Amount: (BigInt(amountVnd) * 100n).toString(),
    vnp_Command: "pay",
    vnp_CreateDate: formatVnpayTimestamp(createdAt),
    vnp_CurrCode: "VND",
    vnp_ExpireDate: formatVnpayTimestamp(expiresAt),
    vnp_IpAddr: clientIp,
    vnp_Locale: "vn",
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_ReturnUrl: returnUrl,
    vnp_TmnCode: tmnCode,
    vnp_TxnRef: txnRef,
    vnp_Version: "2.1.0",
  });

  if (bankCode) {
    parameters.set("vnp_BankCode", bankCode);
  }

  const signedQuery = canonicalQuery(parameters);
  parameters.set("vnp_SecureHash", sign(parameters, secret));
  return `${paymentUrl}?${signedQuery}&vnp_SecureHash=${parameters.get("vnp_SecureHash")}`;
}

export function buildQueryDrRequest({
  clientIp,
  createdAt,
  orderCreatedAt,
  orderInfo,
  requestId,
  secret,
  tmnCode,
  txnRef,
}) {
  const request = {
    vnp_RequestId: requestId,
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: tmnCode,
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_TransactionDate: formatVnpayTimestamp(orderCreatedAt),
    vnp_CreateDate: formatVnpayTimestamp(createdAt),
    vnp_IpAddr: clientIp,
  };
  const hashData = [
    request.vnp_RequestId,
    request.vnp_Version,
    request.vnp_Command,
    request.vnp_TmnCode,
    request.vnp_TxnRef,
    request.vnp_TransactionDate,
    request.vnp_CreateDate,
    request.vnp_IpAddr,
    request.vnp_OrderInfo,
  ].join("|");
  return { ...request, vnp_SecureHash: hmacSha512(hashData, secret) };
}

export function verifyQueryDrResponse(response, secret) {
  const field = (name) => response[name] ?? "";
  const hashData = [
    field("vnp_ResponseId"),
    field("vnp_Command"),
    field("vnp_ResponseCode"),
    field("vnp_Message"),
    field("vnp_TmnCode"),
    field("vnp_TxnRef"),
    field("vnp_Amount"),
    field("vnp_BankCode"),
    field("vnp_PayDate"),
    field("vnp_TransactionNo"),
    field("vnp_TransactionType"),
    field("vnp_TransactionStatus"),
    field("vnp_OrderInfo"),
    field("vnp_PromotionCode"),
    field("vnp_PromotionAmount"),
  ].join("|");
  return constantTimeHexEquals(field("vnp_SecureHash"), hmacSha512(hashData, secret));
}

export async function createOrderStore(storePath = DEFAULT_STORE) {
  async function load() {
    try {
      const content = await readFile(storePath, "utf8");
      const records = JSON.parse(content);
      return new Map(records.map((record) => [record.txnRef, record]));
    } catch (error) {
      if (error.code === "ENOENT") {
        return new Map();
      }
      throw error;
    }
  }

  async function save(orders) {
    await mkdir(dirname(storePath), { recursive: true });
    const temporaryPath = `${storePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify([...orders.values()], null, 2)}\n`, "utf8");
    await rename(temporaryPath, storePath);
  }

  return { load, save };
}

function parseEnvLine(line) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) {
    return null;
  }

  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [match[1], value];
}

async function loadRootEnv() {
  try {
    const content = await readFile(resolve(ROOT_DIR, ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const entry = parseEnvLine(line);
      if (entry && process.env[entry[0]] === undefined) {
        process.env[entry[0]] = entry[1];
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function readConfig() {
  const config = {
    checkoutDurationMs: Number(process.env.VNPAY_CHECKOUT_DURATION_SECONDS || "900") * 1000,
    paymentUrl: process.env.VNPAY_PAYMENT_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    port: Number(process.env.VNPAY_SPIKE_PORT || "8090"),
    queryMinIntervalMs: Number(process.env.VNPAY_QUERY_MIN_INTERVAL_SECONDS || "300") * 1000,
    reconciliationDelayMs: Number(process.env.VNPAY_RECONCILIATION_DELAY_SECONDS || "300") * 1000,
    queryUrl: process.env.VNPAY_QUERY_URL || "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    returnUrl: process.env.VNPAY_SPIKE_RETURN_URL || "http://localhost:8090/vnpay/return",
    secret: process.env.VNPAY_HASH_SECRET,
    tmnCode: process.env.VNPAY_TMN_CODE,
  };

  const missing = [];
  if (!config.tmnCode) missing.push("VNPAY_TMN_CODE");
  if (!config.secret) missing.push("VNPAY_HASH_SECRET");
  if (missing.length > 0) {
    throw new Error(`Missing required local environment values: ${missing.join(", ")}`);
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("VNPAY_SPIKE_PORT must be a valid TCP port");
  }
  if (!Number.isInteger(config.checkoutDurationMs) || config.checkoutDurationMs < 1000) {
    throw new Error("VNPAY_CHECKOUT_DURATION_SECONDS must be a positive integer");
  }
  if (!Number.isInteger(config.queryMinIntervalMs) || config.queryMinIntervalMs < 0) {
    throw new Error("VNPAY_QUERY_MIN_INTERVAL_SECONDS must be a non-negative integer");
  }
  if (!Number.isInteger(config.reconciliationDelayMs) || config.reconciliationDelayMs < 0) {
    throw new Error("VNPAY_RECONCILIATION_DELAY_SECONDS must be a non-negative integer");
  }
  return config;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page(title, body) {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
body{font-family:system-ui,sans-serif;max-width:920px;margin:40px auto;padding:0 20px;color:#172033}input,select,button{font:inherit;padding:10px;margin:4px 0}label{display:block;margin-top:12px}button{cursor:pointer}.card{border:1px solid #d8dfeb;border-radius:12px;padding:20px;margin:16px 0}.ok{color:#08783e}.bad{color:#b42318}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}code{background:#f2f4f7;padding:2px 5px;border-radius:4px}
</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

function sendHtml(response, status, title, body) {
  const content = page(title, body);
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(content) });
  response.end(content);
}

function sendJson(response, body) {
  const content = JSON.stringify(body);
  response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(content) });
  response.end(content);
}

function redirect(response, location) {
  response.writeHead(303, { Location: location });
  response.end();
}

async function readForm(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  const candidate = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return candidate?.trim() || request.socket.remoteAddress?.replace("::ffff:", "") || "127.0.0.1";
}

function newTxnRef(now) {
  return `BSP${formatVnpayTimestamp(now)}${randomBytes(3).toString("hex").toUpperCase()}`;
}

function newQueryRequestId(now) {
  return `Q${formatVnpayTimestamp(now)}${randomBytes(4).toString("hex").toUpperCase()}`;
}

function recordLateProviderResult(order, source, result, observedAt) {
  order.lateProviderResult = {
    observedAt: observedAt.toISOString(),
    source,
    responseCode: result.responseCode ?? null,
    transactionStatus: result.transactionStatus ?? null,
    transactionNo: result.transactionNo ?? null,
    stateConflict: true,
  };
}

function applyTrustedIncompleteQuery(order, queriedAt, reconciliationDelayMs) {
  const checkoutExpiresAt = Date.parse(order.checkoutExpiresAt || "");
  if (!Number.isFinite(checkoutExpiresAt)
      || queriedAt.getTime() < checkoutExpiresAt + reconciliationDelayMs) {
    return false;
  }

  const reconciliation = order.reconciliation || {
    trustedIncompleteCount: 0,
    firstTrustedIncompleteAt: null,
    lastTrustedIncompleteAt: null,
  };
  const lastTrustedIncompleteAt = Date.parse(reconciliation.lastTrustedIncompleteAt || "");
  if (Number.isFinite(lastTrustedIncompleteAt)
      && queriedAt.getTime() < lastTrustedIncompleteAt + reconciliationDelayMs) {
    return false;
  }
  reconciliation.trustedIncompleteCount += 1;
  reconciliation.firstTrustedIncompleteAt ||= queriedAt.toISOString();
  reconciliation.lastTrustedIncompleteAt = queriedAt.toISOString();
  order.reconciliation = reconciliation;

  return reconciliation.trustedIncompleteCount >= 2;
}

function validateAmount(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error("Amount must be a positive whole number of VND");
  }
  const amount = BigInt(value);
  if (amount * 100n > 999_999_999_999n) {
    throw new Error("Amount exceeds VNPay vnp_Amount length");
  }
  return amount.toString();
}

function orderRows(orders) {
  if (orders.size === 0) {
    return "<p>Chưa có giao dịch test.</p>";
  }
  return `<table><thead><tr><th>TxnRef</th><th>Amount</th><th>Status</th><th>VNPAY ref</th><th>QueryDR</th></tr></thead><tbody>${[...orders.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((order) => `<tr><td><code>${escapeHtml(order.txnRef)}</code></td><td>${escapeHtml(order.amountVnd)} VND</td><td>${escapeHtml(order.status)}</td><td>${escapeHtml(order.gatewayTransactionRef || "-")}</td><td><form method="post" action="/queries"><input type="hidden" name="txnRef" value="${escapeHtml(order.txnRef)}"><button type="submit">Query VNPay</button></form></td></tr>`)
    .join("")}</tbody></table>`;
}

export async function startServer({ config, store, fetchImpl = fetch, nowProvider = () => new Date() }) {
  const orderStore = store || await createOrderStore();
  const orders = await orderStore.load();

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || `localhost:${config.port}`}`);

      if (request.method === "GET" && url.pathname === "/health") {
        return sendJson(response, { status: "UP", provider: "VNPAY_SANDBOX_SPIKE" });
      }

      if (request.method === "GET" && url.pathname === "/") {
        return sendHtml(response, 200, "VNPay sandbox local spike", `
<div class="card"><p>Công cụ thử nghiệm tách biệt; không ghi vào database BookStreet.</p>
<form method="post" action="/payments">
<label>Số tiền (VND)<br><input name="amount" inputmode="numeric" value="10000" required></label>
<label>Phương thức<br><select name="bankCode"><option value="">Chọn tại VNPay</option><option value="VNPAYQR">VNPAY-QR</option><option value="VNBANK">Ngân hàng nội địa</option><option value="INTCARD">Thẻ quốc tế</option></select></label>
<button type="submit">Tạo giao dịch và sang VNPay</button></form></div>
<div class="card"><h2>Giao dịch local</h2>${orderRows(orders)}</div>
<p>IPN endpoint: <code>/vnpay/ipn</code> · Return endpoint: <code>/vnpay/return</code></p>`);
      }

      if (request.method === "POST" && url.pathname === "/payments") {
        const form = await readForm(request);
        const amountVnd = validateAmount(form.get("amount") || "");
        const bankCode = form.get("bankCode") || "";
        if (bankCode && !["VNPAYQR", "VNBANK", "INTCARD"].includes(bankCode)) {
          throw new Error("Unsupported bankCode");
        }

        const createdAt = nowProvider();
        const checkoutDurationMs = config.checkoutDurationMs ?? 15 * 60_000;
        const expiresAt = new Date(createdAt.getTime() + checkoutDurationMs);
        const txnRef = newTxnRef(createdAt);
        const order = {
          txnRef,
          amountVnd,
          amountMinor: (BigInt(amountVnd) * 100n).toString(),
          status: "PENDING",
          createdAt: createdAt.toISOString(),
          checkoutExpiresAt: expiresAt.toISOString(),
          updatedAt: createdAt.toISOString(),
          completedAt: null,
          gatewayTransactionRef: null,
          responseCode: null,
          transactionStatus: null,
        };
        orders.set(txnRef, order);
        await orderStore.save(orders);

        const paymentUrl = buildPaymentUrl({
          amountVnd,
          bankCode,
          clientIp: getClientIp(request),
          createdAt,
          expiresAt,
          orderInfo: `Thanh toan Booth BookStreet ${txnRef}`,
          paymentUrl: config.paymentUrl,
          returnUrl: config.returnUrl,
          secret: config.secret,
          tmnCode: config.tmnCode,
          txnRef,
        });
        return redirect(response, paymentUrl);
      }

      if (request.method === "POST" && url.pathname === "/queries") {
        const form = await readForm(request);
        const txnRef = form.get("txnRef") || "";
        const order = orders.get(txnRef);
        if (!order) {
          return sendHtml(response, 404, "Không tìm thấy giao dịch", "<p class=\"bad\">TxnRef không tồn tại trong local spike.</p><p><a href=\"/\">Quay lại</a></p>");
        }

        const queryMinIntervalMs = config.queryMinIntervalMs ?? 300_000;
        const previousQueryAt = order.lastQuery?.queriedAt ? Date.parse(order.lastQuery.queriedAt) : Number.NaN;
        const queryCreatedAt = nowProvider();
        const elapsedSincePreviousQuery = queryCreatedAt.getTime() - previousQueryAt;
        if (queryMinIntervalMs > 0 && Number.isFinite(previousQueryAt) && elapsedSincePreviousQuery < queryMinIntervalMs) {
          const retryAfterSeconds = Math.ceil((queryMinIntervalMs - elapsedSincePreviousQuery) / 1000);
          response.setHeader("Retry-After", String(retryAfterSeconds));
          return sendHtml(response, 429, "QueryDR đang được giới hạn", `
<div class="card"><p class="bad">VNPay giới hạn truy vấn lặp. Hãy thử lại sau <strong>${retryAfterSeconds}</strong> giây.</p>
<p>Không thay đổi trạng thái giao dịch trong thời gian chờ.</p></div><p><a href="/">Quay lại spike</a></p>`);
        }

        const queryRequest = buildQueryDrRequest({
          clientIp: "127.0.0.1",
          createdAt: queryCreatedAt,
          orderCreatedAt: new Date(order.createdAt),
          orderInfo: `Truy van giao dich ${txnRef}`,
          requestId: newQueryRequestId(queryCreatedAt),
          secret: config.secret,
          tmnCode: config.tmnCode,
          txnRef,
        });
        let providerResult;
        try {
          const queryResponse = await fetchImpl(config.queryUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(queryRequest),
            signal: AbortSignal.timeout(15_000),
          });
          if (!queryResponse.ok) {
            throw new Error(`VNPay querydr returned HTTP ${queryResponse.status}`);
          }
          providerResult = await queryResponse.json();
        } catch (error) {
          order.lastQuery = {
            queriedAt: queryCreatedAt.toISOString(),
            requestId: queryRequest.vnp_RequestId,
            transportError: true,
            signatureValid: null,
            responseCode: null,
            message: "Gateway query unavailable",
            transactionStatus: null,
            transactionNo: null,
            sameOrder: null,
            sameAmount: null,
          };
          await orderStore.save(orders);
          console.error(`[vnpay-spike] QueryDR unavailable for ${txnRef}: ${error.message}`);
          return sendHtml(response, 502, "Không thể đối soát VNPay", `
<div class="card"><p class="bad">Không nhận được kết quả QueryDR hợp lệ. Giao dịch vẫn giữ nguyên trạng thái <strong>${escapeHtml(order.status)}</strong>.</p>
<p>Không được tạo retry chỉ dựa trên lỗi mạng này.</p></div><p><a href="/">Quay lại spike</a></p>`);
        }

        const signatureValid = verifyQueryDrResponse(providerResult, config.secret);
        const sameOrder = providerResult.vnp_TxnRef === order.txnRef;
        const sameAmount = providerResult.vnp_Amount === order.amountMinor;
        const queryAccepted = providerResult.vnp_ResponseCode === "00";
        const trusted = signatureValid && sameOrder && sameAmount && queryAccepted;
        const mappedStatus = mapProviderPaymentStatus(
          providerResult.vnp_ResponseCode,
          providerResult.vnp_TransactionStatus,
        );
        const stateConflict = trusted
          && order.status !== "PENDING"
          && mappedStatus !== "PENDING"
          && order.status !== mappedStatus;

        order.lastQuery = {
          queriedAt: queryCreatedAt.toISOString(),
          requestId: queryRequest.vnp_RequestId,
          transportError: false,
          signatureValid,
          responseCode: providerResult.vnp_ResponseCode ?? null,
          message: providerResult.vnp_Message ?? null,
          transactionStatus: providerResult.vnp_TransactionStatus ?? null,
          transactionNo: providerResult.vnp_TransactionNo ?? null,
          sameOrder,
          sameAmount,
          stateConflict,
        };
        const trustedIncomplete = trusted && providerResult.vnp_TransactionStatus === "01";
        const reconciliationDelayMs = config.reconciliationDelayMs ?? 300_000;
        const timedOut = order.status === "PENDING"
          && trustedIncomplete
          && applyTrustedIncompleteQuery(order, queryCreatedAt, reconciliationDelayMs);
        if (trusted && order.status === "PENDING" && mappedStatus !== "PENDING") {
          order.status = mappedStatus;
          order.gatewayTransactionRef = providerResult.vnp_TransactionNo || order.gatewayTransactionRef;
          order.responseCode = providerResult.vnp_ResponseCode;
          order.transactionStatus = providerResult.vnp_TransactionStatus;
          order.updatedAt = queryCreatedAt.toISOString();
          order.completedAt = queryCreatedAt.toISOString();
        } else if (timedOut) {
          order.status = "TIMEOUT";
          order.gatewayTransactionRef = providerResult.vnp_TransactionNo || order.gatewayTransactionRef;
          order.responseCode = providerResult.vnp_ResponseCode;
          order.transactionStatus = providerResult.vnp_TransactionStatus;
          order.updatedAt = queryCreatedAt.toISOString();
          order.completedAt = queryCreatedAt.toISOString();
        } else if (stateConflict) {
          recordLateProviderResult(order, "QUERYDR", {
            responseCode: providerResult.vnp_ResponseCode,
            transactionStatus: providerResult.vnp_TransactionStatus,
            transactionNo: providerResult.vnp_TransactionNo,
          }, queryCreatedAt);
        }
        await orderStore.save(orders);

        return sendHtml(response, 200, "Kết quả QueryDR", `
<div class="card">
<p class="${signatureValid ? "ok" : "bad"}">Chữ ký response: <strong>${signatureValid ? "HỢP LỆ" : "KHÔNG HỢP LỆ"}</strong></p>
<p>ResponseCode: <code>${escapeHtml(providerResult.vnp_ResponseCode ?? "missing")}</code></p>
<p>Message: <code>${escapeHtml(providerResult.vnp_Message ?? "missing")}</code></p>
<p>TransactionStatus: <code>${escapeHtml(providerResult.vnp_TransactionStatus ?? "missing")}</code></p>
<p>TxnRef khớp: <strong>${sameOrder ? "CÓ" : "KHÔNG"}</strong></p>
<p>Amount khớp: <strong>${sameAmount ? "CÓ" : "KHÔNG"}</strong></p>
<p>Được tin cậy để reconcile: <strong>${trusted ? "CÓ" : "KHÔNG"}</strong></p>
<p>Số QueryDR 01 đủ điều kiện: <strong>${escapeHtml(order.reconciliation?.trustedIncompleteCount || 0)}</strong></p>
<p>Trạng thái local sau đối soát: <strong>${escapeHtml(order.status)}</strong></p>
<p>Xung đột với trạng thái terminal đã lưu: <strong>${stateConflict ? "CÓ - cần điều tra" : "KHÔNG"}</strong></p>
</div><p><a href="/">Quay lại spike</a></p>`);
      }

      if (request.method === "GET" && url.pathname === "/vnpay/ipn") {
        const parameters = url.searchParams;
        if (!verifySignature(parameters, config.secret)) {
          return sendJson(response, { RspCode: "97", Message: "Invalid signature" });
        }

        const txnRef = parameters.get("vnp_TxnRef");
        const order = orders.get(txnRef);
        if (!order) {
          return sendJson(response, { RspCode: "01", Message: "Order not found" });
        }
        if (parameters.get("vnp_Amount") !== order.amountMinor) {
          return sendJson(response, { RspCode: "04", Message: "Invalid amount" });
        }
        if (order.status !== "PENDING") {
          const incomingStatus = mapProviderPaymentStatus(
            parameters.get("vnp_ResponseCode"),
            parameters.get("vnp_TransactionStatus"),
          );
          if (incomingStatus !== "PENDING" && incomingStatus !== order.status) {
            recordLateProviderResult(order, "IPN", {
              responseCode: parameters.get("vnp_ResponseCode"),
              transactionStatus: parameters.get("vnp_TransactionStatus"),
              transactionNo: parameters.get("vnp_TransactionNo"),
            }, nowProvider());
            await orderStore.save(orders);
          }
          return sendJson(response, { RspCode: "02", Message: "Order already confirmed" });
        }

        const mappedStatus = mapProviderPaymentStatus(
          parameters.get("vnp_ResponseCode"),
          parameters.get("vnp_TransactionStatus"),
        );
        order.status = mappedStatus;
        order.gatewayTransactionRef = parameters.get("vnp_TransactionNo");
        order.responseCode = parameters.get("vnp_ResponseCode");
        order.transactionStatus = parameters.get("vnp_TransactionStatus");
        const receivedAt = nowProvider().toISOString();
        order.updatedAt = receivedAt;
        if (mappedStatus !== "PENDING") {
          order.completedAt = receivedAt;
        }
        await orderStore.save(orders);
        return sendJson(response, { RspCode: "00", Message: "Confirm Success" });
      }

      if (request.method === "GET" && url.pathname === "/vnpay/return") {
        const validSignature = verifySignature(url.searchParams, config.secret);
        const reportedSuccess = validSignature && isVerifiedSuccess(url.searchParams);
        const txnRef = url.searchParams.get("vnp_TxnRef");
        const durableStatus = orders.get(txnRef)?.status || "UNKNOWN";
        return sendHtml(response, 200, "Kết quả trở về từ VNPay", `
<div class="card"><p class="${validSignature ? "ok" : "bad"}">Checksum: ${validSignature ? "HỢP LỆ" : "KHÔNG HỢP LỆ"}</p>
<p>VNPay báo trên browser: <strong>${reportedSuccess ? "SUCCESS" : "NOT SUCCESS"}</strong></p>
<p>Trạng thái do IPN ghi nhận: <strong>${escapeHtml(durableStatus)}</strong></p>
<p>TxnRef: <code>${escapeHtml(txnRef || "missing")}</code></p></div>
<p><strong>Lưu ý:</strong> Return URL chỉ hiển thị. Trang này không cập nhật trạng thái giao dịch.</p><p><a href="/">Quay lại spike</a></p>`);
      }

      sendHtml(response, 404, "Không tìm thấy", "<p>Endpoint không tồn tại.</p>");
    } catch (error) {
      console.error(`[vnpay-spike] ${error.message}`);
      sendHtml(response, 400, "Yêu cầu không hợp lệ", `<p class="bad">${escapeHtml(error.message)}</p><p><a href="/">Quay lại</a></p>`);
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(config.port, "127.0.0.1", resolveListen);
  });
  return server;
}

async function main() {
  await loadRootEnv();
  const config = readConfig();
  await startServer({ config });
  console.log(`[vnpay-spike] Local UI: http://localhost:${config.port}`);
  console.log(`[vnpay-spike] IPN path for HTTPS tunnel: /vnpay/ipn`);
  console.log("[vnpay-spike] Secrets loaded from environment and are not printed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`[vnpay-spike] Startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
