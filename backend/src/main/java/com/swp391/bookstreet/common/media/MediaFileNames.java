package com.swp391.bookstreet.common.media;

import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.MediaType;

public final class MediaFileNames {
    private static final Pattern SAFE_FILE_NAME = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$");

    private MediaFileNames() {
    }

    public static String create(String extension) {
        return UUID.randomUUID().toString().toLowerCase(Locale.ROOT) + extension;
    }

    public static boolean isSafe(String fileName) {
        return fileName != null && SAFE_FILE_NAME.matcher(fileName).matches();
    }

    public static String baseName(String fileName) {
        requireSafe(fileName);
        return fileName.substring(0, fileName.lastIndexOf('.'));
    }

    public static String format(String fileName) {
        requireSafe(fileName);
        return fileName.substring(fileName.lastIndexOf('.') + 1);
    }

    public static MediaType mediaType(String fileName) {
        return switch (format(fileName)) {
            case "png" -> MediaType.IMAGE_PNG;
            case "webp" -> MediaType.parseMediaType("image/webp");
            default -> MediaType.IMAGE_JPEG;
        };
    }

    private static void requireSafe(String fileName) {
        if (!isSafe(fileName)) {
            throw new MediaStorageException("Unsafe media file name.");
        }
    }
}
