package com.swp391.bookstreet.payment.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(VnPayProperties.class)
public class PaymentConfiguration {
}
