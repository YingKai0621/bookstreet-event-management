package com.swp391.bookstreet.common.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import org.springframework.core.io.UrlResource;

public class FileSystemMediaAssetStorage implements MediaAssetStorage {
    private final MediaStorageProperties properties;

    public FileSystemMediaAssetStorage(MediaStorageProperties properties) {
        this.properties = properties;
    }

    @Override
    public String store(MediaAssetType type, String fileName, byte[] content) {
        Path target = resolve(type, fileName);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
            return type.publicPath() + fileName;
        } catch (IOException error) {
            throw new MediaStorageException("Unable to store media asset.", error);
        }
    }

    @Override
    public StoredMediaAsset load(MediaAssetType type, String fileName) {
        Path target = resolve(type, fileName);
        if (!Files.isRegularFile(target)) {
            throw new MediaStorageException("Media asset not found.");
        }
        try {
            UrlResource resource = new UrlResource(target.toUri());
            if (!resource.isReadable()) {
                throw new MediaStorageException("Media asset not found.");
            }
            return StoredMediaAsset.local(resource, MediaFileNames.mediaType(fileName));
        } catch (IOException error) {
            throw new MediaStorageException("Media asset not found.", error);
        }
    }

    @Override
    public void delete(MediaAssetType type, String fileName) {
        try {
            Files.deleteIfExists(resolve(type, fileName));
        } catch (IOException error) {
            throw new MediaStorageException("Unable to delete media asset.", error);
        }
    }

    private Path resolve(MediaAssetType type, String fileName) {
        if (!MediaFileNames.isSafe(fileName)) {
            throw new MediaStorageException("Unsafe media file name.");
        }
        Path directory = properties.directory(type);
        Path target = directory.resolve(fileName).normalize();
        if (!directory.equals(target.getParent())) {
            throw new MediaStorageException("Unsafe media file name.");
        }
        return target;
    }
}
