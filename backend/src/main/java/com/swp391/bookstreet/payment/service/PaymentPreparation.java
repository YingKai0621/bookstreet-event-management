package com.swp391.bookstreet.payment.service;

import com.swp391.bookstreet.payment.entity.BoothPayment;
record PaymentPreparation(BoothPayment payment, boolean newlyCreated,
        boolean checkoutCreationFailed) {
}
