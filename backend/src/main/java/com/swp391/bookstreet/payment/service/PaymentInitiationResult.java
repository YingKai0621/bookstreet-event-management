package com.swp391.bookstreet.payment.service;

import com.swp391.bookstreet.payment.dto.PaymentInitiationResponse;
import org.springframework.http.HttpStatus;

public record PaymentInitiationResult(HttpStatus status, PaymentInitiationResponse body) {
}
