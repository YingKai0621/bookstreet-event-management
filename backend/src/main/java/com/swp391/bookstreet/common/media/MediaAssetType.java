package com.swp391.bookstreet.common.media;

public enum MediaAssetType {
    EVENT_BANNER("event-banners", "/api/v1/media/event-banners/"),
    BOOTH_IMAGE("booth-images", "/api/v1/media/booth-images/"),
    ACTIVITY_IMAGE("activity-images", "/api/v1/media/activity-images/"),
    BADGE_IMAGE("badge-images", "/api/v1/media/badge-images/"),
    HERITAGE_IMAGE("heritage-images", "/assets/heritage/uploads/");

    private final String cloudinaryFolder;
    private final String publicPath;

    MediaAssetType(String cloudinaryFolder, String publicPath) {
        this.cloudinaryFolder = cloudinaryFolder;
        this.publicPath = publicPath;
    }

    public String cloudinaryFolder() {
        return "bookstreet/" + cloudinaryFolder;
    }

    public String publicPath() {
        return publicPath;
    }
}
