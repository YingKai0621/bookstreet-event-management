package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.common.media.MediaAssetStorage;
import com.swp391.bookstreet.common.media.MediaAssetType;
import com.swp391.bookstreet.common.media.StoredMediaAsset;
import com.swp391.bookstreet.common.media.ValidatedImageStorage;
import com.swp391.bookstreet.common.media.ValidatedImageStorage.ImageUploadResponse;
import com.swp391.bookstreet.reward.security.RewardManagementCurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class BadgeImageService {
    private final RewardManagementCurrentUser currentUser;
    private final ValidatedImageStorage storage;

    public BadgeImageService(RewardManagementCurrentUser currentUser,
            MediaAssetStorage mediaAssetStorage) {
        this.currentUser = currentUser;
        this.storage = new ValidatedImageStorage(mediaAssetStorage, MediaAssetType.BADGE_IMAGE);
    }

    public ImageUploadResponse upload(MultipartFile file) {
        currentUser.requireAdmin();
        return storage.store(file);
    }

    public StoredMediaAsset read(String fileName) {
        return storage.load(fileName);
    }
}
