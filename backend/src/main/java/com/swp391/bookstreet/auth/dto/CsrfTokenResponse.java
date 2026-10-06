package com.swp391.bookstreet.auth.dto;

public record CsrfTokenResponse(
        String headerName,
        String token
) {
}
