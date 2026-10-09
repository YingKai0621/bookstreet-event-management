package com.swp391.bookstreet.payment.gateway;

import java.time.Instant;

public record VnPayCheckout(String url, Instant expiresAt) {
}
