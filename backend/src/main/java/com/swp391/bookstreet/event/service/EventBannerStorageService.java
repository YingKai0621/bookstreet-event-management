package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.dto.EventBannerUploadResponse;
import com.swp391.bookstreet.event.exception.EventException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class EventBannerStorageService {
    static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final Pattern SAFE_FILE_NAME = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$");
    private static final String PUBLIC_PATH = "/api/v1/media/event-banners/";

    private final Path storageDirectory;

    public EventBannerStorageService(
            @Value("${bookstreet.media.event-banner-directory:uploads/event-banners}")
            String storageDirectory) {
        this.storageDirectory = Path.of(storageDirectory).toAbsolutePath().normalize();
    }

    public EventBannerUploadResponse store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw invalid("Vui lòng chọn một tệp ảnh banner.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw invalid("Ảnh banner không được vượt quá 5 MB.");
        }

        try {
            byte[] content = file.getBytes();
            ImageType imageType = ImageType.detect(file.getContentType(), content);
            String fileName = UUID.randomUUID().toString().toLowerCase(Locale.ROOT)
                    + imageType.extension;
            Files.createDirectories(storageDirectory);
            Path target = storageDirectory.resolve(fileName).normalize();
            if (!target.getParent().equals(storageDirectory)) {
                throw invalid("Tên tệp ảnh banner không hợp lệ.");
            }
            Files.write(target, content, StandardOpenOption.CREATE_NEW,
                    StandardOpenOption.WRITE);
            return new EventBannerUploadResponse(PUBLIC_PATH + fileName);
        } catch (EventException error) {
            throw error;
        } catch (IOException error) {
            throw new EventException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "EVENT_BANNER_STORAGE_FAILED",
                    "Không thể lưu ảnh banner. Vui lòng thử lại.");
        }
    }

    public StoredBanner load(String fileName) {
        if (fileName == null || !SAFE_FILE_NAME.matcher(fileName).matches()) {
            throw notFound();
        }
        Path target = storageDirectory.resolve(fileName).normalize();
        if (!target.getParent().equals(storageDirectory) || !Files.isRegularFile(target)) {
            throw notFound();
        }
        try {
            Resource resource = new UrlResource(target.toUri());
            if (!resource.isReadable()) throw notFound();
            return new StoredBanner(resource, mediaType(fileName));
        } catch (IOException error) {
            throw notFound();
        }
    }

    private static MediaType mediaType(String fileName) {
        if (fileName.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (fileName.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        return MediaType.IMAGE_JPEG;
    }

    private static EventException invalid(String message) {
        return new EventException(HttpStatus.UNPROCESSABLE_CONTENT,
                "EVENT_BANNER_INVALID", message, "file");
    }

    private static EventException notFound() {
        return new EventException(HttpStatus.NOT_FOUND,
                "EVENT_BANNER_NOT_FOUND", "Không tìm thấy ảnh banner.");
    }

    public record StoredBanner(Resource resource, MediaType mediaType) {
    }

    private enum ImageType {
        JPEG(".jpg"),
        PNG(".png"),
        WEBP(".webp");

        private final String extension;

        ImageType(String extension) {
            this.extension = extension;
        }

        static ImageType detect(String contentType, byte[] content) {
            if ("image/jpeg".equalsIgnoreCase(contentType) && isJpeg(content)) return JPEG;
            if ("image/png".equalsIgnoreCase(contentType) && isPng(content)) return PNG;
            if ("image/webp".equalsIgnoreCase(contentType) && isWebp(content)) return WEBP;
            throw invalid("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP hợp lệ.");
        }

        private static boolean isJpeg(byte[] content) {
            return content.length >= 3
                    && (content[0] & 0xff) == 0xff
                    && (content[1] & 0xff) == 0xd8
                    && (content[2] & 0xff) == 0xff;
        }

        private static boolean isPng(byte[] content) {
            int[] signature = {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
            if (content.length < signature.length) return false;
            for (int index = 0; index < signature.length; index++) {
                if ((content[index] & 0xff) != signature[index]) return false;
            }
            return true;
        }

        private static boolean isWebp(byte[] content) {
            return content.length >= 12
                    && content[0] == 'R' && content[1] == 'I'
                    && content[2] == 'F' && content[3] == 'F'
                    && content[8] == 'W' && content[9] == 'E'
                    && content[10] == 'B' && content[11] == 'P';
        }
    }
}
