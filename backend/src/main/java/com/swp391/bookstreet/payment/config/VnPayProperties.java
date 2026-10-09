package com.swp391.bookstreet.payment.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "bookstreet.payment.vnpay")
@Validated
public class VnPayProperties {
    private String tmnCode;
    private String hashSecret;
    private String paymentUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    private String queryUrl = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
    private String returnUrl = "http://localhost:5173/payment/vnpay/return";
    @Min(300)
    @Max(900)
    private long checkoutDurationSeconds = 900;
    @Min(300)
    private long queryMinIntervalSeconds = 300;
    @Min(300)
    private long reconciliationDelaySeconds = 300;

    public void requireConfigured() {
        if (tmnCode == null || tmnCode.isBlank() || hashSecret == null || hashSecret.isBlank()) {
            throw new IllegalStateException("VNPay credentials are not configured.");
        }
        requireHttpUrl(paymentUrl, "payment URL", true);
        requireHttpUrl(queryUrl, "query URL", true);
        requireHttpUrl(returnUrl, "return URL", false);
    }

    private static void requireHttpUrl(String value, String label, boolean requireHttps) {
        try {
            URI uri = URI.create(value);
            boolean validScheme = requireHttps ? "https".equalsIgnoreCase(uri.getScheme())
                    : "https".equalsIgnoreCase(uri.getScheme())
                    || "http".equalsIgnoreCase(uri.getScheme());
            if (!validScheme || uri.getHost() == null) {
                throw new IllegalArgumentException();
            }
        } catch (RuntimeException error) {
            throw new IllegalStateException("VNPay " + label + " is invalid.", error);
        }
    }

    public String getTmnCode() { return tmnCode; }
    public void setTmnCode(String tmnCode) { this.tmnCode = tmnCode; }
    public String getHashSecret() { return hashSecret; }
    public void setHashSecret(String hashSecret) { this.hashSecret = hashSecret; }
    public String getPaymentUrl() { return paymentUrl; }
    public void setPaymentUrl(String paymentUrl) { this.paymentUrl = paymentUrl; }
    public String getQueryUrl() { return queryUrl; }
    public void setQueryUrl(String queryUrl) { this.queryUrl = queryUrl; }
    public String getReturnUrl() { return returnUrl; }
    public void setReturnUrl(String returnUrl) { this.returnUrl = returnUrl; }
    public long getCheckoutDurationSeconds() { return checkoutDurationSeconds; }
    public void setCheckoutDurationSeconds(long checkoutDurationSeconds) {
        this.checkoutDurationSeconds = checkoutDurationSeconds;
    }
    public long getQueryMinIntervalSeconds() { return queryMinIntervalSeconds; }
    public void setQueryMinIntervalSeconds(long queryMinIntervalSeconds) {
        this.queryMinIntervalSeconds = queryMinIntervalSeconds;
    }
    public long getReconciliationDelaySeconds() { return reconciliationDelaySeconds; }
    public void setReconciliationDelaySeconds(long reconciliationDelaySeconds) {
        this.reconciliationDelaySeconds = reconciliationDelaySeconds;
    }
}
