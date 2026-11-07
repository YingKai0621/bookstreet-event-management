package com.swp391.bookstreet.chat;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "bookstreet.chatbot.api-key=")
@AutoConfigureMockMvc
class ChatControllerIntegrationTests {
    @Autowired MockMvc mvc;

    @Test
    void guestPersonalQuestionWithoutAiKeyIsUnavailableNotLeaked() throws Exception {
        var csrf = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn();
        String token = com.jayway.jsonpath.JsonPath.read(
                csrf.getResponse().getContentAsString(), "$.token");
        Cookie cookie = csrf.getResponse().getCookie("XSRF-TOKEN");
        mvc.perform(post("/api/v1/chat/messages")
                        .cookie(cookie)
                        .header("X-XSRF-TOKEN", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Tôi đã đăng ký hoạt động nào?\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void guestChatStillRequiresCsrf() throws Exception {
        mvc.perform(post("/api/v1/chat/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Tôi đã đăng ký hoạt động nào?\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void missingAiKeyReturnsServiceUnavailableInsteadOfAuthenticationError() throws Exception {
        var csrf = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn();
        String token = com.jayway.jsonpath.JsonPath.read(
                csrf.getResponse().getContentAsString(), "$.token");
        Cookie cookie = csrf.getResponse().getCookie("XSRF-TOKEN");
        mvc.perform(post("/api/v1/chat/messages")
                        .cookie(cookie)
                        .header("X-XSRF-TOKEN", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Hướng dẫn đăng ký tài khoản\"}"))
                .andExpect(status().isServiceUnavailable());
    }
}
