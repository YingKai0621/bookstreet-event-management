import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildPaymentUrl,
  buildQueryDrRequest,
  canonicalQuery,
  createOrderStore,
  formatVnpayTimestamp,
  isVerifiedSuccess,
  mapProviderPaymentStatus,
  sign,
  startServer,
  verifyQueryDrResponse,
  verifySignature,
} from "./vnpay-spike.mjs";

function signedQueryResponse(queryRequest, secret, overrides = {}) {
  const response = {
    vnp_ResponseId: "R123",
    vnp_Command: "querydr",
    vnp_ResponseCode: "00",
    vnp_Message: "Success",
    vnp_TmnCode: "TESTCODE",
    vnp_TxnRef: queryRequest.vnp_TxnRef,
    vnp_Amount: "1000000",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261008100500",
    vnp_TransactionNo: "123456789",
    vnp_TransactionType: "01",
    vnp_TransactionStatus: "00",
    vnp_OrderInfo: `Thanh toan Booth BookStreet ${queryRequest.vnp_TxnRef}`,
    vnp_PromotionCode: null,
    vnp_PromotionAmount: null,
    ...overrides,
  };
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
  response.vnp_SecureHash = createHmac("sha512", secret).update(hashData, "utf8").digest("hex");
  return response;
}

async function createHarness(context, fetchImpl = async () => {
  throw new Error("Unexpected gateway request");
}, configOverrides = {}, nowProvider = () => new Date()) {
  const directory = await mkdtemp(join(tmpdir(), "bookstreet-vnpay-spike-"));
  const store = await createOrderStore(join(directory, "orders.json"));
  const config = {
    paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    port: 0,
    queryMinIntervalMs: 0,
    queryUrl: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    returnUrl: "http://localhost:8090/vnpay/return",
    secret: "test-secret",
    tmnCode: "TESTCODE",
    ...configOverrides,
  };
  const server = await startServer({ config, store, fetchImpl, nowProvider });
  context.after(async () => {
    await new Promise((resolveClose) => server.close(resolveClose));
    await rm(directory, { recursive: true, force: true });
  });
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    config,
    store,
  };
}

async function createPayment(baseUrl, amount = "10000", bankCode = "VNPAYQR") {
  const response = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ amount, bankCode }),
    redirect: "manual",
  });
  assert.equal(response.status, 303);
  const checkout = new URL(response.headers.get("location"));
  return { checkout, txnRef: checkout.searchParams.get("vnp_TxnRef") };
}

function signedIpn({
  amountMinor = "1000000",
  responseCode = "00",
  secret,
  transactionNo = "123456789",
  transactionStatus = "00",
  txnRef,
}) {
  const parameters = new URLSearchParams({
    vnp_Amount: amountMinor,
    vnp_ResponseCode: responseCode,
    vnp_TmnCode: "TESTCODE",
    vnp_TransactionNo: transactionNo,
    vnp_TransactionStatus: transactionStatus,
    vnp_TxnRef: txnRef,
  });
  parameters.set("vnp_SecureHash", sign(parameters, secret));
  return parameters;
}

async function getOrder(store, txnRef) {
  return (await store.load()).get(txnRef);
}

test("canonical query sorts fields and excludes signature metadata", () => {
  const parameters = new URLSearchParams({
    vnp_TxnRef: "BSP123",
    vnp_SecureHash: "ignored",
    unrelated: "ignored",
    vnp_Amount: "1000000",
  });

  assert.equal(canonicalQuery(parameters), "vnp_Amount=1000000&vnp_TxnRef=BSP123");
});

test("signature verification detects tampering", () => {
  const parameters = new URLSearchParams({ vnp_Amount: "1000000", vnp_TxnRef: "BSP123" });
  parameters.set("vnp_SecureHash", sign(parameters, "test-secret"));

  assert.equal(verifySignature(parameters, "test-secret"), true);
  parameters.set("vnp_Amount", "2000000");
  assert.equal(verifySignature(parameters, "test-secret"), false);
});

test("success requires both VNPay success fields", () => {
  assert.equal(isVerifiedSuccess(new URLSearchParams({ vnp_ResponseCode: "00", vnp_TransactionStatus: "00" })), true);
  assert.equal(isVerifiedSuccess(new URLSearchParams({ vnp_ResponseCode: "00", vnp_TransactionStatus: "01" })), false);
  assert.equal(isVerifiedSuccess(new URLSearchParams({ vnp_ResponseCode: "24", vnp_TransactionStatus: "00" })), false);
});

