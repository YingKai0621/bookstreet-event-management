package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthRegistrationIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void registerCreatesActiveParticipantAndHashesPassword() throws Exception {
        String suffix = uniqueSuffix();
        String username = "part" + suffix;
        String rawPassword = "learning-password";

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(username, "Student Account", rawPassword, rawPassword, null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").isNumber())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.fullName").value("Student Account"))
                .andExpect(jsonPath("$.email").isEmpty())
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.roles[0]").value("PARTICIPANT"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        User savedUser = userRepository.findByUsernameIgnoreCase(username).orElseThrow();

        assertThat(savedUser.getPasswordHash()).isNotEqualTo(rawPassword);
        assertThat(passwordEncoder.matches(rawPassword, savedUser.getPasswordHash())).isTrue();
        assertThat(savedUser.getUserRoles())
                .extracting(userRole -> userRole.getRole().getCode())
                .containsExactly(RoleCode.PARTICIPANT);
    }

    @Test
    void registerRejectsPasswordConfirmationMismatch() throws Exception {
        String username = "mismatch" + uniqueSuffix();

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(
                                username,
                                "Mismatch Account",
                                "first-password",
                                "second-password",
                                null
                        )))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("PASSWORD_CONFIRMATION_MISMATCH"));

        assertThat(userRepository.existsByUsernameIgnoreCase(username)).isFalse();
    }

    @Test
    void registerRejectsCaseInsensitiveDuplicateUsername() throws Exception {
        String suffix = uniqueSuffix();
        String username = "duplicate" + suffix;

        performSuccessfulRegistration(username, "First Account", null);

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(
                                username.toUpperCase(),
                                "Second Account",
                                "learning-password",
                                "learning-password",
                                null
                        )))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_ALREADY_EXISTS"));
    }

    @Test
    void registerRejectsCaseInsensitiveDuplicateEmail() throws Exception {
        String suffix = uniqueSuffix();
        String email = "student_" + suffix + "@example.com";

        performSuccessfulRegistration("first" + suffix, "First Account", email);

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(
                                "second" + suffix,
                                "Second Account",
                                "learning-password",
                                "learning-password",
                                email.toUpperCase()
                        )))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
    }

    @Test
    void registerReportsRequestValidationErrors() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("", "", "", "", "not-an-email")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors").isArray())
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItems(
                        "username",
                        "fullName",
                        "password",
                        "confirmPassword",
                        "email"
                )));
    }

    @Test
    void registerAcceptsApprovedLengthBoundaries() throws Exception {
        String minimumPassword = "a".repeat(8);
        String maximumPassword = "b".repeat(64);

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("Abc", "An", minimumPassword, minimumPassword, null)))
                .andExpect(status().isCreated());

        String maximumUsername = "B" + "1".repeat(19);
        String maximumFullName = "N".repeat(50);

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(
                                maximumUsername,
                                maximumFullName,
                                maximumPassword,
                                maximumPassword,
                                null
                        )))
                .andExpect(status().isCreated());
    }

    @Test
    void registerRejectsUsernameOutsideApprovedFormat() throws Exception {
        expectRegistrationFieldError("ab", "Valid Account", "learning-password", "username");
        expectRegistrationFieldError("1booklover", "Valid Account", "learning-password", "username");
        expectRegistrationFieldError("book_lover", "Valid Account", "learning-password", "username");
        expectRegistrationFieldError("a".repeat(21), "Valid Account", "learning-password", "username");
    }

    @Test
    void registerRejectsFullNameOutsideApprovedLength() throws Exception {
        expectRegistrationFieldError("validuser", "A", "learning-password", "fullName");
        expectRegistrationFieldError("validuser", "A".repeat(51), "learning-password", "fullName");
    }

    @Test
    void registerRejectsPasswordOutsideApprovedLimits() throws Exception {
        expectRegistrationFieldError("validuser", "Valid Account", "a".repeat(7), "password");
        expectRegistrationFieldError("validuser", "Valid Account", "a".repeat(65), "password");

        String passwordOverBcryptByteLimit = "😀".repeat(19);
        expectRegistrationFieldError(
                "validuser",
                "Valid Account",
                passwordOverBcryptByteLimit,
                "password"
        );
    }

    @Test
    void registerNormalizesFullNameAndEmail() throws Exception {
        String suffix = uniqueSuffix();
        String username = "normal" + suffix;
        String email = "student" + suffix + "@example.com";

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(
                                username,
                                "  Nguyễn   Văn An  ",
                                "learning-password",
                                "learning-password",
                                "  " + email + "  "
                        )))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fullName").value("Nguyễn Văn An"))
                .andExpect(jsonPath("$.email").value(email));

        User savedUser = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        assertThat(savedUser.getFullName()).isEqualTo("Nguyễn Văn An");
        assertThat(savedUser.getEmail()).isEqualTo(email);
    }

    @Test
    void registerRemainsProtectedByCsrf() throws Exception {
        String suffix = uniqueSuffix();

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(
                                "csrf" + suffix,
                                "CSRF Account",
                                "learning-password",
                                "learning-password",
                                null
                        )))
                .andExpect(status().isForbidden());
    }

    private void performSuccessfulRegistration(String username, String fullName, String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(
                                username,
                                fullName,
                                "learning-password",
                                "learning-password",
                                email
                        )))
                .andExpect(status().isCreated());
    }

    private void expectRegistrationFieldError(
            String username,
            String fullName,
            String password,
            String expectedField
    ) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(username, fullName, password, password, null)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItems(expectedField)));
    }

    private String registerJson(
            String username,
            String fullName,
            String password,
            String confirmPassword,
            String email
    ) {
        String emailJson = email == null ? "null" : "\"" + email + "\"";
        return """
                {
                  "username": "%s",
                  "fullName": "%s",
                  "password": "%s",
                  "confirmPassword": "%s",
                  "email": %s
                }
                """.formatted(username, fullName, password, confirmPassword, emailJson);
    }

    private String uniqueSuffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }
}
