package com.swp391.bookstreet.common.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.cloudinary.utils.ObjectUtils;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;

class CloudinaryMediaAssetStorageTests {
    private static final String FILE_NAME = "12345678-1234-1234-1234-123456789abc.png";
    private static final String PUBLIC_ID =
            "bookstreet/event-banners/12345678-1234-1234-1234-123456789abc";

    @Test
    void uploadsToTheBoundedFolderAndKeepsTheExistingPublicApiUrl() throws Exception {
        Uploader uploader = mock(Uploader.class);
        Cloudinary cloudinary = cloudinary(uploader);
        when(uploader.upload(any(byte[].class), anyMap()))
                .thenReturn(Map.of("public_id", PUBLIC_ID));
        CloudinaryMediaAssetStorage storage = new CloudinaryMediaAssetStorage(cloudinary);

        String url = storage.store(MediaAssetType.EVENT_BANNER, FILE_NAME, new byte[]{1, 2, 3});

        assertThat(url).isEqualTo("/api/v1/media/event-banners/" + FILE_NAME);
        @SuppressWarnings("rawtypes")
        ArgumentCaptor<Map> options = ArgumentCaptor.forClass(Map.class);
        verify(uploader).upload(any(byte[].class), options.capture());
        assertThat(options.getValue())
                .containsEntry("public_id", PUBLIC_ID)
                .containsEntry("resource_type", "image")
                .containsEntry("overwrite", false)
                .containsEntry("unique_filename", false);
    }

    @Test
    void readsThroughACloudinaryCdnRedirectAndDeletesByTheSamePublicId() throws Exception {
        Uploader uploader = mock(Uploader.class);
        when(uploader.destroy(any(String.class), anyMap()))
                .thenReturn(Map.of("result", "ok"));
        CloudinaryMediaAssetStorage storage = new CloudinaryMediaAssetStorage(cloudinary(uploader));

        StoredMediaAsset asset = storage.load(MediaAssetType.EVENT_BANNER, FILE_NAME);
        storage.delete(MediaAssetType.EVENT_BANNER, FILE_NAME);

        assertThat(asset.redirects()).isTrue();
        assertThat(asset.resource()).isNull();
        assertThat(asset.redirectUri().getScheme()).isEqualTo("https");
        assertThat(asset.redirectUri().getHost()).isEqualTo("res.cloudinary.com");
        assertThat(asset.redirectUri().getPath())
                .contains("/image/upload/")
                .endsWith("/" + PUBLIC_ID + ".png");
        verify(uploader).destroy(org.mockito.ArgumentMatchers.eq(PUBLIC_ID), anyMap());
    }

    @ParameterizedTest
    @EnumSource(MediaAssetType.class)
    void everyMediaFamilyUsesItsOwnBoundedCloudinaryFolder(MediaAssetType type) {
        CloudinaryMediaAssetStorage storage = new CloudinaryMediaAssetStorage(
                cloudinary(mock(Uploader.class)));

        StoredMediaAsset asset = storage.load(type, FILE_NAME);

        assertThat(asset.redirectUri().getPath())
                .contains("/" + type.cloudinaryFolder() + "/")
                .endsWith("/" + FILE_NAME);
    }

    @Test
    void missingCloudinaryCredentialsFailAtStartupWithoutLeakingValues() {
        MediaStorageProperties.CloudinarySettings settings =
                new MediaStorageProperties.CloudinarySettings();

        assertThatThrownBy(() -> new CloudinaryMediaAssetStorage(settings))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CLOUDINARY_CLOUD_NAME");
    }

    private static Cloudinary cloudinary(Uploader uploader) {
        Cloudinary cloudinary = spy(new Cloudinary(ObjectUtils.asMap(
                "cloud_name", "bookstreet-test",
                "api_key", "test-key",
                "api_secret", "test-secret",
                "secure", true)));
        when(cloudinary.uploader()).thenReturn(uploader);
        return cloudinary;
    }
}
