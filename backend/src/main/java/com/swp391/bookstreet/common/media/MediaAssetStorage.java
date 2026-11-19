package com.swp391.bookstreet.common.media;

public interface MediaAssetStorage {
    String store(MediaAssetType type, String fileName, byte[] content);

    StoredMediaAsset load(MediaAssetType type, String fileName);

    void delete(MediaAssetType type, String fileName);
}
