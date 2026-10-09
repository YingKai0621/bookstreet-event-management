package com.swp391.bookstreet.payment.controller;

import com.swp391.bookstreet.payment.dto.VnPayAcknowledgement;
import com.swp391.bookstreet.payment.gateway.VnPayGateway;
import com.swp391.bookstreet.payment.service.PaymentSettlementService;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments/vnpay")
public class VnPayIpnController {
    private final VnPayGateway gateway;
    private final PaymentSettlementService settlementService;
    private final Clock clock;

    public VnPayIpnController(VnPayGateway gateway, PaymentSettlementService settlementService,
            Clock clock) {
        this.gateway = gateway;
        this.settlementService = settlementService;
        this.clock = clock;
    }

    @GetMapping("/ipn")
    public VnPayAcknowledgement ipn(@RequestParam Map<String, String> parameters) {
        return settlementService.acceptIpn(
                gateway.parseNotification(new LinkedHashMap<>(parameters)), clock.instant());
    }
}
