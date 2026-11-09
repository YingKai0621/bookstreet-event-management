package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.common.media.LocalImageStorage;
import com.swp391.bookstreet.common.media.LocalImageStorage.ImageUploadResponse;
import com.swp391.bookstreet.common.media.LocalImageStorage.StoredImage;
import com.swp391.bookstreet.reward.security.RewardManagementCurrentUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class BadgeImageService {
    private final RewardManagementCurrentUser currentUser;
    private final LocalImageStorage storage;

    public BadgeImageService(RewardManagementCurrentUser currentUser,
            @Value("${bookstreet.media.badge-image-directory:uploads/badge-images}") String directory) {
        this.currentUser = currentUser;
        this.storage = new LocalImageStorage(directory, "/api/v1/media/badge-images/");
    }

    public ImageUploadResponse upload(MultipartFile file) {
        currentUser.requireAdmin();
        return storage.store(file);
    }

    public StoredImage read(String fileName) {
        return storage.load(fileName);
    }
}
