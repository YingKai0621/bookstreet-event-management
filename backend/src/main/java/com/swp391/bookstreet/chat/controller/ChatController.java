package com.swp391.bookstreet.chat.controller;

import com.swp391.bookstreet.chat.dto.ChatRequest;
import com.swp391.bookstreet.chat.dto.ChatResponse;
import com.swp391.bookstreet.chat.service.ChatService;
import com.swp391.bookstreet.chat.service.ChatRateLimiter;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/chat")
public class ChatController {
    private final ChatService service;
    private final ChatRateLimiter rateLimiter;

    public ChatController(ChatService service, ChatRateLimiter rateLimiter) {
        this.service = service;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/messages")
    public ChatResponse reply(@Valid @RequestBody ChatRequest request,
            HttpServletRequest servletRequest) {
        rateLimiter.check(servletRequest);
        return service.reply(request.message().trim(), request.history());
    }
}
