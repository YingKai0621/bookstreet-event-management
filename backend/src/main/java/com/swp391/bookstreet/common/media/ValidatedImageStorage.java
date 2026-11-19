package com.swp391.bookstreet.common.media;

import com.swp391.bookstreet.common.exception.ApiException;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

/** Validates editor image content before delegating durable storage to the configured provider. */
public final class ValidatedImageStorage {
    private static final long MAX_SIZE = 5L * 1024 * 1024;
    private final MediaAssetStorage storage;
    private final MediaAssetType assetType;

    public ValidatedImageStorage(MediaAssetStorage storage, MediaAssetType assetType) {
        this.storage = storage;
        this.assetType = assetType;
    }

    public ImageUploadResponse store(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_SIZE) {
            throw invalid();
        }
        try {
            byte[] bytes = file.getBytes();
            String name = MediaFileNames.create(extension(file.getContentType(), bytes));
            return new ImageUploadResponse(storage.store(assetType, name, bytes));
        } catch (MediaStorageException error) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "IMAGE_STORAGE_FAILED",
                    "Unable to store the image. Please try again.");
        } catch (IOException error) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "IMAGE_STORAGE_FAILED",
                    "Unable to read the image. Please try again.");
        }
    }

    public StoredMediaAsset load(String name) {
        if (!MediaFileNames.isSafe(name)) {
            throw notFound();
        }
        try {
            return storage.load(assetType, name);
        } catch (MediaStorageException error) {
            throw notFound();
        }
    }

    private static String extension(String type, byte[] bytes) {
        if ("image/jpeg".equalsIgnoreCase(type) && bytes.length >= 3
                && (bytes[0] & 255) == 255 && (bytes[1] & 255) == 216 && (bytes[2] & 255) == 255) {
            return ".jpg";
        }
        int[] png = {137, 80, 78, 71, 13, 10, 26, 10};
        if ("image/png".equalsIgnoreCase(type) && bytes.length >= png.length) {
            boolean matches = true;
            for (int index = 0; index < png.length; index++) {
                matches &= (bytes[index] & 255) == png[index];
            }
            if (matches) {
                return ".png";
            }
        }
        if ("image/webp".equalsIgnoreCase(type) && bytes.length >= 12
                && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return ".webp";
        }
        throw invalid();
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "IMAGE_INVALID",
                "Choose a valid JPG, PNG or WebP image, up to 5 MB.");
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "IMAGE_NOT_FOUND", "Image not found.");
    }

    public record ImageUploadResponse(String url) {
    }
}
