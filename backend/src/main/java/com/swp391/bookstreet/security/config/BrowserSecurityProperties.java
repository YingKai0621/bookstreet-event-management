package com.swp391.bookstreet.security.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.util.ArrayList;
import java.util.List;

@Component
@Validated
@ConfigurationProperties(prefix = "bookstreet.browser-security")
public class BrowserSecurityProperties {

    @NotEmpty
    private List<@NotBlank String> allowedOrigins = new ArrayList<>();

    private boolean sessionCookieSecure;

    @NotBlank
    @Pattern(
            regexp = "^(Lax|Strict|None)$",
            message = "must be Lax, Strict or None"
    )
    private String sessionCookieSameSite = "Lax";

    public List<String> getAllowedOrigins() {
        return List.copyOf(allowedOrigins);
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = new ArrayList<>(allowedOrigins);
    }

    public boolean isSessionCookieSecure() {
        return sessionCookieSecure;
    }

    public void setSessionCookieSecure(boolean sessionCookieSecure) {
        this.sessionCookieSecure = sessionCookieSecure;
    }

    public String getSessionCookieSameSite() {
        return sessionCookieSameSite;
    }

    public void setSessionCookieSameSite(String sessionCookieSameSite) {
        this.sessionCookieSameSite = sessionCookieSameSite;
    }

    @AssertTrue(message = "allowed origins must not contain the wildcard origin")
    public boolean isAllowedOriginsSafe() {
        for (String allowedOrigin : allowedOrigins) {
            if ("*".equals(allowedOrigin)) {
                return false;
            }
        }

        return true;
    }

    @AssertTrue(message = "SameSite=None requires a Secure session cookie")
    public boolean isSameSiteNoneSecure() {
        if (!"None".equals(sessionCookieSameSite)) {
            return true;
        }

        return sessionCookieSecure;
    }
}