test("provider status mapping is conservative for unknown or in-progress results", () => {
  assert.equal(mapProviderPaymentStatus("00", "00"), "SUCCESS");
  assert.equal(mapProviderPaymentStatus("24", "02"), "FAILED");
  assert.equal(mapProviderPaymentStatus("00", "04"), "PENDING");
  assert.equal(mapProviderPaymentStatus("00", "01"), "PENDING");
  assert.equal(mapProviderPaymentStatus("00", "07"), "PENDING");
  assert.equal(mapProviderPaymentStatus("00", "11"), "PENDING");
  assert.equal(mapProviderPaymentStatus(null, null), "PENDING");
});

test("payment URL uses version 2.1.0, amount times 100 and a valid signature", () => {
  const paymentUrl = buildPaymentUrl({
    amountVnd: "10000",
    bankCode: "VNPAYQR",
    clientIp: "127.0.0.1",
    createdAt: new Date("2026-10-08T03:00:00Z"),
    expiresAt: new Date("2026-10-08T03:15:00Z"),
    orderInfo: "Thanh toan Booth BookStreet BSP123",
    paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    returnUrl: "http://localhost:8090/vnpay/return",
    secret: "test-secret",
    tmnCode: "TESTCODE",
    txnRef: "BSP123",
  });
  const url = new URL(paymentUrl);

  assert.equal(url.searchParams.get("vnp_Version"), "2.1.0");
  assert.equal(url.searchParams.get("vnp_Amount"), "1000000");
  assert.equal(url.searchParams.get("vnp_BankCode"), "VNPAYQR");
  assert.equal(url.searchParams.get("vnp_CreateDate"), "20261008100000");
  assert.equal(url.searchParams.get("vnp_ExpireDate"), "20261008101500");
  assert.equal(verifySignature(url.searchParams, "test-secret"), true);
});

test("configured five-minute checkout is signed and stored with the matching expiry", async (context) => {
  const nowProvider = () => new Date("2026-10-08T03:00:00Z");
  const { baseUrl, store } = await createHarness(
    context,
    undefined,
    { checkoutDurationMs: 300_000 },
    nowProvider,
  );

  const { checkout, txnRef } = await createPayment(baseUrl);
  const order = await getOrder(store, txnRef);

  assert.equal(checkout.searchParams.get("vnp_CreateDate"), "20261008100000");
  assert.equal(checkout.searchParams.get("vnp_ExpireDate"), "20261008100500");
  assert.equal(verifySignature(checkout.searchParams, "test-secret"), true);
  assert.equal(order.checkoutExpiresAt, "2026-10-08T03:05:00.000Z");
});

test("VNPay timestamps are formatted in GMT+7", () => {
  assert.equal(formatVnpayTimestamp(new Date("2026-10-08T03:04:05Z")), "20261008100405");
});

test("querydr request follows VNPay's documented pipe-delimited signature", () => {
  const request = buildQueryDrRequest({
    clientIp: "127.0.0.1",
    createdAt: new Date("2026-10-08T03:30:00Z"),
    orderCreatedAt: new Date("2026-10-08T03:00:00Z"),
    orderInfo: "Truy van giao dich BSP123",
    requestId: "Q20261008103000ABCDEF",
    secret: "test-secret",
    tmnCode: "TESTCODE",
    txnRef: "BSP123",
  });
  const hashData = "Q20261008103000ABCDEF|2.1.0|querydr|TESTCODE|BSP123|20261008100000|20261008103000|127.0.0.1|Truy van giao dich BSP123";
  const expected = createHmac("sha512", "test-secret").update(hashData, "utf8").digest("hex");

  assert.equal(request.vnp_TransactionDate, "20261008100000");
  assert.equal(request.vnp_CreateDate, "20261008103000");
  assert.equal(request.vnp_SecureHash, expected);
});

