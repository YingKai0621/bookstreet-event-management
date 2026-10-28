package com.swp391.bookstreet.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.anyString;

import tools.jackson.databind.ObjectMapper;
import com.swp391.bookstreet.activity.service.PublicActivityService;
import com.swp391.bookstreet.activity.dto.PublicActivityResponse;
import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.PublicActivityLocationResponse;
import com.swp391.bookstreet.chat.service.ChatService;
import com.swp391.bookstreet.chat.service.GeminiChatClient;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.event.dto.EventPageResponse;
import com.swp391.bookstreet.event.dto.EventSummaryResponse;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.registration.service.ParticipantActivityRegistrationService;
import com.swp391.bookstreet.registration.service.ParticipantEventRegistrationService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
    void unknownQuestionDoesNotSearchWithoutValidatedIntent() {
        var result = service.reply("Điều gì nằm ngoài hệ thống?");
        assertThat(result.answer()).contains("chưa tìm được");
        verify(ai).classify(anyString());
        verify(ai, never()).answer(anyString(), anyString());
        verifyNoInteractions(events, activities, myEvents, myActivities);
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
        var datedService = new ChatService(events, activities, myEvents, myActivities, ai,
                Clock.fixed(Instant.parse("2026-10-26T03:00:00Z"), ZoneOffset.UTC));
        var result = datedService.reply("Cuối tuần này có sự kiện nào?");
        assertThat(result.answer()).contains("chưa thấy sự kiện công khai")
                .contains("31/10–01/11/2026");
        verifyNoInteractions(ai);
    }

    @Test
    void emptyWeekendActivitySearchExplainsTheMissingSchedule() {
        when(activities.list(0, 30, "startAt,asc", null, null, null, null, null))
                .thenReturn(new com.swp391.bookstreet.activity.dto.ActivityPageResponse<>(
                        List.of(), 0, 30, 0, 0));
        var datedService = new ChatService(events, activities, myEvents, myActivities, ai,
                Clock.fixed(Instant.parse("2026-10-26T03:00:00Z"), ZoneOffset.UTC));

        var result = datedService.reply("Cuối tuần này có hoạt động gì?");

        assertThat(result.answer()).contains("chưa thấy hoạt động công khai")
                .contains("31/10–01/11/2026");
        verifyNoInteractions(ai);
    }

    @Test
    void publicEventContextUsesReadableStatusAndLocalTime() {
        var event = new EventSummaryResponse(7L, "Ngày hội sách", "Gặp gỡ tác giả",
                Instant.parse("2026-11-01T02:00:00Z"),
                Instant.parse("2026-11-01T10:00:00Z"), null, null,
                EventStatus.PUBLISHED, null, null);
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(event), 0, 30, 1, 1));
        when(ai.answer(anyString(), anyString())).thenReturn("Có Ngày hội sách vào 9 giờ.");

        service.reply("Có sự kiện nào?");

        var context = ArgumentCaptor.forClass(String.class);
        verify(ai).answer(anyString(), context.capture());
        assertThat(context.getValue()).contains("09:00 ngày 01/11/2026")
                .contains("sắp diễn ra")
                .doesNotContain("PUBLISHED", "2026-11-01T02:00:00Z");
    }

    @Test
    void activityHowToAnswerDoesNotIncludeCatalogOrAccountRules() {
        when(ai.answer(anyString(), anyString())).thenReturn("Bạn mở hoạt động và chọn Đăng ký nhé.");

        service.reply("Hướng dẫn cách đăng ký hoạt động");

        var context = ArgumentCaptor.forClass(String.class);
        verify(ai).answer(anyString(), context.capture());
        assertThat(context.getValue()).contains("giữ chỗ")
                .doesNotContain("Tên đăng nhập", "Username", "PARTICIPANT");
        verifyNoInteractions(activities);
    }

    @Test
    void weekendParaphraseSearchesBothPublicCatalogsWithoutClassification() {
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(), 0, 30, 0, 0));
        when(activities.list(0, 30, "startAt,asc", null, null, null, null, null))
                .thenReturn(new com.swp391.bookstreet.activity.dto.ActivityPageResponse<>(
                        List.of(), 0, 30, 0, 0));
        var datedService = new ChatService(events, activities, myEvents, myActivities, ai,
                Clock.fixed(Instant.parse("2026-10-26T03:00:00Z"), ZoneOffset.UTC));

        var result = datedService.reply("Cuối tuần này có gì vui?");

        assertThat(result.answer()).contains("sự kiện hoặc hoạt động")
                .contains("31/10–01/11/2026");
        verifyNoInteractions(ai);
    }

    @Test
    void nextWeekendUsesFollowingWeekRatherThanThisWeekend() {
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(), 0, 30, 0, 0));
        var datedService = new ChatService(events, activities, myEvents, myActivities, ai,
                Clock.fixed(Instant.parse("2026-10-26T03:00:00Z"), ZoneOffset.UTC));

        var result = datedService.reply("Cuối tuần sau có chương trình gì?");

        assertThat(result.answer()).contains("07/11–08/11/2026");
        verifyNoInteractions(ai);
    }

    @Test
    void unknownPhrasingUsesValidatedClassificationBeforePublicSearch() {
        when(ai.classify(anyString())).thenReturn(new ChatClassification(
                ChatClassification.Kind.EVENT, ChatIntentResolver.Timeframe.NONE, false));
        var event = new EventSummaryResponse(9L, "Ngày hội sách", "Gặp gỡ tác giả",
                Instant.parse("2026-11-01T02:00:00Z"),
                Instant.parse("2026-11-01T10:00:00Z"), null, null,
                EventStatus.PUBLISHED, null, null);
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(event), 0, 30, 1, 1));
        when(ai.answer(anyString(), anyString())).thenReturn("Có Ngày hội sách.");

        var result = service.reply("Có chương gì để dự?");

        assertThat(result.answer()).contains("Ngày hội sách");
        verify(ai).classify(anyString());
        verify(ai).answer(anyString(), anyString());
    }

    @Test
    void modelRoutedPersonalQuestionStillRequiresSession() {
        when(ai.classify(anyString())).thenReturn(new ChatClassification(
                ChatClassification.Kind.PERSONAL_ACTIVITY,
                ChatIntentResolver.Timeframe.NONE, false));

        var result = service.reply("Những buổi mà mình chọn trước đây?");

        assertThat(result.answer()).contains("đăng nhập");
        verifyNoInteractions(myEvents, myActivities);
        verify(ai, never()).answer(anyString(), anyString());
    }

    @Test
    void commonQrQuestionUsesCurrentSharedScanGuidance() {
        when(ai.answer(anyString(), anyString())).thenReturn("Bạn quét mã QR của Ban tổ chức nhé.");

        service.reply("Vì sao tôi không có mã QR của tôi?");

        var context = ArgumentCaptor.forClass(String.class);
        verify(ai).answer(anyString(), context.capture());
        assertThat(context.getValue()).contains("Không có mã QR riêng")
                .contains("/participant/activities")
                .doesNotContain("/participant/attendance/scan");
        verify(ai, never()).classify(anyString());
    }

    @ParameterizedTest
    @CsvSource({
            "Xem gian hàng ở đâu?, /#gian-hang",
            "Xem bản đồ ở đâu?, /#ban-do",
            "Đăng nhập ở đâu?, /login",
            "Tạo tài khoản thế nào?, /register",
            "Làm sao rời sự kiện?, /participant/events",
            "Xem thông báo ở đâu?, /participant/notifications",
            "Lấy chứng nhận ở đâu?, /participant/certificates",
            "Đánh giá ở đâu?, /participant/feedback",
            "Xác minh email thế nào?, /participant/profile"
    })
    void guidanceLinksOpenTheRelevantScreen(String question, String expectedUrl) {
        when(ai.answer(anyString(), anyString())).thenReturn("Bạn mở liên kết bên dưới nhé.");

        var result = service.reply(question);

        assertThat(result.sources()).extracting(source -> source.url()).contains(expectedUrl);
        verifyNoInteractions(events, activities, myEvents, myActivities);
    }

    @Test
    void commonEmailQuestionUsesReviewedGuidanceWithoutExtraApiCall() {
        when(ai.answer(anyString(), anyString())).thenReturn("Email không bắt buộc nhé.");

        service.reply("Email có bắt buộc không?");

        var context = ArgumentCaptor.forClass(String.class);
        verify(ai).answer(anyString(), context.capture());
        assertThat(context.getValue()).contains("Email không bắt buộc");
        verify(ai, never()).classify(anyString());
    }

    @Test
    void availabilityQuestionExcludesClosedActivities() {
        var closed = mock(PublicActivityResponse.class);
        when(closed.registrationOpen()).thenReturn(false);
        var open = mock(PublicActivityResponse.class);
        when(open.registrationOpen()).thenReturn(true);
        when(open.title()).thenReturn("Giao lưu tác giả");
        when(open.eventName()).thenReturn("Ngày hội sách");
        when(open.startAt()).thenReturn(Instant.parse("2026-11-01T02:00:00Z"));
        when(open.endAt()).thenReturn(Instant.parse("2026-11-01T04:00:00Z"));
        when(open.location()).thenReturn(new PublicActivityLocationResponse(
                1L, "STAGE", "Sân khấu", null));
        when(open.registrationRequired()).thenReturn(true);
        when(open.availableSeats()).thenReturn(3L);
        when(open.status()).thenReturn(com.swp391.bookstreet.activity.entity.ActivityStatus.PUBLISHED);
        when(activities.list(0, 30, "startAt,asc", null, null, null, null, null))
                .thenReturn(new ActivityPageResponse<>(List.of(closed, open), 0, 30, 2, 1));
        when(ai.answer(anyString(), anyString())).thenReturn("Giao lưu tác giả còn chỗ.");

        service.reply("Hoạt động nào còn suất?");

        var context = ArgumentCaptor.forClass(String.class);
        verify(ai).answer(anyString(), context.capture());
        assertThat(context.getValue()).contains("Giao lưu tác giả");
        verify(ai, never()).classify(anyString());
    }

    @Test
    void spokenTalkSynonymFindsPublishedTalkshow() {
        var talk = mock(PublicActivityResponse.class);
        when(talk.title()).thenReturn("Giao lưu tác giả");
        when(talk.activityType()).thenReturn("TALKSHOW");
        when(talk.eventName()).thenReturn("Ngày hội sách");
        when(talk.startAt()).thenReturn(Instant.parse("2026-10-31T03:00:00Z"));
        when(talk.endAt()).thenReturn(Instant.parse("2026-10-31T04:30:00Z"));
        when(talk.location()).thenReturn(new PublicActivityLocationResponse(
                1L, "STAGE", "Sân khấu", null));
        when(talk.status()).thenReturn(
                com.swp391.bookstreet.activity.entity.ActivityStatus.PUBLISHED);
        when(activities.list(0, 30, "startAt,asc", null, null, null, null, null))
                .thenReturn(new ActivityPageResponse<>(List.of(talk), 0, 30, 1, 1));
        when(ai.answer(anyString(), anyString())).thenReturn("Có buổi giao lưu tác giả.");
        var datedService = new ChatService(events, activities, myEvents, myActivities, ai,
                Clock.fixed(Instant.parse("2026-10-26T03:00:00Z"), ZoneOffset.UTC));

        var result = datedService.reply("Thứ Bảy có buổi nói chuyện nào?");

        assertThat(result.answer()).contains("giao lưu tác giả");
        verify(ai, never()).classify(anyString());
    }

    @Test
    void publicSearchContinuesToLaterPageWhenFirstPageHasNoMatch() {
        var event = new EventSummaryResponse(10L, "Ngày hội sách", "Gặp gỡ tác giả",
                Instant.parse("2026-11-01T02:00:00Z"),
                Instant.parse("2026-11-01T10:00:00Z"), null, null,
                EventStatus.PUBLISHED, null, null);
        when(events.listPublic(0, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(), 0, 30, 1, 2));
        when(events.listPublic(1, 30, "startAt,asc", null))
                .thenReturn(new EventPageResponse<>(List.of(event), 1, 30, 1, 2));
        when(ai.answer(anyString(), anyString())).thenReturn("Có Ngày hội sách.");

        var result = service.reply("Có sự kiện nào?");

        assertThat(result.answer()).contains("Ngày hội sách");
        verify(events).listPublic(1, 30, "startAt,asc", null);
    }
}
