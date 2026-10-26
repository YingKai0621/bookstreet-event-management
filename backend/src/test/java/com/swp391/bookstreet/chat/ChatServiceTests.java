package com.swp391.bookstreet.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import tools.jackson.databind.ObjectMapper;
import com.swp391.bookstreet.activity.service.PublicActivityService;
import com.swp391.bookstreet.chat.service.ChatService;
import com.swp391.bookstreet.chat.service.GeminiChatClient;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.event.dto.EventPageResponse;
import com.swp391.bookstreet.registration.service.ParticipantActivityRegistrationService;
import com.swp391.bookstreet.registration.service.ParticipantEventRegistrationService;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

class ChatServiceTests {
    private final EventService events = mock(EventService.class);
    private final PublicActivityService activities = mock(PublicActivityService.class);
    private final ParticipantEventRegistrationService myEvents =
            mock(ParticipantEventRegistrationService.class);
    private final ParticipantActivityRegistrationService myActivities =
            mock(ParticipantActivityRegistrationService.class);
    private final GeminiChatClient ai = mock(GeminiChatClient.class);
    private final ChatService service = new ChatService(events, activities, myEvents,
            myActivities, ai, Clock.systemUTC());

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void guestCannotReadPersonalRegistrations() {
        var result = service.reply("Tôi đã đăng ký hoạt động nào?");
        assertThat(result.answer()).contains("đăng nhập");
        verifyNoInteractions(myEvents, myActivities, ai);
    }

    @Test
    void unknownQuestionDoesNotCallModel() {
        var result = service.reply("Điều gì nằm ngoài hệ thống?");
        assertThat(result.answer()).contains("chưa tìm được");
        verifyNoInteractions(events, activities, myEvents, myActivities, ai);
    }

    @Test
    void unconfiguredModelDoesNotPretendToAnswer() {
        var client = new GeminiChatClient(new ObjectMapper(), "", "gemini-3.5-flash-lite");
        assertThatThrownBy(() -> client.answer("Câu hỏi", "Nguồn"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("503");
    }

    @Test
    void emptyPublicSearchDoesNotInventWeekendEvents() {
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(), 0, 30, 0, 0));
        var result = service.reply("Cuối tuần này có sự kiện nào?");
        assertThat(result.answer()).contains("chưa tìm được");
        verifyNoInteractions(ai);
    }
}
