package com.swp391.bookstreet.payment.gateway;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

public interface VnPayGateway {
    VnPayCheckout buildCheckout(Long paymentId, BigDecimal amount, String clientIp,
            Instant createdAt, Instant expiresAt);

    VnPayResult parseNotification(Map<String, String> parameters);

    VnPayResult query(Long paymentId, BigDecimal amount, String clientIp,
            Instant paymentCreatedAt, Instant queriedAt);
}
