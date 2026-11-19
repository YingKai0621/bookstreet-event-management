package com.swp391.bookstreet.common.media;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.swp391.bookstreet.activity.controller.ActivityImageController;
import com.swp391.bookstreet.activity.service.ActivityImageService;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.common.media.ValidatedImageStorage.ImageUploadResponse;
import com.swp391.bookstreet.reward.controller.BadgeImageController;
import com.swp391.bookstreet.reward.service.BadgeImageService;
import com.swp391.bookstreet.security.config.BrowserSecurityProperties;
import com.swp391.bookstreet.security.config.SecurityConfiguration;
import com.swp391.bookstreet.security.handler.RestAccessDeniedHandler;
import com.swp391.bookstreet.security.handler.RestAuthenticationEntryPoint;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import tools.jackson.databind.ObjectMapper;

/** Exercises the production security chain without a database, Redis or test-only security rules. */
class EditorImageSecurityTests {
    AnnotationConfigWebApplicationContext context;
    MockMvc mvc;
    MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", new byte[]{1});

    @BeforeEach void setup() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(Config.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean(FilterChainProxy.class)).build();
        when(context.getBean(BadgeImageService.class).upload(any()))
                .thenReturn(new ImageUploadResponse("/api/v1/media/badge-images/a.png"));
        when(context.getBean(ActivityImageService.class).uploadForOrganizer(anyLong(), any()))
                .thenReturn(new ImageUploadResponse("/api/v1/media/activity-images/a.png"));
        when(context.getBean(ActivityImageService.class).uploadForPartner(anyLong(), any()))
                .thenReturn(new ImageUploadResponse("/api/v1/media/activity-images/a.png"));
    }

    @AfterEach void close() { context.close(); }

    @Test void eachUploadRequiresItsOwnRoleAndCsrf() throws Exception {
        String[] paths = {"/api/v1/admin/badge-images",
                "/api/v1/organizer/events/1/activity-images", "/api/v1/partner/activities/1/images"};
        String[] roles = {"ADMIN", "ORGANIZER", "PARTNER"};
        for (int i = 0; i < paths.length; i++) {
            mvc.perform(multipart(paths[i]).file(file).session(session(roles[i])))
                    .andExpect(status().isForbidden());
            mvc.perform(multipart(paths[i]).file(file).cookie(csrf()).header("X-XSRF-TOKEN", "test"))
                    .andExpect(status().isUnauthorized());
            for (String role : new String[]{"ADMIN", "ORGANIZER", "PARTNER", "PARTICIPANT"}) {
                mvc.perform(multipart(paths[i]).file(file).session(session(role))
                                .cookie(csrf()).header("X-XSRF-TOKEN", "test"))
                        .andExpect(role.equals(roles[i]) ? status().isCreated() : status().isForbidden());
            }
        }
    }

    @Test void imageReadsArePublicAndGenericUploadIsGone() throws Exception {
        var image = StoredMediaAsset.local(
                new ByteArrayResource(new byte[]{1}), MediaType.IMAGE_PNG);
        when(context.getBean(BadgeImageService.class).read("a.png")).thenReturn(image);
        when(context.getBean(ActivityImageService.class).read("a.png")).thenReturn(image);
        for (String domain : new String[]{"badge-images", "activity-images"}) {
            mvc.perform(get("/api/v1/media/" + domain + "/a.png"))
                    .andExpect(status().isOk()).andExpect(content().contentType(MediaType.IMAGE_PNG))
                    .andExpect(header().string("Cache-Control", "no-store"));
        }
        mvc.perform(multipart("/api/v1/media/images").file(file).session(session("ADMIN"))
                        .cookie(csrf()).header("X-XSRF-TOKEN", "test"))
                .andExpect(status().isNotFound());
    }

    private Cookie csrf() { return new Cookie("XSRF-TOKEN", "test"); }
    private MockHttpSession session(String role) {
        var session = new MockHttpSession();
        session.setAttribute("SPRING_SECURITY_CONTEXT", new SecurityContextImpl(
                new UsernamePasswordAuthenticationToken("editor", "unused",
                        AuthorityUtils.createAuthorityList("ROLE_" + role))));
        return session;
    }

    @Configuration @EnableWebMvc @EnableWebSecurity
    @Import({SecurityConfiguration.class, BadgeImageController.class, ActivityImageController.class,
            RestAccessDeniedHandler.class, RestAuthenticationEntryPoint.class})
    static class Config {
        @Bean BadgeImageService badges() { return mock(BadgeImageService.class); }
        @Bean ActivityImageService activities() { return mock(ActivityImageService.class); }
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean UserDetailsService userDetails() { return mock(UserDetailsService.class); }
        @Bean PasswordEncoder passwords() { return new BCryptPasswordEncoder(); }
        @Bean BrowserSecurityProperties properties() { return new BrowserSecurityProperties(); }
        @Bean ObjectMapper mapper() { return new ObjectMapper(); }
    }
}
