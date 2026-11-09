package com.swp391.bookstreet.security.config;

import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.security.authentication.SessionEnforcementFilter;
import com.swp391.bookstreet.security.handler.RestAccessDeniedHandler;
import com.swp391.bookstreet.security.handler.RestAuthenticationEntryPoint;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfiguration {

    @Bean
    AuthenticationProvider authenticationProvider(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder
    ) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) {
        return configuration.getAuthenticationManager();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    CsrfTokenRepository csrfTokenRepository(BrowserSecurityProperties properties) {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookiePath("/");
        repository.setCookieCustomizer(cookieBuilder -> cookieBuilder
                .secure(properties.isSessionCookieSecure())
                .sameSite(properties.getSessionCookieSameSite())
        );
        return repository;
    }

    @Bean
    SessionAuthenticationStrategy sessionAuthenticationStrategy(
            CsrfTokenRepository csrfTokenRepository
    ) {
        ChangeSessionIdAuthenticationStrategy changeSessionIdStrategy =
                new ChangeSessionIdAuthenticationStrategy();
        CsrfAuthenticationStrategy csrfAuthenticationStrategy =
                new CsrfAuthenticationStrategy(csrfTokenRepository);

        return new CompositeSessionAuthenticationStrategy(List.of(
                changeSessionIdStrategy,
                csrfAuthenticationStrategy
        ));
    }

    @Bean
    CookieSerializer sessionCookieSerializer(BrowserSecurityProperties properties) {
        DefaultCookieSerializer cookieSerializer = new DefaultCookieSerializer();
        cookieSerializer.setCookieName("SESSION");
        cookieSerializer.setCookiePath("/");
        cookieSerializer.setUseHttpOnlyCookie(true);
        cookieSerializer.setUseSecureCookie(properties.isSessionCookieSecure());
        cookieSerializer.setSameSite(properties.getSessionCookieSameSite());
        return cookieSerializer;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(BrowserSecurityProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.getAllowedOrigins());
        configuration.setAllowedMethods(List.of(
                HttpMethod.GET.name(),
                HttpMethod.POST.name(),
                HttpMethod.PUT.name(),
                HttpMethod.PATCH.name(),
                HttpMethod.DELETE.name(),
                HttpMethod.OPTIONS.name()
        ));
        configuration.setAllowedHeaders(List.of(
                "Accept",
                "Content-Type",
                "X-XSRF-TOKEN",
                "Idempotency-Key"
        ));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            SecurityContextRepository securityContextRepository,
            CsrfTokenRepository csrfTokenRepository,
            CorsConfigurationSource corsConfigurationSource,
            RestAuthenticationEntryPoint authenticationEntryPoint,
            RestAccessDeniedHandler accessDeniedHandler,
            UserRepository userRepository
    ) throws Exception {
        http.securityContext(securityContext -> securityContext
                .securityContextRepository(securityContextRepository)
        );

        CsrfTokenRequestAttributeHandler csrfRequestHandler =
                new CsrfTokenRequestAttributeHandler();
        csrfRequestHandler.setCsrfRequestAttributeName(null);

        http.csrf(csrf -> csrf
                .csrfTokenRepository(csrfTokenRepository)
                .csrfTokenRequestHandler(csrfRequestHandler)
                .ignoringRequestMatchers("/api/v1/payments/vnpay/ipn")
        );

        http.cors(cors -> cors.configurationSource(corsConfigurationSource));

        // Before the anonymous filter, so that an ended Session continues as an anonymous request.
        http.addFilterBefore(new SessionEnforcementFilter(userRepository), AnonymousAuthenticationFilter.class);

        http.authorizeHttpRequests(authorize -> authorize
                // The original request was authorized; this only finishes an open notification stream.
                .dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()
                .requestMatchers(
                        "/api/v1/auth/register",
                        "/api/v1/auth/login",
                        "/api/v1/auth/csrf",
                        "/api/v1/auth/email-verification/confirm",
                        "/api/v1/auth/password-reset/request",
                        "/api/v1/auth/password-reset/confirm",
                        "/error",
                        "/v3/api-docs/**",
                        "/swagger-ui.html",
                        "/swagger-ui/**"
                ).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/payments/vnpay/ipn").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/media/event-banners/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/media/booth-images/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/media/badge-images/**",
                        "/api/v1/media/activity-images/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/assets/heritage/uploads/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/events", "/api/v1/events/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/activities", "/api/v1/activities/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/heritages", "/api/v1/heritages/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/public/feedbacks").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/chat/messages").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/events/{eventId}/applications").hasRole("PARTNER")
                .requestMatchers("/api/v1/participant/notifications", "/api/v1/participant/notifications/**")
                .hasRole("PARTICIPANT")
                .requestMatchers("/api/v1/partner/notifications", "/api/v1/partner/notifications/**")
                .hasRole("PARTNER")
                .requestMatchers("/api/v1/organizer/notifications", "/api/v1/organizer/notifications/**")
                .hasRole("ORGANIZER")
                .requestMatchers("/api/v1/admin/notifications", "/api/v1/admin/notifications/**")
                .hasRole("ADMIN")
                .requestMatchers("/api/v1/participant/**").hasRole("PARTICIPANT")
                .requestMatchers("/api/v1/organizer/feedbacks", "/api/v1/organizer/feedbacks/**")
                .hasRole("ORGANIZER")
                .requestMatchers("/api/v1/organizer/heritages", "/api/v1/organizer/heritages/**")
                .hasRole("ORGANIZER")
                .requestMatchers("/api/v1/organizer/heritage-images", "/api/v1/organizer/heritage-images/**")
                .hasRole("ORGANIZER")
                .requestMatchers("/api/v1/organizer/**").hasRole("ORGANIZER")
                .requestMatchers("/api/v1/partner/**").hasRole("PARTNER")
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
        );

        http.exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler)
        );

        http.logout(logout -> logout
                .logoutUrl("/api/v1/auth/logout")
                .invalidateHttpSession(true)
                .clearAuthentication(true)
                .deleteCookies("SESSION")
                .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT))
                .permitAll()
        );

        return http.build();
    }
}
