package com.swp391.bookstreet.common.media;

import java.nio.file.Path;

public final class MediaStorageTestSupport {
    private MediaStorageTestSupport() {
    }

    public static MediaAssetStorage local(Path directory) {
        String value = directory.toString();
        MediaStorageProperties properties = new MediaStorageProperties();
        properties.setEventBannerDirectory(value);
        properties.setBoothImageDirectory(value);
        properties.setHeritageImageDirectory(value);
        properties.setActivityImageDirectory(value);
        properties.setBadgeImageDirectory(value);
        return new FileSystemMediaAssetStorage(properties);
    }
}
