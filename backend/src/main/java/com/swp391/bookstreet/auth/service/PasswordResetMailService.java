package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.config.EmailVerificationMailProperties;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class PasswordResetMailService {
    private static final String EMAIL_SUBJECT = "Đặt lại mật khẩu BookStreet";

    private final JavaMailSender mailSender;
    private final EmailVerificationMailProperties mailProperties;

    public PasswordResetMailService(JavaMailSender mailSender, EmailVerificationMailProperties mailProperties) {
        this.mailSender = mailSender;
        this.mailProperties = mailProperties;
    }

    public void sendResetMessage(String recipientEmail, String rawToken) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailProperties.getFromAddress());
        message.setTo(recipientEmail);
        message.setSubject(EMAIL_SUBJECT);
        message.setText("""
                Bạn vừa yêu cầu đặt lại mật khẩu tài khoản BookStreet.
                Mở liên kết sau để đặt mật khẩu mới:
                %s

                Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần.
                Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu của bạn vẫn giữ nguyên.
                """.formatted(resetLink(rawToken)));
        mailSender.send(message);
    }

    private String resetLink(String rawToken) {
        String baseUrl = mailProperties.getFrontendBaseUrl().replaceAll("/+$", "");
        return baseUrl + "/reset-password?token=" + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
    }
}
