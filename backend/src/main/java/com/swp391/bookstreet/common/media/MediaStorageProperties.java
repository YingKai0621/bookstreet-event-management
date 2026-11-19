package com.swp391.bookstreet.common.media;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bookstreet.media")
public class MediaStorageProperties {
    public enum Provider {
        LOCAL,
        CLOUDINARY
    }

    private Provider provider = Provider.LOCAL;
    private String eventBannerDirectory = "uploads/event-banners";
    private String boothImageDirectory = "uploads/booth-images";
    private String heritageImageDirectory = "uploads/heritage-images";
    private String activityImageDirectory = "uploads/activity-images";
    private String badgeImageDirectory = "uploads/badge-images";
    private CloudinarySettings cloudinary = new CloudinarySettings();

    public Provider getProvider() {
        return provider;
    }

    public void setProvider(Provider provider) {
        this.provider = provider;
    }

    public String getEventBannerDirectory() {
        return eventBannerDirectory;
    }

    public void setEventBannerDirectory(String eventBannerDirectory) {
        this.eventBannerDirectory = eventBannerDirectory;
    }

    public String getBoothImageDirectory() {
        return boothImageDirectory;
    }

    public void setBoothImageDirectory(String boothImageDirectory) {
        this.boothImageDirectory = boothImageDirectory;
    }

    public String getHeritageImageDirectory() {
        return heritageImageDirectory;
    }

    public void setHeritageImageDirectory(String heritageImageDirectory) {
        this.heritageImageDirectory = heritageImageDirectory;
    }

    public String getActivityImageDirectory() {
        return activityImageDirectory;
    }

    public void setActivityImageDirectory(String activityImageDirectory) {
        this.activityImageDirectory = activityImageDirectory;
    }

    public String getBadgeImageDirectory() {
        return badgeImageDirectory;
    }

    public void setBadgeImageDirectory(String badgeImageDirectory) {
        this.badgeImageDirectory = badgeImageDirectory;
    }

    public CloudinarySettings getCloudinary() {
        return cloudinary;
    }

    public void setCloudinary(CloudinarySettings cloudinary) {
        this.cloudinary = cloudinary;
    }

    public Path directory(MediaAssetType type) {
        String configured = switch (type) {
            case EVENT_BANNER -> eventBannerDirectory;
            case BOOTH_IMAGE -> boothImageDirectory;
            case HERITAGE_IMAGE -> heritageImageDirectory;
            case ACTIVITY_IMAGE -> activityImageDirectory;
            case BADGE_IMAGE -> badgeImageDirectory;
        };
        return Path.of(configured).toAbsolutePath().normalize();
    }

    public static class CloudinarySettings {
        private String cloudName = "";
        private String apiKey = "";
        private String apiSecret = "";

        public String getCloudName() {
            return cloudName;
        }

        public void setCloudName(String cloudName) {
            this.cloudName = cloudName;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getApiSecret() {
            return apiSecret;
        }

        public void setApiSecret(String apiSecret) {
            this.apiSecret = apiSecret;
        }
    }
}
