package com.swp391.bookstreet.common.media;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(MediaStorageProperties.class)
public class MediaStorageConfiguration {
    @Bean
    MediaAssetStorage mediaAssetStorage(MediaStorageProperties properties) {
        return switch (properties.getProvider()) {
            case LOCAL -> new FileSystemMediaAssetStorage(properties);
            case CLOUDINARY -> new CloudinaryMediaAssetStorage(properties.getCloudinary());
        };
    }
}
