package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.dto.BoothImageUploadResponse;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothRepository;
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
public class BoothImageStorageService {
    static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final Pattern SAFE_FILE_NAME = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$");
    private static final String PUBLIC_PATH = "/api/v1/media/booth-images/";

    private final Path storageDirectory;
    private final BoothRepository boothRepository;

    public BoothImageStorageService(
            @Value("${bookstreet.media.booth-image-directory:uploads/booth-images}")
            String storageDirectory,
            BoothRepository boothRepository) {
        this.storageDirectory = Path.of(storageDirectory).toAbsolutePath().normalize();
        this.boothRepository = boothRepository;
    }

    public BoothImageUploadResponse store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw invalid("Vui lòng chọn một ảnh gian hàng.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw invalid("Ảnh gian hàng không được vượt quá 5 MB.");
        }

        try {
            byte[] content = file.getBytes();
            ImageType imageType = ImageType.detect(file.getContentType(), content);
            String fileName = UUID.randomUUID().toString().toLowerCase(Locale.ROOT)
                    + imageType.extension;
            Files.createDirectories(storageDirectory);
            Path target = storageDirectory.resolve(fileName).normalize();
            if (!target.getParent().equals(storageDirectory)) {
                throw invalid("Tên tệp ảnh gian hàng không hợp lệ.");
            }
            Files.write(target, content, StandardOpenOption.CREATE_NEW,
                    StandardOpenOption.WRITE);
            return new BoothImageUploadResponse(PUBLIC_PATH + fileName);
        } catch (BoothApiException error) {
            throw error;
        } catch (IOException error) {
            throw new BoothApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "BOOTH_IMAGE_STORAGE_FAILED",
                    "Không thể lưu ảnh gian hàng. Vui lòng thử lại.");
        }
    }

    public StoredImage load(String fileName) {
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
            return new StoredImage(resource, mediaType(fileName));
        } catch (IOException error) {
            throw notFound();
        }
    }

    public void deleteIfUnreferenced(String fileName) {
        Path target = resolveStoredFile(fileName);
        if (boothRepository.existsByImageUrl(PUBLIC_PATH + fileName)) {
            throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_IMAGE_IN_USE",
                    "Ảnh gian hàng đang được sử dụng và không thể xóa.");
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException error) {
            throw new BoothApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "BOOTH_IMAGE_DELETE_FAILED",
                    "Không thể xóa ảnh gian hàng. Vui lòng thử lại.");
        }
    }

    private Path resolveStoredFile(String fileName) {
        if (fileName == null || !SAFE_FILE_NAME.matcher(fileName).matches()) {
            throw notFound();
        }
        Path target = storageDirectory.resolve(fileName).normalize();
        if (!target.getParent().equals(storageDirectory)) throw notFound();
        return target;
    }

    private static MediaType mediaType(String fileName) {
        if (fileName.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (fileName.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        return MediaType.IMAGE_JPEG;
    }

    private static BoothApiException invalid(String message) {
        return new BoothApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                "BOOTH_IMAGE_INVALID", message, "file");
    }

    private static BoothApiException notFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND,
                "BOOTH_IMAGE_NOT_FOUND", "Không tìm thấy ảnh gian hàng.");
    }

    public record StoredImage(Resource resource, MediaType mediaType) {
    }

    private enum ImageType {
        JPEG(".jpg"), PNG(".png"), WEBP(".webp");

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
