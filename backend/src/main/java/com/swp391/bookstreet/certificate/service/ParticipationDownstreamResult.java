package com.swp391.bookstreet.certificate.service;

import com.swp391.bookstreet.certificate.entity.CertificateStatus;
import com.swp391.bookstreet.rating.entity.ActivityRatingStatus;

public record ParticipationDownstreamResult(
        boolean certificateEnabled,
        Long certificateId,
        CertificateStatus certificateStatus,
        boolean certificateChanged,
        ActivityRatingStatus ratingStatus,
        boolean ratingChanged,
        Long notificationId) {

    public boolean changed() {
        return certificateChanged || ratingChanged;
    }

    public boolean noOp() {
        return !changed();
    }
}
