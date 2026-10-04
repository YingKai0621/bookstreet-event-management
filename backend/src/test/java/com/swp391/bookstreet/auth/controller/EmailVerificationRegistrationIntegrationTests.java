package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserToken;
import com.swp391.bookstreet.auth.entity.UserTokenType;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserTokenRepository;
import com.swp391.bookstreet.auth.service.EmailVerificationTokenGenerator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class EmailVerificationRegistrationIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserTokenRepository userTokenRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EmailVerificationTokenGenerator tokenGenerator;

    @MockitoBean
    private JavaMailSender mailSender;

    private String createdUsername;

    @Test
    void registrationWithEmailCreatesTokenAndSendsMessageAfterCommit() throws Exception {
        String suffix = uniqueSuffix();
        String username = "mail" + suffix;
        String email = "mail" + suffix + "@example.com";
        createdUsername = username;

        performRegistration(username, email);

        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        Optional<UserToken> tokenResult =
                userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                        user.getId(),
                        UserTokenType.EMAIL_VERIFICATION
                );

        assertThat(tokenResult).isPresent();
        assertThat(tokenResult.get().getUsedAt()).isNull();
        assertThat(tokenResult.get().getRevokedAt()).isNull();

        ArgumentCaptor<SimpleMailMessage> messageCaptor =
                ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(messageCaptor.capture());

        SimpleMailMessage message = messageCaptor.getValue();
        assertThat(message.getTo()).containsExactly(email);
        assertThat(message.getText()).contains("/verify-email?token=");

        String rawToken = readRawTokenFromMessage(message);
        assertThat(tokenResult.get().getTokenHash())
                .isEqualTo(tokenGenerator.hashToken(rawToken));
        assertThat(tokenResult.get().getTokenHash()).isNotEqualTo(rawToken);
    }

    @Test
    void registrationWithoutEmailCreatesNoTokenAndSendsNoMessage() throws Exception {
        String suffix = uniqueSuffix();
        String username = "nomail" + suffix;
        createdUsername = username;

        performRegistrationWithoutEmail(username);

        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        Optional<UserToken> tokenResult =
                userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                        user.getId(),
                        UserTokenType.EMAIL_VERIFICATION
                );

        assertThat(tokenResult).isEmpty();
        verifyNoInteractions(mailSender);
    }

    @Test
    void deliveryFailurePreservesAccountAndRevokesToken() throws Exception {
        String suffix = uniqueSuffix();
        String username = "fail" + suffix;
        String email = "fail" + suffix + "@example.com";
        createdUsername = username;

        doThrow(new MailSendException("Simulated delivery failure"))
                .when(mailSender)
                .send(any(SimpleMailMessage.class));

        performRegistration(username, email);

        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        Optional<UserToken> tokenResult =
                userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                        user.getId(),
                        UserTokenType.EMAIL_VERIFICATION
                );

        assertThat(user.getId()).isNotNull();
        assertThat(tokenResult).isPresent();
        assertThat(tokenResult.get().getRevokedAt()).isNotNull();
    }

    @AfterEach
    void removeCommittedTestAccount() {
        if (createdUsername == null) {
            return;
        }

        Optional<User> userResult = userRepository.findByUsernameIgnoreCase(createdUsername);

        if (userResult.isEmpty()) {
            return;
        }

        Long userId = userResult.get().getId();
        jdbcTemplate.update("DELETE FROM user_tokens WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", userId);
    }

    private void performRegistration(String username, String email) throws Exception {
        String requestBody = """
                {
                  "username": "%s",
                  "fullName": "Email Verification User",
                  "password": "learning-password",
                  "confirmPassword": "learning-password",
                  "email": "%s"
                }
                """.formatted(username, email);

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated());
    }

    private void performRegistrationWithoutEmail(String username) throws Exception {
        String requestBody = """
                {
                  "username": "%s",
                  "fullName": "No Email User",
                  "password": "learning-password",
                  "confirmPassword": "learning-password",
                  "email": null
                }
                """.formatted(username);

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated());
    }

    private String readRawTokenFromMessage(SimpleMailMessage message) {
        String messageText = message.getText();
        String tokenMarker = "/verify-email?token=";
        int tokenStart = messageText.indexOf(tokenMarker) + tokenMarker.length();
        int tokenEnd = messageText.indexOf('\n', tokenStart);

        return messageText.substring(tokenStart, tokenEnd).trim();
    }

    private String uniqueSuffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }
}
