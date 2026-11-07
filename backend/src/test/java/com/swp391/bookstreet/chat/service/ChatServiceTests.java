package com.swp391.bookstreet.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.swp391.bookstreet.activity.service.PublicActivityService;
import com.swp391.bookstreet.event.dto.EventPageResponse;
import com.swp391.bookstreet.event.dto.EventSummaryResponse;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.registration.service.ParticipantActivityRegistrationService;
import com.swp391.bookstreet.registration.service.ParticipantEventRegistrationService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class ChatServiceTests {
    private final ObjectMapper mapper = new ObjectMapper();
    private final EventService events = mock(EventService.class);
    private final PublicActivityService activities = mock(PublicActivityService.class);
    private final ParticipantEventRegistrationService myEvents =
            mock(ParticipantEventRegistrationService.class);
    private final ParticipantActivityRegistrationService myActivities =
            mock(ParticipantActivityRegistrationService.class);
    private final com.swp391.bookstreet.booth.service.EventBoothService booths =
            mock(com.swp391.bookstreet.booth.service.EventBoothService.class);
    private final com.swp391.bookstreet.notification.service.NotificationInboxService
            notifications = mock(
                    com.swp391.bookstreet.notification.service.NotificationInboxService.class);
    private final ChatTools tools = new ChatTools(events, activities, myEvents, myActivities,
            booths, notifications);
    private final GeminiChatClient ai = mock(GeminiChatClient.class);
    private final ChatService service = new ChatService(tools, ai, mapper, Clock.systemUTC());

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void modelAnswersDirectlyWithoutToolCalls() {
        when(ai.generate(anyString(), anyList(), anyList())).thenReturn(text("Chào bạn!"));

        var result = service.reply("Xin chào");

        assertThat(result.answer()).isEqualTo("Chào bạn!");
        assertThat(result.sources()).isEmpty();
        verifyNoInteractions(events, activities, myEvents, myActivities);
    }

    @Test
    void executesRequestedToolAndFeedsSanitizedResultBack() {
        var event = new EventSummaryResponse(7L, "Ngày hội sách", "Gặp gỡ tác giả",
                Instant.parse("2026-11-01T02:00:00Z"), Instant.parse("2026-11-01T10:00:00Z"),
                null, null, EventStatus.PUBLISHED, null, null);
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(event), 0, 30, 1, 1));
        when(ai.generate(anyString(), anyList(), anyList()))
                .thenReturn(call("search_events", "{\"keyword\":\"hoi sach\"}"))
                .thenReturn(text("Có Ngày hội sách lúc 09:00 ngày 01/11 https://evil.example"));

        var result = service.reply("Có sự kiện hội sách nào?");

        assertThat(result.answer()).isEqualTo("Có Ngày hội sách lúc 09:00 ngày 01/11");
        assertThat(result.sources()).extracting("url").containsExactly("/su-kien/7");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<JsonNode>> contents = ArgumentCaptor.forClass(List.class);
        verify(ai, times(2)).generate(anyString(), contents.capture(), anyList());
        String sentBack = contents.getAllValues().get(1).toString();
        assertThat(sentBack).contains("functionResponse", "Ngày hội sách",
                        "01/11/2026 lúc 09:00", "sắp diễn ra")
                .doesNotContain("PUBLISHED", "eventId", "2026-11-01T02:00:00Z");
    }

    @Test
    void guestPersonalLookupReturnsLoginRequiredWithoutTouchingRegistrations() {
        when(ai.generate(anyString(), anyList(), anyList()))
                .thenReturn(call("get_my_participation", "{}"))
                .thenReturn(text("Bạn đăng nhập để mình xem nhé."));

        var result = service.reply("Tôi đã đăng ký hoạt động nào?");

        assertThat(result.sources()).extracting("url").contains("/login");
        verifyNoInteractions(myEvents, myActivities);
    }

    @Test
    void guestCannotReadNotifications() {
        var result = tools.execute("get_my_notifications", mapper.readTree("{}"));
        assertThat(result.data()).containsEntry("error", "LOGIN_REQUIRED");
        verifyNoInteractions(notifications);
    }

    @Test
    void boothSearchResolvesEventByAccentInsensitiveNameAndHidesInternalFields() {
        var event = new EventSummaryResponse(5L, "Không gian Sách, STEM và Công nghệ", "Mô tả",
                Instant.parse("2026-12-13T02:00:00Z"), Instant.parse("2026-12-16T10:00:00Z"),
                null, null, EventStatus.PUBLISHED, null, null);
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(event), 0, 30, 1, 1));
        var booth = new com.swp391.bookstreet.booth.dto.BoothResponse(11L, "A01", "Gian truyện tranh",
                "Gần cổng", 4, null, null, true, "COMIC", "ghi chú nội bộ", null);
        var config = new com.swp391.bookstreet.booth.dto.EventBoothResponse(99L, 5L, booth,
                new java.math.BigDecimal("500000"), true,
                com.swp391.bookstreet.booth.entity.BoothAvailability.AVAILABLE);
        when(booths.listPublic(5L, 0, 100, "code,asc", null, null))
                .thenReturn(new com.swp391.bookstreet.booth.dto.BoothPageResponse<>(
                        List.of(config), 0, 100, 1, 1));

        var result = tools.execute("search_booths",
                mapper.readTree("{\"eventName\":\"khong gian sach stem\"}"));

        String data = mapper.valueToTree(result.data()).toString();
        assertThat(data).contains("A01", "Gian truyện tranh", "còn trống", "500000")
                .doesNotContain("ghi chú nội bộ", "boothId", "eventBoothConfigId");
    }

    @Test
    void activitySearchRequiresEveryEventNameTermNotJustOne() {
        var other = activity("Workshop A", "[Demo Scenarios] 01 - Đăng ký bình thường");
        var wanted = activity("Workshop A", "[Demo Scenarios] 04 - Một hoạt động hết chỗ");
        when(activities.list(0, 30, "startAt,asc", null, null, null, null, null))
                .thenReturn(new com.swp391.bookstreet.activity.dto.ActivityPageResponse<>(
                        List.of(other, other, other, other, other, other, other, other, wanted),
                        0, 30, 9, 1));

        var result = tools.execute("search_activities",
                mapper.readTree("{\"eventName\":\"Demo Scenarios 04\"}"));

        assertThat(mapper.valueToTree(result.data()).path("activities")).singleElement()
                .satisfies(item -> assertThat(item.path("event").asString()).contains("04"));
    }

    private static com.swp391.bookstreet.activity.dto.PublicActivityResponse activity(
            String title, String eventName) {
        var activity = mock(com.swp391.bookstreet.activity.dto.PublicActivityResponse.class);
        when(activity.title()).thenReturn(title);
        when(activity.eventName()).thenReturn(eventName);
        when(activity.startAt()).thenReturn(Instant.parse("2026-12-22T02:00:00Z"));
        when(activity.endAt()).thenReturn(Instant.parse("2026-12-22T04:00:00Z"));
        when(activity.status()).thenReturn(
                com.swp391.bookstreet.activity.entity.ActivityStatus.PUBLISHED);
        return activity;
    }

    @Test
    void ambiguousEventNameAsksForClarificationInsteadOfPickingOne() {
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(
                        event(1L, "[Demo Scenarios] 01 - Đăng ký bình thường"),
                        event(4L, "[Demo Scenarios] 04 - Một hoạt động hết chỗ")), 0, 30, 2, 1));

        var result = tools.execute("get_event_details",
                mapper.readTree("{\"eventName\":\"Demo Scenarios\"}"));

        assertThat(result.data()).containsEntry("error", "AMBIGUOUS_EVENT");
        verifyNoInteractions(activities, booths);
    }

    @Test
    void exactEventNameWinsOverLongerNamesContainingIt() {
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(
                        event(1L, "Ngày hội sách mở rộng"), event(2L, "Ngày hội sách")),
                        0, 30, 2, 1));
        when(activities.list(0, 30, "startAt,asc", 2L, null, null, null, null))
                .thenReturn(new com.swp391.bookstreet.activity.dto.ActivityPageResponse<>(
                        List.of(), 0, 30, 0, 0));

        var result = tools.execute("get_event_details",
                mapper.readTree("{\"eventName\":\"ngay hoi sach\"}"));

        assertThat(result.data()).containsEntry("name", "Ngày hội sách");
    }

    private static EventSummaryResponse event(Long id, String name) {
        return new EventSummaryResponse(id, name, "Mô tả",
                Instant.parse("2026-12-01T02:00:00Z"), Instant.parse("2026-12-01T10:00:00Z"),
                null, null, EventStatus.PUBLISHED, null, null);
    }

    @Test
    void unknownToolNameIsRejected() {
        assertThat(tools.execute("run_sql", mapper.readTree("{}")).data())
                .containsEntry("error", "UNKNOWN_TOOL");
    }

    @Test
    void toolLoopIsBoundedAndFinalRoundOffersNoTools() {
        when(ai.generate(anyString(), anyList(), anyList()))
                .thenReturn(call("get_platform_guide", "{\"topic\":\"LOGIN\"}"));

        var result = service.reply("Lặp mãi");

        assertThat(result.answer()).contains("chưa tìm được");
        verify(ai, times(5)).generate(anyString(), anyList(), anyList());
        verify(ai).generate(anyString(), anyList(), org.mockito.ArgumentMatchers.eq(List.of()));
    }

    @Test
    void historyRolesAreMappedToGeminiRoles() {
        when(ai.generate(anyString(), anyList(), anyList())).thenReturn(text("Ok"));

        service.reply("Còn gì nữa?", List.of(
                new com.swp391.bookstreet.chat.dto.ChatTurn("user", "Hỏi"),
                new com.swp391.bookstreet.chat.dto.ChatTurn("assistant", "Đáp")));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<JsonNode>> contents = ArgumentCaptor.forClass(List.class);
        verify(ai).generate(anyString(), contents.capture(), any());
        assertThat(contents.getValue()).extracting(node -> node.path("role").asString())
                .containsExactly("user", "model", "user");
    }

    private GeminiChatClient.ModelTurn text(String answer) {
        return new GeminiChatClient.ModelTurn(mapper.readTree(
                "{\"role\":\"model\",\"parts\":[{\"text\":\"x\"}]}"), List.of(), answer);
    }

    private GeminiChatClient.ModelTurn call(String name, String args) {
        return new GeminiChatClient.ModelTurn(mapper.readTree(
                "{\"role\":\"model\",\"parts\":[{\"functionCall\":{\"name\":\"" + name + "\"}}]}"),
                List.of(new GeminiChatClient.FunctionCall(name, mapper.readTree(args))), "");
    }
}