test("querydr response verification includes optional empty fields", () => {
  const response = {
    vnp_ResponseId: "R123",
    vnp_Command: "querydr",
    vnp_ResponseCode: "00",
    vnp_Message: "Success",
    vnp_TmnCode: "TESTCODE",
    vnp_TxnRef: "BSP123",
    vnp_Amount: "1000000",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261008100500",
    vnp_TransactionNo: "123456789",
    vnp_TransactionType: "01",
    vnp_TransactionStatus: "00",
    vnp_OrderInfo: "Thanh toan Booth BookStreet BSP123",
    vnp_PromotionCode: null,
    vnp_PromotionAmount: null,
  };
  const hashData = "R123|querydr|00|Success|TESTCODE|BSP123|1000000|NCB|20261008100500|123456789|01|00|Thanh toan Booth BookStreet BSP123||";
  response.vnp_SecureHash = createHmac("sha512", "test-secret").update(hashData, "utf8").digest("hex");

  assert.equal(verifyQueryDrResponse(response, "test-secret"), true);
  response.vnp_Amount = "2000000";
  assert.equal(verifyQueryDrResponse(response, "test-secret"), false);
});

test("IPN updates a durable order once and acknowledges a duplicate", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "bookstreet-vnpay-spike-"));
  const store = await createOrderStore(join(directory, "orders.json"));
  const config = {
    paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    port: 0,
    returnUrl: "http://localhost:8090/vnpay/return",
    secret: "test-secret",
    tmnCode: "TESTCODE",
  };
  const fetchImpl = async (_url, options) => {
    const queryRequest = JSON.parse(options.body);
    const response = {
      vnp_ResponseId: "R123",
      vnp_Command: "querydr",
      vnp_ResponseCode: "00",
      vnp_Message: "Success",
      vnp_TmnCode: "TESTCODE",
      vnp_TxnRef: queryRequest.vnp_TxnRef,
      vnp_Amount: "1000000",
      vnp_BankCode: "NCB",
      vnp_PayDate: "20261008100500",
      vnp_TransactionNo: "123456789",
      vnp_TransactionType: "01",
      vnp_TransactionStatus: "00",
      vnp_OrderInfo: `Thanh toan Booth BookStreet ${queryRequest.vnp_TxnRef}`,
      vnp_PromotionCode: null,
      vnp_PromotionAmount: null,
    };
    const hashData = [
      response.vnp_ResponseId,
      response.vnp_Command,
      response.vnp_ResponseCode,
      response.vnp_Message,
      response.vnp_TmnCode,
      response.vnp_TxnRef,
      response.vnp_Amount,
      response.vnp_BankCode,
      response.vnp_PayDate,
      response.vnp_TransactionNo,
      response.vnp_TransactionType,
      response.vnp_TransactionStatus,
      response.vnp_OrderInfo,
      "",
      "",
    ].join("|");
    response.vnp_SecureHash = createHmac("sha512", config.secret).update(hashData, "utf8").digest("hex");
    return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const server = await startServer({ config, store, fetchImpl });
  context.after(async () => {
    await new Promise((resolveClose) => server.close(resolveClose));
    await rm(directory, { recursive: true, force: true });
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const createResponse = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "amount=10000&bankCode=VNPAYQR",
    redirect: "manual",
  });
  assert.equal(createResponse.status, 303);
  const checkout = new URL(createResponse.headers.get("location"));
  const txnRef = checkout.searchParams.get("vnp_TxnRef");

  const callback = new URLSearchParams({
    vnp_Amount: "1000000",
    vnp_ResponseCode: "00",
    vnp_TmnCode: "TESTCODE",
    vnp_TransactionNo: "123456789",
    vnp_TransactionStatus: "00",
    vnp_TxnRef: txnRef,
  });
  callback.set("vnp_SecureHash", sign(callback, config.secret));

  const firstIpn = await fetch(`${baseUrl}/vnpay/ipn?${callback}`);
  assert.deepEqual(await firstIpn.json(), { RspCode: "00", Message: "Confirm Success" });
  const persistedOrder = (await store.load()).get(txnRef);
  assert.equal(persistedOrder.status, "SUCCESS");
  assert.equal(persistedOrder.gatewayTransactionRef, "123456789");

  const duplicateIpn = await fetch(`${baseUrl}/vnpay/ipn?${callback}`);
  assert.deepEqual(await duplicateIpn.json(), { RspCode: "02", Message: "Order already confirmed" });

  const queryResponse = await fetch(`${baseUrl}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ txnRef }),
  });
  assert.equal(queryResponse.status, 200);
  assert.match(await queryResponse.text(), /Chữ ký response: <strong>HỢP LỆ<\/strong>/);
  const queriedOrder = (await store.load()).get(txnRef);
  assert.equal(queriedOrder.lastQuery.signatureValid, true);
  assert.equal(queriedOrder.lastQuery.sameOrder, true);
  assert.equal(queriedOrder.lastQuery.sameAmount, true);
});

test("payment creation rejects invalid amount and unsupported bank code without storing an order", async (context) => {
  const { baseUrl, store } = await createHarness(context);
  const invalidBodies = [
    { amount: "0", bankCode: "VNPAYQR" },
    { amount: "10.5", bankCode: "VNPAYQR" },
    { amount: "-100", bankCode: "VNPAYQR" },
    { amount: "10000000000", bankCode: "VNPAYQR" },
    { amount: "10000", bankCode: "UNSUPPORTED" },
  ];

  for (const body of invalidBodies) {
    const response = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      redirect: "manual",
    });
    assert.equal(response.status, 400);
  }

  assert.equal((await store.load()).size, 0);
});

test("IPN rejects invalid signature, unknown order and amount mismatch before mutation", async (context) => {
  const { baseUrl, config, store } = await createHarness(context);
  const { txnRef } = await createPayment(baseUrl);

  const tampered = signedIpn({ txnRef, secret: config.secret });
  tampered.set("vnp_Amount", "2000000");
  const invalidSignature = await fetch(`${baseUrl}/vnpay/ipn?${tampered}`);
  assert.deepEqual(await invalidSignature.json(), { RspCode: "97", Message: "Invalid signature" });
  assert.equal((await getOrder(store, txnRef)).status, "PENDING");

  const unknown = signedIpn({ txnRef: "BSP-UNKNOWN", secret: config.secret });
  const unknownOrder = await fetch(`${baseUrl}/vnpay/ipn?${unknown}`);
  assert.deepEqual(await unknownOrder.json(), { RspCode: "01", Message: "Order not found" });
  assert.equal((await getOrder(store, txnRef)).status, "PENDING");

  const wrongAmount = signedIpn({ txnRef, amountMinor: "2000000", secret: config.secret });
  const amountMismatch = await fetch(`${baseUrl}/vnpay/ipn?${wrongAmount}`);
  assert.deepEqual(await amountMismatch.json(), { RspCode: "04", Message: "Invalid amount" });
  assert.equal((await getOrder(store, txnRef)).status, "PENDING");
});

test("IPN keeps an incomplete result pending and maps verified terminal failure", async (context) => {
  const { baseUrl, config, store } = await createHarness(context);
  const incompletePayment = await createPayment(baseUrl);
  const incomplete = signedIpn({
    txnRef: incompletePayment.txnRef,
    responseCode: "00",
    transactionStatus: "01",
    secret: config.secret,
  });
  const incompleteResponse = await fetch(`${baseUrl}/vnpay/ipn?${incomplete}`);
  assert.deepEqual(await incompleteResponse.json(), { RspCode: "00", Message: "Confirm Success" });
  assert.equal((await getOrder(store, incompletePayment.txnRef)).status, "PENDING");

  const failedPayment = await createPayment(baseUrl);
  const failed = signedIpn({
    txnRef: failedPayment.txnRef,
    responseCode: "24",
    transactionStatus: "02",
    secret: config.secret,
  });
  const failedResponse = await fetch(`${baseUrl}/vnpay/ipn?${failed}`);
  assert.deepEqual(await failedResponse.json(), { RspCode: "00", Message: "Confirm Success" });
  const failedOrder = await getOrder(store, failedPayment.txnRef);
  assert.equal(failedOrder.status, "FAILED");
  assert.equal(failedOrder.responseCode, "24");
  assert.equal(failedOrder.transactionStatus, "02");
});

test("browser Return URL cannot mutate durable state even with a valid success claim", async (context) => {
  const { baseUrl, config, store } = await createHarness(context);
  const { txnRef } = await createPayment(baseUrl);
  const successClaim = signedIpn({ txnRef, secret: config.secret });

  const response = await fetch(`${baseUrl}/vnpay/return?${successClaim}`);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /Checksum: HỢP LỆ/);
  assert.match(body, /VNPay báo trên browser: <strong>SUCCESS<\/strong>/);
  assert.match(body, /Trạng thái do IPN ghi nhận: <strong>PENDING<\/strong>/);
  assert.equal((await getOrder(store, txnRef)).status, "PENDING");

  successClaim.set("vnp_Amount", "2000000");
  const tamperedResponse = await fetch(`${baseUrl}/vnpay/return?${successClaim}`);
  assert.match(await tamperedResponse.text(), /Checksum: KHÔNG HỢP LỆ/);
  assert.equal((await getOrder(store, txnRef)).status, "PENDING");
});

test("QueryDR leaves untrusted, missing and in-progress results pending", async (context) => {
  let scenario = "invalid-signature";
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    let result;
    if (scenario === "wrong-order") {
      result = signedQueryResponse(request, "test-secret", { vnp_TxnRef: "BSP-OTHER" });
    } else if (scenario === "wrong-amount") {
      result = signedQueryResponse(request, "test-secret", { vnp_Amount: "2000000" });
    } else if (scenario === "not-found") {
      result = signedQueryResponse(request, "test-secret", {
        vnp_ResponseCode: "91",
        vnp_Message: "Transaction not found",
        vnp_TransactionStatus: "01",
      });
    } else if (scenario === "duplicate") {
      result = signedQueryResponse(request, "test-secret", {
        vnp_ResponseCode: "94",
        vnp_Message: "Duplicate request",
        vnp_TransactionStatus: null,
      });
    } else if (scenario === "in-progress") {
      result = signedQueryResponse(request, "test-secret", { vnp_TransactionStatus: "01" });
    } else if (scenario === "undocumented-status") {
      result = signedQueryResponse(request, "test-secret", { vnp_TransactionStatus: "11" });
    } else {
      result = signedQueryResponse(request, "test-secret");
      result.vnp_SecureHash = `${result.vnp_SecureHash.slice(0, -1)}${result.vnp_SecureHash.endsWith("0") ? "1" : "0"}`;
    }
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { baseUrl, store } = await createHarness(context, fetchImpl);
  const { txnRef } = await createPayment(baseUrl);

  for (const currentScenario of ["invalid-signature", "wrong-order", "wrong-amount", "not-found", "in-progress", "undocumented-status", "duplicate"]) {
    scenario = currentScenario;
    const response = await fetch(`${baseUrl}/queries`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ txnRef }),
    });
    assert.equal(response.status, 200);
    assert.equal((await getOrder(store, txnRef)).status, "PENDING");
  }

  const finalOrder = await getOrder(store, txnRef);
  assert.equal(finalOrder.lastQuery.signatureValid, true);
  assert.equal(finalOrder.lastQuery.sameOrder, true);
  assert.equal(finalOrder.lastQuery.sameAmount, true);
  assert.equal(finalOrder.lastQuery.responseCode, "94");
  assert.equal(finalOrder.lastQuery.transactionStatus, null);
});

test("QueryDR transport, HTTP and malformed-response failures remain observable and non-terminal", async (context) => {
  let scenario = "network";
  const fetchImpl = async () => {
    if (scenario === "network") {
      throw new Error("simulated network timeout");
    }
    if (scenario === "http") {
      return new Response("unavailable", { status: 503 });
    }
    return new Response("not-json", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { baseUrl, store } = await createHarness(context, fetchImpl);

  for (const currentScenario of ["network", "http", "malformed"]) {
    scenario = currentScenario;
    const { txnRef } = await createPayment(baseUrl);
    const response = await fetch(`${baseUrl}/queries`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ txnRef }),
    });
    assert.equal(response.status, 502);
    const order = await getOrder(store, txnRef);
    assert.equal(order.status, "PENDING");
    assert.equal(order.lastQuery.transportError, true);
    assert.equal(order.lastQuery.message, "Gateway query unavailable");
  }
});

test("QueryDR is throttled locally during VNPay's duplicate-request window", async (context) => {
  let providerCalls = 0;
  const fetchImpl = async (_url, options) => {
    providerCalls += 1;
    const request = JSON.parse(options.body);
    const result = signedQueryResponse(request, "test-secret", { vnp_TransactionStatus: "01" });
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { baseUrl, store } = await createHarness(context, fetchImpl, { queryMinIntervalMs: 300_000 });
  const { txnRef } = await createPayment(baseUrl);
  const queryBody = new URLSearchParams({ txnRef });

  const first = await fetch(`${baseUrl}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: queryBody,
  });
  assert.equal(first.status, 200);

  const second = await fetch(`${baseUrl}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: queryBody,
  });
  assert.equal(second.status, 429);
  assert.ok(Number(second.headers.get("retry-after")) > 0);
  assert.equal(providerCalls, 1);
  assert.equal((await getOrder(store, txnRef)).status, "PENDING");
});

test("two trusted incomplete QueryDR results after checkout expiry close the local attempt as TIMEOUT", async (context) => {
  let now = new Date("2026-10-08T03:00:00Z");
  const nowProvider = () => new Date(now);
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    const result = signedQueryResponse(request, "test-secret", { vnp_TransactionStatus: "01" });
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { baseUrl, config, store } = await createHarness(
    context,
    fetchImpl,
    { queryMinIntervalMs: 300_000, reconciliationDelayMs: 300_000 },
    nowProvider,
  );
  const { txnRef } = await createPayment(baseUrl);
  const createdOrder = await getOrder(store, txnRef);
  assert.equal(createdOrder.checkoutExpiresAt, "2026-10-08T03:15:00.000Z");

  now = new Date("2026-10-08T03:20:00Z");
  const first = await fetch(`${baseUrl}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ txnRef }),
  });
  assert.equal(first.status, 200);
  const afterFirst = await getOrder(store, txnRef);
  assert.equal(afterFirst.status, "PENDING");
  assert.equal(afterFirst.reconciliation.trustedIncompleteCount, 1);

  now = new Date("2026-10-08T03:25:00Z");
  const second = await fetch(`${baseUrl}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ txnRef }),
  });
  assert.equal(second.status, 200);
  const timedOut = await getOrder(store, txnRef);
  assert.equal(timedOut.status, "TIMEOUT");
  assert.equal(timedOut.completedAt, "2026-10-08T03:25:00.000Z");
  assert.equal(timedOut.responseCode, "00");
  assert.equal(timedOut.transactionStatus, "01");
  assert.equal(timedOut.reconciliation.trustedIncompleteCount, 2);

  now = new Date("2026-10-08T03:26:00Z");
  const lateSuccess = signedIpn({ txnRef, secret: config.secret });
  const lateIpnResponse = await fetch(`${baseUrl}/vnpay/ipn?${lateSuccess}`);
  assert.deepEqual(await lateIpnResponse.json(), { RspCode: "02", Message: "Order already confirmed" });
  const conflicted = await getOrder(store, txnRef);
  assert.equal(conflicted.status, "TIMEOUT");
  assert.equal(conflicted.lateProviderResult.source, "IPN");
  assert.equal(conflicted.lateProviderResult.transactionStatus, "00");
  assert.equal(conflicted.lateProviderResult.stateConflict, true);
});

test("QueryDR maps terminal results once and reports a later contradictory result without overwriting", async (context) => {
  let transactionStatus = "02";
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    const result = signedQueryResponse(request, "test-secret", {
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: transactionStatus,
    });
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { baseUrl, store } = await createHarness(context, fetchImpl);
  const { txnRef } = await createPayment(baseUrl);

  const failedResponse = await fetch(`${baseUrl}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ txnRef }),
  });
  assert.equal(failedResponse.status, 200);
  const failedOrder = await getOrder(store, txnRef);
  assert.equal(failedOrder.status, "FAILED");
  const terminalUpdatedAt = failedOrder.updatedAt;

  transactionStatus = "00";
  const contradictoryResponse = await fetch(`${baseUrl}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ txnRef }),
  });
  assert.equal(contradictoryResponse.status, 200);
  const finalOrder = await getOrder(store, txnRef);
  assert.equal(finalOrder.status, "FAILED");
  assert.equal(finalOrder.updatedAt, terminalUpdatedAt);
  assert.equal(finalOrder.lastQuery.stateConflict, true);
});

test("two concurrent duplicate success IPNs perform only one terminal transition", async (context) => {
  const { baseUrl, config, store } = await createHarness(context);
  const { txnRef } = await createPayment(baseUrl);
  const callback = signedIpn({ txnRef, secret: config.secret });

  const responses = await Promise.all([
    fetch(`${baseUrl}/vnpay/ipn?${callback}`).then((response) => response.json()),
    fetch(`${baseUrl}/vnpay/ipn?${callback}`).then((response) => response.json()),
  ]);
  assert.deepEqual(responses.map(({ RspCode }) => RspCode).sort(), ["00", "02"]);
  const order = await getOrder(store, txnRef);
  assert.equal(order.status, "SUCCESS");
  assert.equal(order.gatewayTransactionRef, "123456789");
});
