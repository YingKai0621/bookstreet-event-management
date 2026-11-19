package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.dto.BoothImageUploadResponse;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothRepository;
import com.swp391.bookstreet.common.media.MediaAssetStorage;
import com.swp391.bookstreet.common.media.MediaAssetType;
import com.swp391.bookstreet.common.media.MediaFileNames;
import com.swp391.bookstreet.common.media.MediaStorageException;
import com.swp391.bookstreet.common.media.StoredMediaAsset;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class BoothImageStorageService {
    static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final String PUBLIC_PATH = "/api/v1/media/booth-images/";

    private final MediaAssetStorage storage;
    private final BoothRepository boothRepository;

    public BoothImageStorageService(
            MediaAssetStorage storage,
            BoothRepository boothRepository) {
        this.storage = storage;
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
            String fileName = MediaFileNames.create(imageType.extension);
            return new BoothImageUploadResponse(
                    storage.store(MediaAssetType.BOOTH_IMAGE, fileName, content));
        } catch (BoothApiException error) {
            throw error;
        } catch (IOException | MediaStorageException error) {
            throw new BoothApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "BOOTH_IMAGE_STORAGE_FAILED",
                    "Không thể lưu ảnh gian hàng. Vui lòng thử lại.");
        }
    }

    public StoredMediaAsset load(String fileName) {
        if (!MediaFileNames.isSafe(fileName)) {
            throw notFound();
        }
        try {
            return storage.load(MediaAssetType.BOOTH_IMAGE, fileName);
        } catch (MediaStorageException error) {
            throw notFound();
        }
    }

    public void deleteIfUnreferenced(String fileName) {
        requireSafe(fileName);
        if (boothRepository.existsByImageUrl(PUBLIC_PATH + fileName)) {
            throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_IMAGE_IN_USE",
                    "Ảnh gian hàng đang được sử dụng và không thể xóa.");
        }
        try {
            storage.delete(MediaAssetType.BOOTH_IMAGE, fileName);
        } catch (MediaStorageException error) {
            throw new BoothApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "BOOTH_IMAGE_DELETE_FAILED",
                    "Không thể xóa ảnh gian hàng. Vui lòng thử lại.");
        }
    }

    private static void requireSafe(String fileName) {
        if (!MediaFileNames.isSafe(fileName)) {
            throw notFound();
        }
    }

    private static BoothApiException invalid(String message) {
        return new BoothApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                "BOOTH_IMAGE_INVALID", message, "file");
    }

    private static BoothApiException notFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND,
                "BOOTH_IMAGE_NOT_FOUND", "Không tìm thấy ảnh gian hàng.");
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
