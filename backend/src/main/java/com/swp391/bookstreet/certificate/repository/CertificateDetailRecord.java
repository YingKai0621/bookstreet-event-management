package com.swp391.bookstreet.certificate.repository;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.certificate.entity.Certificate;
import com.swp391.bookstreet.event.entity.Event;

public record CertificateDetailRecord(
        Certificate certificate,
        Activity activity,
        Event event
) {}
