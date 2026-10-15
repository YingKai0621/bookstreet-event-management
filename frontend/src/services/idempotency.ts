function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Standard RFC4122 v4 UUID fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

const STORAGE_PREFIX = 'bookstreet_idempotency_pay_req_';

function storageKey(boothRequestId: number): string {
  return `${STORAGE_PREFIX}${boothRequestId}`;
}

export function getOrCreatePaymentIdempotencyKey(boothRequestId: number): string {
  try {
    const existing = sessionStorage.getItem(storageKey(boothRequestId));
    if (existing && isValidUuid(existing)) {
      return existing;
    }
    const newKey = generateUuidV4();
    sessionStorage.setItem(storageKey(boothRequestId), newKey);
    return newKey;
  } catch {
    return generateUuidV4();
  }
}

export function regeneratePaymentIdempotencyKey(boothRequestId: number): string {
  const newKey = generateUuidV4();
  try {
    sessionStorage.setItem(storageKey(boothRequestId), newKey);
  } catch {
    // Ignore storage quota or access issues
  }
  return newKey;
}

// Keep one retry key per terminal source attempt, including after a network error or reload.
export function getRetryPaymentIdempotencyKey(boothRequestId: number, paymentId: number): string {
  const retryKey = `${storageKey(boothRequestId)}_retry_${paymentId}`;
  try {
    const existing = sessionStorage.getItem(retryKey);
    if (existing && isValidUuid(existing)) return existing;
    const key = generateUuidV4();
    sessionStorage.setItem(retryKey, key);
    return key;
  } catch {
    return generateUuidV4();
  }
}

export function clearPaymentIdempotencyKey(boothRequestId: number): void {
  try {
    sessionStorage.removeItem(storageKey(boothRequestId));
  } catch {
    // Ignore storage issues
  }
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

