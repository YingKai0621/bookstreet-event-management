package com.swp391.bookstreet.common.media;

import com.swp391.bookstreet.common.exception.ApiException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

/** File I/O only. The owning feature authorizes uploads and chooses its own directory and URL. */
public final class LocalImageStorage {
    private static final long MAX_SIZE = 5L * 1024 * 1024;
    private static final Pattern FILE_NAME = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$");
    private final Path directory;
    private final String publicPath;

    public LocalImageStorage(String directory, String publicPath) {
        this.directory = Path.of(directory).toAbsolutePath().normalize();
        this.publicPath = publicPath;
    }

    public ImageUploadResponse store(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_SIZE) {
            throw invalid();
        }
        try {
            byte[] bytes = file.getBytes();
            String extension = extension(file.getContentType(), bytes);
            String name = UUID.randomUUID() + extension;
            Files.createDirectories(directory);
            Files.write(directory.resolve(name), bytes, StandardOpenOption.CREATE_NEW);
            return new ImageUploadResponse(publicPath + name);
        } catch (IOException error) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "IMAGE_STORAGE_FAILED",
                    "Unable to store the image. Please try again.");
        }
    }

    public StoredImage load(String name) {
        if (name == null || !FILE_NAME.matcher(name).matches()) throw notFound();
        Path file = directory.resolve(name).normalize();
        if (!directory.equals(file.getParent()) || !Files.isRegularFile(file)) throw notFound();
        try {
            Resource resource = new UrlResource(file.toUri());
            if (!resource.isReadable()) throw notFound();
            MediaType type = name.endsWith(".jpg") ? MediaType.IMAGE_JPEG
                    : name.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.parseMediaType("image/webp");
            return new StoredImage(resource, type);
        } catch (IOException error) {
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
            for (int i = 0; i < png.length; i++) matches &= (bytes[i] & 255) == png[i];
            if (matches) return ".png";
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

    public record ImageUploadResponse(String url) { }
    public record StoredImage(Resource resource, MediaType mediaType) { }
}
