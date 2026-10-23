package com.swp391.bookstreet.certificate.service;

import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class UuidCertificateCodeGenerator implements CertificateCodeGenerator {
    @Override
    public String generate() {
        return "BKS-" + UUID.randomUUID().toString()
                .replace("-", "")
                .toUpperCase(Locale.ROOT);
    }
}
