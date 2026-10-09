package com.swp391.bookstreet.payment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record VnPayAcknowledgement(
        @JsonProperty("RspCode") String rspCode,
        @JsonProperty("Message") String message
) {
    public static VnPayAcknowledgement success() {
        return new VnPayAcknowledgement("00", "Confirm Success");
    }

    public static VnPayAcknowledgement notFound() {
        return new VnPayAcknowledgement("01", "Order not Found");
    }

    public static VnPayAcknowledgement alreadyConfirmed() {
        return new VnPayAcknowledgement("02", "Order already confirmed");
    }

    public static VnPayAcknowledgement invalidAmount() {
        return new VnPayAcknowledgement("04", "Invalid Amount");
    }

    public static VnPayAcknowledgement invalidChecksum() {
        return new VnPayAcknowledgement("97", "Invalid Checksum");
    }
}
