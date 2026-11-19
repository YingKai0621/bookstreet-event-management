package com.swp391.bookstreet.common.media;

import java.net.URI;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;

public record StoredMediaAsset(Resource resource, MediaType mediaType, URI redirectUri) {
    public static StoredMediaAsset local(Resource resource, MediaType mediaType) {
        return new StoredMediaAsset(resource, mediaType, null);
    }

    public static StoredMediaAsset redirect(URI redirectUri, MediaType mediaType) {
        return new StoredMediaAsset(null, mediaType, redirectUri);
    }

    public boolean redirects() {
        return redirectUri != null;
    }
}
