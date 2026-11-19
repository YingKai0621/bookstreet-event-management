package com.swp391.bookstreet.heritage.service;

import com.swp391.bookstreet.common.media.MediaAssetStorage;
import com.swp391.bookstreet.common.media.MediaAssetType;
import com.swp391.bookstreet.common.media.MediaFileNames;
import com.swp391.bookstreet.common.media.MediaStorageException;
import com.swp391.bookstreet.common.media.StoredMediaAsset;
import com.swp391.bookstreet.heritage.dto.HeritageImageUploadResponse;
import com.swp391.bookstreet.heritage.exception.HeritageApiException;
import com.swp391.bookstreet.heritage.repository.HeritageContentRepository;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class HeritageImageStorageService {
    static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final String PUBLIC_PATH = "/assets/heritage/uploads/";

    private final MediaAssetStorage storage;
    private final HeritageContentRepository repository;

    public HeritageImageStorageService(
            MediaAssetStorage storage,
            HeritageContentRepository repository
    ) {
        this.storage = storage;
        this.repository = repository;
    }

    public HeritageImageUploadResponse store(MultipartFile file) {
        if (file == null || file.isEmpty()) throw invalid("Vui lòng chọn một ảnh di sản.");
        if (file.getSize() > MAX_FILE_SIZE) throw invalid("Ảnh di sản không được vượt quá 5 MB.");

        try {
            byte[] content = file.getBytes();
            ImageType imageType = ImageType.detect(file.getContentType(), content);
            String fileName = MediaFileNames.create(imageType.extension);
            return new HeritageImageUploadResponse(
                    storage.store(MediaAssetType.HERITAGE_IMAGE, fileName, content));
        } catch (HeritageApiException exception) {
            throw exception;
        } catch (IOException | MediaStorageException exception) {
            throw new HeritageApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "HERITAGE_IMAGE_STORAGE_FAILED",
                    "Không thể lưu ảnh di sản. Vui lòng thử lại."
            );
        }
    }

    public StoredMediaAsset load(String fileName) {
        requireSafe(fileName);
        try {
            return storage.load(MediaAssetType.HERITAGE_IMAGE, fileName);
        } catch (MediaStorageException exception) {
            throw notFound();
        }
    }

    public void deleteIfUnreferenced(String fileName) {
        requireSafe(fileName);
        if (repository.existsByImageUrl(PUBLIC_PATH + fileName)) {
            throw new HeritageApiException(
                    HttpStatus.CONFLICT,
                    "HERITAGE_IMAGE_IN_USE",
                    "Ảnh di sản đang được sử dụng và không thể xóa."
            );
        }
        try {
            storage.delete(MediaAssetType.HERITAGE_IMAGE, fileName);
        } catch (MediaStorageException exception) {
            throw new HeritageApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "HERITAGE_IMAGE_DELETE_FAILED",
                    "Không thể xóa ảnh di sản. Vui lòng thử lại."
            );
        }
    }

    private static void requireSafe(String fileName) {
        if (!MediaFileNames.isSafe(fileName)) throw notFound();
    }

    private static HeritageApiException invalid(String message) {
        return new HeritageApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "HERITAGE_IMAGE_INVALID",
                message
        );
    }

    private static HeritageApiException notFound() {
        return new HeritageApiException(
                HttpStatus.NOT_FOUND,
                "HERITAGE_IMAGE_NOT_FOUND",
                "Không tìm thấy ảnh di sản."
        );
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
