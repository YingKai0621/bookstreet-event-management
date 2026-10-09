package com.swp391.bookstreet.payment.gateway;

public record VnPayResult(
        boolean signatureValid,
        String txnRef,
        String amountMinor,
        String responseCode,
        String transactionStatus,
        String transactionNo,
        String message
) {
}
