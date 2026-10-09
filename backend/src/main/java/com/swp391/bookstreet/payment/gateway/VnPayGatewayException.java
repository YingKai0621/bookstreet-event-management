package com.swp391.bookstreet.payment.gateway;

public class VnPayGatewayException extends RuntimeException {
    public VnPayGatewayException(String message, Throwable cause) {
        super(message, cause);
    }

    public VnPayGatewayException(String message) {
        super(message);
    }
}
