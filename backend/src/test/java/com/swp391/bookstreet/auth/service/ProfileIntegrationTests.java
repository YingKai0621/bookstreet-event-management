package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ProfileIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired EntityManager entityManager;

    private record Principal(Long userId) implements AuthenticatedPrincipal {
        public boolean emailVerified() { return false; }
    }

    @Test
    void persistsProfileToPostgresAndIgnoresSuppliedOwnership() throws Exception {
        User owner = users.saveAndFlush(new User("p" + UUID.randomUUID().toString().replace("-", "").substring(0, 18), null, "hash", "Owner Name"));
        User other = users.saveAndFlush(new User("p" + UUID.randomUUID().toString().replace("-", "").substring(0, 18), null, "hash", "Other Name"));
        var auth = UsernamePasswordAuthenticationToken.authenticated(new Principal(owner.getId()), null, List.of());
        mvc.perform(put("/api/v1/auth/profile").with(authentication(auth)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":" + other.getId() + ",\"fullName\":\"  Saved   Name  \",\"phone\":\"0901234567\",\"avatarUrl\":\"data:image/png;base64,aGVsbG8=\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(owner.getId()))
                .andExpect(jsonPath("$.fullName").value("Saved Name"));
        entityManager.clear();
        assertThat(users.findById(owner.getId()).orElseThrow().getAvatarUrl()).isEqualTo("data:image/png;base64,aGVsbG8=");
        assertThat(users.findById(other.getId()).orElseThrow().getFullName()).isEqualTo("Other Name");
        mvc.perform(get("/api/v1/auth/profile").with(authentication(auth)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.fullName").value("Saved Name"));
    }

    @Test
    void requiresAuthenticationCsrfAndValidName() throws Exception {
        mvc.perform(get("/api/v1/auth/profile")).andExpect(status().isUnauthorized());
        var auth = UsernamePasswordAuthenticationToken.authenticated(new Principal(42L), null, List.of());
        mvc.perform(put("/api/v1/auth/profile").with(authentication(auth))
                .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Valid Name\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/auth/profile").with(authentication(auth)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"x\"}"))
                .andExpect(status().isUnprocessableContent());
    }
}
