package com.swp391.bookstreet.payment.gateway;

import com.swp391.bookstreet.payment.config.VnPayProperties;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

class VnPayGatewayAdapterTests {
    private static final String SECRET = "test-secret";
    private VnPayGatewayAdapter gateway;

    @BeforeEach
    void setUp() {
        VnPayProperties properties = new VnPayProperties();
        properties.setTmnCode("TESTCODE");
        properties.setHashSecret(SECRET);
        properties.setPaymentUrl("https://sandbox.example/pay");
        properties.setReturnUrl("https://merchant.example/return");
        gateway = new VnPayGatewayAdapter(properties, new ObjectMapper());
    }

    @Test
    void checkoutUsesDurablePaymentReferenceMinorAmountAndValidSignature() {
        Instant createdAt = Instant.parse("2026-10-08T03:00:00Z");
        Instant expiresAt = Instant.parse("2026-10-08T03:05:00Z");

        VnPayCheckout checkout = gateway.buildCheckout(81L, new BigDecimal("2000000"),
                "127.0.0.1", createdAt, expiresAt);
        Map<String, String> fields = queryFields(checkout.url());
        String signature = fields.remove("vnp_SecureHash");

        assertThat(fields)
                .containsEntry("vnp_TxnRef", "BSP81")
                .containsEntry("vnp_Amount", "200000000")
                .containsEntry("vnp_CreateDate", "20261008100000")
                .containsEntry("vnp_ExpireDate", "20261008100500");
        assertThat(signature).isEqualTo(hmac(canonical(fields)));
        assertThat(checkout.expiresAt()).isEqualTo(expiresAt);
    }

    @Test
    void notificationRejectsTamperingAndAcceptsCanonicalSignature() {
        Map<String, String> callback = new LinkedHashMap<>();
        callback.put("vnp_Amount", "1000000");
        callback.put("vnp_ResponseCode", "00");
        callback.put("vnp_TransactionNo", "15698764");
        callback.put("vnp_TransactionStatus", "00");
        callback.put("vnp_TxnRef", "BSP9");
        callback.put("vnp_SecureHash", hmac(canonical(callback)));

        assertThat(gateway.parseNotification(callback).signatureValid()).isTrue();

        callback.put("vnp_Amount", "1000100");
        assertThat(gateway.parseNotification(callback).signatureValid()).isFalse();
    }

    private static Map<String, String> queryFields(String url) {
        Map<String, String> fields = new TreeMap<>();
        for (String pair : URI.create(url).getRawQuery().split("&")) {
            String[] parts = pair.split("=", 2);
            fields.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                    URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
        }
        return fields;
    }

    private static String canonical(Map<String, String> source) {
        return new TreeMap<>(source).entrySet().stream()
                .filter(entry -> entry.getKey().startsWith("vnp_")
                        && !entry.getKey().equals("vnp_SecureHash")
                        && !entry.getKey().equals("vnp_SecureHashType")
                        && entry.getValue() != null && !entry.getValue().isEmpty())
                .map(entry -> URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8) + "="
                        + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
    }

    private static String hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException error) {
            throw new AssertionError(error);
        }
    }
}
