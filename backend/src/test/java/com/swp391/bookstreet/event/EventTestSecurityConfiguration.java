package com.swp391.bookstreet.event;

import com.swp391.bookstreet.event.exception.EventErrorResponse;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import tools.jackson.databind.ObjectMapper;

/**
 * Test fixture only. Auth's real configuration must expose the same Event routes.
 * Does not provide login, disable CSRF, or change the production security configuration.
 */
@TestConfiguration(proxyBeanMethods = false)
class EventTestSecurityConfiguration {
    @Bean
    SecurityFilterChain eventTestFilterChain(HttpSecurity http, ObjectMapper mapper) throws Exception {
        http.authorizeHttpRequests(authorize -> authorize
                .requestMatchers(HttpMethod.GET, "/api/v1/events", "/api/v1/events/*").permitAll()
                .anyRequest().authenticated());
        http.exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    mapper.writeValue(response.getOutputStream(), new EventErrorResponse(
                            "AUTHENTICATION_REQUIRED", "An authenticated session is required.",
                            List.of(), Instant.now(), request.getRequestURI()));
                })
                .accessDeniedHandler((request, response, error) -> {
                    response.setStatus(403);
                    response.setContentType("application/json");
                    mapper.writeValue(response.getOutputStream(), new EventErrorResponse(
                            "ACCESS_DENIED", "Access denied.", List.of(),
                            Instant.now(), request.getRequestURI()));
                }));
        return http.build();
    }
}

