package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserToken;
import com.swp391.bookstreet.auth.entity.UserTokenType;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserTokenRepository;
import com.swp391.bookstreet.auth.service.EmailVerificationTokenGenerator;
import com.swp391.bookstreet.auth.service.EmailVerificationTokenService;
import com.swp391.bookstreet.common.exception.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class EmailVerificationConfirmationIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserTokenRepository userTokenRepository;

    @Autowired
    private EmailVerificationTokenGenerator tokenGenerator;

    @Autowired
    private EmailVerificationTokenService tokenService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<Long> createdUserIds = new ArrayList<>();

    @Test
    void validTokenVerifiesEmailAndConsumesToken() throws Exception {
        User user = createUser();
        Instant currentTime = Instant.now().truncatedTo(ChronoUnit.MICROS);
        String rawToken = tokenGenerator.generateRawToken();
        String otherRawToken = tokenGenerator.generateRawToken();

        UserToken token = createToken(
                user,
                rawToken,
                currentTime.minus(5, ChronoUnit.MINUTES),
                currentTime.plus(55, ChronoUnit.MINUTES)
        );
        UserToken otherToken = createToken(
                user,
                otherRawToken,
                currentTime.minus(10, ChronoUnit.MINUTES),
                currentTime.plus(50, ChronoUnit.MINUTES)
        );

        performConfirmation(rawToken)
                .andExpect(status().isNoContent());

        User confirmedUser = userRepository.findById(user.getId()).orElseThrow();
        UserToken consumedToken = userTokenRepository.findById(token.getId()).orElseThrow();
        UserToken revokedToken = userTokenRepository.findById(otherToken.getId()).orElseThrow();

        assertThat(confirmedUser.getEmailVerifiedAt()).isNotNull();
        assertThat(consumedToken.getUsedAt()).isNotNull();
        assertThat(consumedToken.getRevokedAt()).isNull();
        assertThat(revokedToken.getUsedAt()).isNull();
        assertThat(revokedToken.getRevokedAt()).isNotNull();
    }

    @Test
    void unknownTokenReturnsGenericError() throws Exception {
        performConfirmationAndExpectInvalid(tokenGenerator.generateRawToken());
    }

    @Test
    void expiredTokenReturnsSameGenericError() throws Exception {
        User user = createUser();
        Instant currentTime = Instant.now().truncatedTo(ChronoUnit.MICROS);
        String rawToken = tokenGenerator.generateRawToken();

        createToken(
                user,
                rawToken,
                currentTime.minus(120, ChronoUnit.MINUTES),
                currentTime.minus(60, ChronoUnit.MINUTES)
        );

        performConfirmationAndExpectInvalid(rawToken);
        assertThat(userRepository.findById(user.getId()).orElseThrow().getEmailVerifiedAt())
                .isNull();
    }

    @Test
    void usedTokenReturnsSameGenericError() throws Exception {
        User user = createUser();
        Instant currentTime = Instant.now().truncatedTo(ChronoUnit.MICROS);
        String rawToken = tokenGenerator.generateRawToken();
        UserToken token = createToken(
                user,
                rawToken,
                currentTime.minus(10, ChronoUnit.MINUTES),
                currentTime.plus(50, ChronoUnit.MINUTES)
        );
        token.markUsed(currentTime.minus(5, ChronoUnit.MINUTES));
        userTokenRepository.saveAndFlush(token);

        performConfirmationAndExpectInvalid(rawToken);
    }

    @Test
    void revokedTokenReturnsSameGenericError() throws Exception {
        User user = createUser();
        Instant currentTime = Instant.now().truncatedTo(ChronoUnit.MICROS);
        String rawToken = tokenGenerator.generateRawToken();
        UserToken token = createToken(
                user,
                rawToken,
                currentTime.minus(10, ChronoUnit.MINUTES),
                currentTime.plus(50, ChronoUnit.MINUTES)
        );
        token.revoke(currentTime.minus(5, ChronoUnit.MINUTES));
        userTokenRepository.saveAndFlush(token);

        performConfirmationAndExpectInvalid(rawToken);
    }

    @Test
    void malformedRequestReturnsValidationError() throws Exception {
        mockMvc.perform(post("/api/v1/auth/email-verification/confirm")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"short\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("token"));
    }

    @Test
    void confirmationWithoutCsrfIsRejected() throws Exception {
        String rawToken = tokenGenerator.generateRawToken();
        String requestBody = "{\"token\":\"" + rawToken + "\"}";

        mockMvc.perform(post("/api/v1/auth/email-verification/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void concurrentConfirmationConsumesTokenOnlyOnce() throws Exception {
        User user = createUser();
        Instant currentTime = Instant.now().truncatedTo(ChronoUnit.MICROS);
        String rawToken = tokenGenerator.generateRawToken();
        createToken(
                user,
                rawToken,
                currentTime.minus(5, ChronoUnit.MINUTES),
                currentTime.plus(55, ChronoUnit.MINUTES)
        );

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        Callable<Boolean> confirmationTask = new Callable<>() {
            @Override
            public Boolean call() throws Exception {
                readyLatch.countDown();
                startLatch.await();

                try {
                    tokenService.confirmToken(rawToken);
                    return true;
                } catch (ApiException exception) {
                    if (!"INVALID_OR_EXPIRED_VERIFICATION_TOKEN".equals(exception.getCode())) {
                        throw exception;
                    }
                    return false;
                }
            }
        };

        ExecutorService executorService = Executors.newFixedThreadPool(2);

        try {
            Future<Boolean> firstResult = executorService.submit(confirmationTask);
            Future<Boolean> secondResult = executorService.submit(confirmationTask);

            readyLatch.await();
            startLatch.countDown();

            int successfulConfirmations = 0;

            if (firstResult.get()) {
                successfulConfirmations++;
            }
            if (secondResult.get()) {
                successfulConfirmations++;
            }

            assertThat(successfulConfirmations).isEqualTo(1);
        } finally {
            executorService.shutdownNow();
        }

        User confirmedUser = userRepository.findById(user.getId()).orElseThrow();
        assertThat(confirmedUser.getEmailVerifiedAt()).isNotNull();
    }

    @AfterEach
    void removeCommittedTestData() {
        for (Long userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM user_tokens WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", userId);
        }
    }

    private User createUser() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);

        User user = new User(
                "verify" + suffix,
                "verify" + suffix + "@example.com",
                "bcrypt-hash-placeholder",
                "Verification Test User"
        );

        User savedUser = userRepository.saveAndFlush(user);
        createdUserIds.add(savedUser.getId());
        return savedUser;
    }

    private UserToken createToken(
            User user,
            String rawToken,
            Instant createdAt,
            Instant expiresAt
    ) {
        String tokenHash = tokenGenerator.hashToken(rawToken);
        UserToken token = new UserToken(
                user,
                UserTokenType.EMAIL_VERIFICATION,
                tokenHash,
                createdAt,
                expiresAt
        );

        return userTokenRepository.saveAndFlush(token);
    }

    private org.springframework.test.web.servlet.ResultActions performConfirmation(
            String rawToken
    ) throws Exception {
        String requestBody = "{\"token\":\"" + rawToken + "\"}";

        return mockMvc.perform(post("/api/v1/auth/email-verification/confirm")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody));
    }

    private void performConfirmationAndExpectInvalid(String rawToken) throws Exception {
        performConfirmation(rawToken)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code")
                        .value("INVALID_OR_EXPIRED_VERIFICATION_TOKEN"));
    }
}
