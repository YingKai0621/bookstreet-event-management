package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.dto.AccountResponse;
import com.swp391.bookstreet.auth.dto.ConfirmEmailVerificationRequest;
import com.swp391.bookstreet.auth.dto.CsrfTokenResponse;
import com.swp391.bookstreet.auth.dto.LoginRequest;
import com.swp391.bookstreet.auth.dto.LoginResponse;
import com.swp391.bookstreet.auth.dto.RegisterRequest;
import com.swp391.bookstreet.auth.service.AuthService;
import com.swp391.bookstreet.auth.service.EmailVerificationResendService;
import com.swp391.bookstreet.auth.service.EmailVerificationTokenService;
import com.swp391.bookstreet.auth.service.LoginResult;
import com.swp391.bookstreet.security.authentication.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationResendService emailVerificationResendService;
    private final EmailVerificationTokenService emailVerificationTokenService;
    private final SecurityContextRepository securityContextRepository;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;

    public AuthController(
            AuthService authService,
            EmailVerificationResendService emailVerificationResendService,
            EmailVerificationTokenService emailVerificationTokenService,
            SecurityContextRepository securityContextRepository,
            SessionAuthenticationStrategy sessionAuthenticationStrategy
    ) {
        this.authService = authService;
        this.emailVerificationResendService = emailVerificationResendService;
        this.emailVerificationTokenService = emailVerificationTokenService;
        this.securityContextRepository = securityContextRepository;
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AccountResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/email-verification/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmEmailVerification(
            @Valid @RequestBody ConfirmEmailVerificationRequest request
    ) {
        emailVerificationTokenService.confirmToken(request.getToken());
    }

    @PostMapping("/email-verification/resend")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendEmailVerification(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser
    ) {
        emailVerificationResendService.resend(authenticatedUser.getUserId());
    }

    @PostMapping("/login")
    public LoginResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        LoginResult loginResult = authService.login(request);
        Authentication authentication = loginResult.authentication();

        sessionAuthenticationStrategy.onAuthentication(authentication, httpRequest, httpResponse);

        SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(authentication);
        SecurityContextHolder.setContext(securityContext);

        securityContextRepository.saveContext(securityContext, httpRequest, httpResponse);

        return loginResult.response();
    }

    @GetMapping("/me")
    public AccountResponse getCurrentAccount(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser
    ) {
        return authService.getCurrentAccount(authenticatedUser.getUserId());
    }

    @GetMapping("/csrf")
    public CsrfTokenResponse getCsrfToken(CsrfToken csrfToken) {
        return new CsrfTokenResponse(
                csrfToken.getHeaderName(),
                csrfToken.getToken()
        );
    }
}
