package com.swp391.bookstreet.common.media;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.cloudinary.utils.ObjectUtils;
import java.io.IOException;
import java.net.URI;
import java.util.Map;

public class CloudinaryMediaAssetStorage implements MediaAssetStorage {
    private final Cloudinary cloudinary;

    public CloudinaryMediaAssetStorage(MediaStorageProperties.CloudinarySettings settings) {
        this(new Cloudinary(ObjectUtils.asMap(
                "cloud_name", required(settings.getCloudName(), "CLOUDINARY_CLOUD_NAME"),
                "api_key", required(settings.getApiKey(), "CLOUDINARY_API_KEY"),
                "api_secret", required(settings.getApiSecret(), "CLOUDINARY_API_SECRET"),
                "secure", true)));
    }

    CloudinaryMediaAssetStorage(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    @Override
    public String store(MediaAssetType type, String fileName, byte[] content) {
        String publicId = publicId(type, fileName);
        try {
            Map<?, ?> result = uploader().upload(content, ObjectUtils.asMap(
                    "public_id", publicId,
                    "resource_type", "image",
                    "overwrite", false,
                    "unique_filename", false));
            if (!publicId.equals(String.valueOf(result.get("public_id")))) {
                throw new MediaStorageException("Cloudinary returned an unexpected public ID.");
            }
            return type.publicPath() + fileName;
        } catch (IOException error) {
            throw new MediaStorageException("Unable to upload media asset to Cloudinary.", error);
        }
    }

    @Override
    public StoredMediaAsset load(MediaAssetType type, String fileName) {
        URI deliveryUri = URI.create(cloudinary.url()
                .secure(true)
                .resourceType("image")
                .format(MediaFileNames.format(fileName))
                .generate(publicId(type, fileName)));
        return StoredMediaAsset.redirect(deliveryUri, MediaFileNames.mediaType(fileName));
    }

    @Override
    public void delete(MediaAssetType type, String fileName) {
        try {
            Map<?, ?> result = uploader().destroy(publicId(type, fileName), ObjectUtils.asMap(
                    "resource_type", "image",
                    "invalidate", true));
            String state = String.valueOf(result.get("result"));
            if (!"ok".equals(state) && !"not found".equals(state)) {
                throw new MediaStorageException("Cloudinary did not delete the media asset.");
            }
        } catch (IOException error) {
            throw new MediaStorageException("Unable to delete media asset from Cloudinary.", error);
        }
    }

    private Uploader uploader() {
        return cloudinary.uploader();
    }

    private static String publicId(MediaAssetType type, String fileName) {
        return type.cloudinaryFolder() + "/" + MediaFileNames.baseName(fileName);
    }

    private static String required(String value, String environmentName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(environmentName
                    + " is required when MEDIA_STORAGE_PROVIDER=cloudinary.");
        }
        return value.trim();
    }
}
