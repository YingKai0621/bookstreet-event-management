package com.swp391.bookstreet.payment.gateway;

import com.swp391.bookstreet.payment.config.VnPayProperties;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Component
public class VnPayGatewayAdapter implements VnPayGateway {
    private static final DateTimeFormatter VNPAY_TIME =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss")
                    .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));
    private static final TypeReference<Map<String, String>> STRING_MAP = new TypeReference<>() { };

    private final VnPayProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public VnPayGatewayAdapter(VnPayProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public VnPayCheckout buildCheckout(Long paymentId, BigDecimal amount, String clientIp,
            Instant createdAt, Instant expiresAt) {
        properties.requireConfigured();
        TreeMap<String, String> fields = new TreeMap<>();
        fields.put("vnp_Amount", minorAmount(amount));
        fields.put("vnp_Command", "pay");
        fields.put("vnp_CreateDate", VNPAY_TIME.format(createdAt));
        fields.put("vnp_CurrCode", "VND");
        fields.put("vnp_ExpireDate", VNPAY_TIME.format(expiresAt));
        fields.put("vnp_IpAddr", normalizedIp(clientIp));
        fields.put("vnp_Locale", "vn");
        fields.put("vnp_OrderInfo", "Thanh toan Booth BookStreet " + txnRef(paymentId));
        fields.put("vnp_OrderType", "other");
        fields.put("vnp_ReturnUrl", properties.getReturnUrl());
        fields.put("vnp_TmnCode", properties.getTmnCode());
        fields.put("vnp_TxnRef", txnRef(paymentId));
        fields.put("vnp_Version", "2.1.0");
        String canonical = canonicalQuery(fields);
        return new VnPayCheckout(properties.getPaymentUrl() + "?" + canonical
                + "&vnp_SecureHash=" + hmac(canonical), expiresAt);
    }

    @Override
    public VnPayResult parseNotification(Map<String, String> parameters) {
        properties.requireConfigured();
        String received = parameters.get("vnp_SecureHash");
        TreeMap<String, String> signed = new TreeMap<>();
        parameters.forEach((key, value) -> {
            if (key.startsWith("vnp_") && !"vnp_SecureHash".equals(key)
                    && !"vnp_SecureHashType".equals(key) && value != null && !value.isEmpty()) {
                signed.put(key, value);
            }
        });
        boolean valid = constantTimeEquals(received, hmac(canonicalQuery(signed)));
        return result(valid, parameters);
    }

    @Override
    public VnPayResult query(Long paymentId, BigDecimal amount, String clientIp,
            Instant paymentCreatedAt, Instant queriedAt) {
        properties.requireConfigured();
        String reference = txnRef(paymentId);
        Map<String, String> body = new TreeMap<>();
        body.put("vnp_RequestId", "Q" + VNPAY_TIME.format(queriedAt)
                + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        body.put("vnp_Version", "2.1.0");
        body.put("vnp_Command", "querydr");
        body.put("vnp_TmnCode", properties.getTmnCode());
        body.put("vnp_TxnRef", reference);
        body.put("vnp_OrderInfo", "Query " + reference);
        body.put("vnp_TransactionDate", VNPAY_TIME.format(paymentCreatedAt));
        body.put("vnp_CreateDate", VNPAY_TIME.format(queriedAt));
        body.put("vnp_IpAddr", normalizedIp(clientIp));
        String hashData = String.join("|", body.get("vnp_RequestId"), body.get("vnp_Version"),
                body.get("vnp_Command"), body.get("vnp_TmnCode"), body.get("vnp_TxnRef"),
                body.get("vnp_TransactionDate"), body.get("vnp_CreateDate"),
                body.get("vnp_IpAddr"), body.get("vnp_OrderInfo"));
        body.put("vnp_SecureHash", hmac(hashData));
        try {
            String json = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder(URI.create(properties.getQueryUrl()))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new VnPayGatewayException("VNPay QueryDR returned HTTP "
                        + response.statusCode());
            }
            Map<String, String> fields = objectMapper.readValue(response.body(), STRING_MAP);
            String responseHashData = String.join("|",
                    value(fields, "vnp_ResponseId"), value(fields, "vnp_Command"),
                    value(fields, "vnp_ResponseCode"), value(fields, "vnp_Message"),
                    value(fields, "vnp_TmnCode"), value(fields, "vnp_TxnRef"),
                    value(fields, "vnp_Amount"), value(fields, "vnp_BankCode"),
                    value(fields, "vnp_PayDate"), value(fields, "vnp_TransactionNo"),
                    value(fields, "vnp_TransactionType"),
                    value(fields, "vnp_TransactionStatus"), value(fields, "vnp_OrderInfo"),
                    value(fields, "vnp_PromotionCode"), value(fields, "vnp_PromotionAmount"));
            boolean valid = constantTimeEquals(fields.get("vnp_SecureHash"),
                    hmac(responseHashData));
            return result(valid, fields);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new VnPayGatewayException("VNPay QueryDR was interrupted.", error);
        } catch (Exception error) {
            if (error instanceof VnPayGatewayException gatewayError) throw gatewayError;
            throw new VnPayGatewayException("VNPay QueryDR failed.", error);
        }
    }

    public static String txnRef(Long paymentId) {
        return "BSP" + paymentId;
    }

    public static String minorAmount(BigDecimal amount) {
        return amount.movePointRight(2).toBigIntegerExact().toString();
    }

    private VnPayResult result(boolean valid, Map<String, String> fields) {
        return new VnPayResult(valid, fields.get("vnp_TxnRef"), fields.get("vnp_Amount"),
                fields.get("vnp_ResponseCode"), fields.get("vnp_TransactionStatus"),
                fields.get("vnp_TransactionNo"), fields.get("vnp_Message"));
    }

    private String hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(properties.getHashSecret().getBytes(StandardCharsets.UTF_8),
                    "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException error) {
            throw new VnPayGatewayException("Could not sign VNPay request.", error);
        }
    }

    private static String canonicalQuery(Map<String, String> fields) {
        return fields.entrySet().stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isEmpty())
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static boolean constantTimeEquals(String received, String expected) {
        if (received == null || received.length() != expected.length()) return false;
        return java.security.MessageDigest.isEqual(
                received.toLowerCase().getBytes(StandardCharsets.US_ASCII),
                expected.getBytes(StandardCharsets.US_ASCII));
    }

    private static String value(Map<String, String> fields, String key) {
        return fields.getOrDefault(key, "");
    }

    private static String normalizedIp(String clientIp) {
        return clientIp == null || clientIp.isBlank() ? "127.0.0.1" : clientIp;
    }
}
