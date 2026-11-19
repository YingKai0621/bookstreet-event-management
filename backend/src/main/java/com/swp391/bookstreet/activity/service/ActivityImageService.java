package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.common.media.MediaAssetStorage;
import com.swp391.bookstreet.common.media.MediaAssetType;
import com.swp391.bookstreet.common.media.StoredMediaAsset;
import com.swp391.bookstreet.common.media.ValidatedImageStorage;
import com.swp391.bookstreet.common.media.ValidatedImageStorage.ImageUploadResponse;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Upload prepares an image URL; only existing Activity/change-request commands change domain data. */
@Service
public class ActivityImageService {
    private final ActivityCurrentUser currentUser;
    private final EventService events;
    private final ActivityRepository activities;
    private final PartnerOrganizationRepository organizations;
    private final PartnerOrganizationGuard organizationGuard;
    private final ValidatedImageStorage storage;

    public ActivityImageService(ActivityCurrentUser currentUser, EventService events,
            ActivityRepository activities, PartnerOrganizationRepository organizations,
            PartnerOrganizationGuard organizationGuard,
            MediaAssetStorage mediaAssetStorage) {
        this.currentUser = currentUser;
        this.events = events;
        this.activities = activities;
        this.organizations = organizations;
        this.organizationGuard = organizationGuard;
        this.storage = new ValidatedImageStorage(mediaAssetStorage, MediaAssetType.ACTIVITY_IMAGE);
    }

    @Transactional(readOnly = true)
    public ImageUploadResponse uploadForOrganizer(Long eventId, MultipartFile file) {
        currentUser.requireOrganizerId();
        events.getOwned(eventId);
        return storage.store(file);
    }

    @Transactional(readOnly = true)
    public ImageUploadResponse uploadForPartner(Long activityId, MultipartFile file) {
        Long partnerId = currentUser.requirePartnerId();
        var organization = organizations.findByRepresentativeUserId(partnerId)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                        "PARTNER_ORGANIZATION_REQUIRED", "A Partner organization is required."));
        organizationGuard.requireActive(organization);
        var activity = activities.findOwnedByPartner(activityId, partnerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "ACTIVITY_NOT_FOUND", "Activity not found."));
        if (activity.getStatus() != ActivityStatus.DRAFT && activity.getStatus() != ActivityStatus.PUBLISHED) {
            throw new ApiException(HttpStatus.CONFLICT, "ACTIVITY_IMAGE_NOT_EDITABLE",
                    "Images may only be proposed for Draft or Published activities.");
        }
        return storage.store(file);
    }

    public StoredMediaAsset read(String fileName) {
        return storage.load(fileName);
    }
}
