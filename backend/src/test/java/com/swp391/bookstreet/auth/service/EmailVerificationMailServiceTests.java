package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.config.EmailVerificationMailProperties;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class EmailVerificationMailServiceTests {

    @Test
    void sendsPlainTextMessageWithFrontendVerificationLink() {
        JavaMailSender mailSender = mock(JavaMailSender.class);

        EmailVerificationMailProperties properties = new EmailVerificationMailProperties();
        properties.setFromAddress("no-reply@bookstreet.local");
        properties.setFrontendBaseUrl("http://localhost:5173/");

        EmailVerificationMailService mailService =
                new EmailVerificationMailService(mailSender, properties);

        mailService.sendVerificationMessage(
                "reader@example.com",
                "safe_token-value"
        );

        ArgumentCaptor<SimpleMailMessage> messageCaptor =
                ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(messageCaptor.capture());

        SimpleMailMessage message = messageCaptor.getValue();

        assertThat(message.getFrom()).isEqualTo("no-reply@bookstreet.local");
        assertThat(message.getTo()).containsExactly("reader@example.com");
        assertThat(message.getSubject()).isEqualTo("Verify your BookStreet email");
        assertThat(message.getText()).contains(
                "http://localhost:5173/verify-email?token=safe_token-value"
        );
        assertThat(message.getText()).contains("expires in 60 minutes");
    }
}
