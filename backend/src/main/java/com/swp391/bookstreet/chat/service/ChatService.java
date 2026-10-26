package com.swp391.bookstreet.chat.service;

import com.swp391.bookstreet.activity.service.PublicActivityService;
import com.swp391.bookstreet.chat.dto.ChatResponse;
import com.swp391.bookstreet.chat.dto.ChatSource;
import com.swp391.bookstreet.chat.dto.ChatTurn;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.registration.service.ParticipantActivityRegistrationService;
import com.swp391.bookstreet.registration.service.ParticipantEventRegistrationService;
import java.text.Normalizer;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class ChatService {
    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String UNKNOWN = "Mình chưa tìm được thông tin đủ tin cậy để trả lời. "
            + "Bạn có thể xem trang sự kiện hoặc hoạt động để kiểm tra trực tiếp.";

    private final EventService events;
    private final PublicActivityService activities;
    private final ParticipantEventRegistrationService myEvents;
    private final ParticipantActivityRegistrationService myActivities;
    private final GeminiChatClient ai;
    private final Clock clock;

    public ChatService(EventService events, PublicActivityService activities,
            ParticipantEventRegistrationService myEvents,
            ParticipantActivityRegistrationService myActivities,
            GeminiChatClient ai, Clock clock) {
        this.events = events;
        this.activities = activities;
        this.myEvents = myEvents;
        this.myActivities = myActivities;
        this.ai = ai;
        this.clock = clock;
    }

    public ChatResponse reply(String question) {
        return reply(question, List.of());
    }

    public ChatResponse reply(String question, List<ChatTurn> history) {
        List<ChatTurn> recent = history == null ? List.of() : history;
        String normalized = normalize(question);
        String retrievalQuery = normalized;
        if (contains(normalized, "cai thu", "hoat dong do", "su kien do", "o dau")
                && !recent.isEmpty()) {
            for (int index = recent.size() - 1; index >= 0; index--) {
                if ("user".equals(recent.get(index).role())) {
                    retrievalQuery = normalize(recent.get(index).text()) + " " + normalized;
                    break;
                }
            }
        }
        if (contains(normalized, "mat khau", "password", "session", "token", "qr diem danh")
                && contains(normalized, "nguoi khac", "cua ban", "cho toi", "lay", "gui")) {
            return new ChatResponse("Mình không thể cung cấp mật khẩu, session, QR điểm danh "
                    + "hoặc dữ liệu riêng tư của người khác.", List.of());
        }
        boolean personal = contains(retrievalQuery, "cua toi", "toi da", "toi co", "my event",
                "my activit", "my certificate", "thong bao cua toi", "dang ky cua toi");
        if (personal && !isParticipant()) {
            return new ChatResponse("Để xem thông tin tham gia của chính bạn, vui lòng đăng nhập "
                    + "bằng tài khoản Participant.", List.of(new ChatSource("Đăng nhập", "/login")));
        }
        List<Fact> facts = new ArrayList<>();
        addGuidance(retrievalQuery, facts);
        if (personal) addPersonal(retrievalQuery, facts);
        else {
            int guidanceCount = facts.size();
            addPublic(retrievalQuery, facts);
            if (facts.size() == guidanceCount && contains(retrievalQuery,
                    "hom nay", "ngay mai", "cuoi tuan", "tuan nay", "thu bay",
                    "chu nhat", "con cho", "cho trong")) {
                return new ChatResponse(UNKNOWN, List.of());
            }
        }
        if (facts.isEmpty()) return new ChatResponse(UNKNOWN, List.of());
        List<Fact> selected = facts.stream().limit(12).toList();
        StringBuilder context = new StringBuilder("Hôm nay tại Việt Nam: ")
                .append(LocalDate.now(clock.withZone(VIETNAM))).append('\n');
        for (Fact fact : selected) {
            context.append("- ").append(fact.text()).append(" [nguồn: ")
                    .append(fact.source().url()).append("]\n");
        }
        StringBuilder userInput = new StringBuilder();
        for (ChatTurn turn : recent) {
            userInput.append(turn.role()).append(": ").append(turn.text()).append('\n');
        }
        userInput.append("user: ").append(question);
        String answer = ai.answer(userInput.toString(), context.toString());
        // URLs are supplied separately by the server, never accepted from model output.
        answer = answer.replaceAll("https?://\\S+", "").trim();
        return new ChatResponse(answer, selected.stream().map(Fact::source).distinct().toList());
    }

    private void addPublic(String q, List<Fact> facts) {
        if (contains(q, "su kien", "event", "hoi sach")) {
            var page = events.listPublic(0, 30, "startAt,asc", null);
            for (var event : page.content()) {
                if (matches(q, event.name(), event.description())
                        && matchesDate(q, event.startAt(), event.endAt())) {
                    facts.add(new Fact("Sự kiện: " + event.name() + "; trạng thái "
                            + event.status() + "; bắt đầu " + event.startAt()
                            + "; kết thúc " + event.endAt() + "; mô tả "
                            + clip(event.description()), new ChatSource(event.name(),
                            "/su-kien")));
                }
            }
        }
        if (contains(q, "hoat dong", "activity", "workshop", "lich", "cho trong",
                "con cho", "dia diem", "diem danh", "chung nhan")) {
            var page = activities.list(0, 30, "startAt,asc", null, null, null, null, null);
            for (var activity : page.content()) {
                if (matches(q, activity.title(), activity.eventName(), activity.description())
                        && matchesDate(q, activity.startAt(), activity.endAt())) {
                    facts.add(new Fact("Hoạt động: " + activity.title() + "; sự kiện "
                            + activity.eventName() + "; trạng thái " + activity.status()
                            + "; bắt đầu " + activity.startAt() + "; kết thúc " + activity.endAt()
                            + "; địa điểm " + activity.location().name()
                            + "; cần đăng ký " + activity.registrationRequired()
                            + "; đăng ký còn mở " + activity.registrationOpen()
                            + "; chỗ còn " + activity.availableSeats()
                            + "; mô tả " + clip(activity.description()),
                            new ChatSource(activity.title(), "/su-kien")));
                }
            }
        }
    }

    private void addPersonal(String q, List<Fact> facts) {
        if (contains(q, "su kien", "event", "tham gia")) {
            var page = myEvents.list(0, 20, "activatedAt,desc", null, null, null);
            for (var registration : page.content()) {
                facts.add(new Fact("Đăng ký sự kiện của chủ session: "
                        + registration.event().name() + "; trạng thái " + registration.status(),
                        new ChatSource(registration.event().name(), "/participant/events")));
            }
        }
        if (contains(q, "hoat dong", "activity", "dang ky", "diem danh",
                "chung nhan", "certificate", "workshop")) {
            var page = myActivities.list(0, 20, "activatedAt,desc", null, null,
                    null, null, null);
            for (var registration : page.content()) {
                facts.add(new Fact("Đăng ký hoạt động của chủ session: "
                        + registration.activity().title() + "; trạng thái "
                        + registration.status() + "; kết quả " + registration.outcome()
                        + "; chứng nhận " + (registration.certificate() == null
                                ? "chưa có" : registration.certificate().status()),
                        new ChatSource(registration.activity().title(), "/participant/events")));
            }
        }
    }

    private static void addGuidance(String q, List<Fact> facts) {
        if (contains(q, "tai khoan", "dang ky", "dang nhap", "mat khau")) {
            facts.add(new Fact("Tài khoản tự đăng ký nhận vai trò PARTICIPANT. Email tùy chọn. "
                    + "Username dài 3–20 ký tự, bắt đầu bằng chữ ASCII, chỉ gồm chữ ASCII/số. "
                    + "Mật khẩu đăng ký dài 8–64 ký tự, tối đa 72 byte UTF-8. Không yêu cầu "
                    + "người dùng cung cấp mật khẩu trong chat.", new ChatSource("Đăng ký", "/register")));
        }
        if (contains(q, "tham gia su kien", "join event", "roi su kien", "my event")) {
            facts.add(new Fact("Participant có thể Join Event public trước hoặc đúng deadline. "
                    + "Join Event không giữ chỗ Activity. Leave chỉ được phép khi không còn "
                    + "ActivityRegistration seat-active.", new ChatSource("Sự kiện", "/su-kien")));
        }
        if (contains(q, "hoat dong", "workshop", "cho trong", "dang ky lai")) {
            facts.add(new Fact("Activity cần đăng ký chỉ nhận đăng ký khi còn mở theo cả deadline "
                    + "Event và Activity, còn chỗ và đủ điều kiện. Lịch trùng được cảnh báo "
                    + "nhưng không tự chặn. Chatbot không thực hiện đăng ký hoặc hủy thay người dùng.",
                    new ChatSource("Hoạt động", "/su-kien")));
        }
        if (contains(q, "qr", "diem danh", "attendance")) {
            facts.add(new Fact("Participant đã đăng nhập tự quét QR chung của Activity tại địa "
                    + "điểm. Cửa sổ điểm danh là từ 15 phút trước giờ bắt đầu đến trước giờ "
                    + "kết thúc, theo thời gian backend. Không có Event QR hoặc QR riêng Participant.",
                    new ChatSource("Hoạt động của tôi", "/participant/events")));
        }
        if (contains(q, "chung nhan", "certificate", "danh gia", "rating")) {
            facts.add(new Fact("Chứng nhận đủ điều kiện được cấp sau khi Activity hoàn tất "
                    + "và có Attendance hợp lệ. Đánh giá Activity yêu cầu Attendance VALID "
                    + "và Activity COMPLETED.", new ChatSource("Hoạt động của tôi",
                    "/participant/events")));
        }
        if (contains(q, "xac minh email", "xac thuc email", "email xac minh")) {
            facts.add(new Fact("Participant có thể đăng ký không cung cấp email. Khi có email, "
                    + "người dùng có thể xác minh bằng liên kết được gửi và yêu cầu gửi lại "
                    + "theo giao diện tài khoản. Không nhập liên kết hoặc mã xác minh vào chat.",
                    new ChatSource("Tài khoản", "/participant/profile")));
        }
        if (contains(q, "quen mat khau", "dat lai mat khau", "reset password")) {
            facts.add(new Fact("Luồng quên/đặt lại mật khẩu chưa được xác nhận triển khai "
                    + "trong baseline hiện tại. Chatbot không nhận mật khẩu hoặc mã xác minh.",
                    new ChatSource("Đăng nhập", "/login")));
        }
        if (contains(q, "gian hang", "booth", "so do", "ban do")) {
            facts.add(new Fact("Guest có thể xem Booth và bản đồ công khai. Việc nộp yêu cầu "
                    + "thuê Booth là quy trình của Partner, không phải thao tác của Participant.",
                    new ChatSource("Gian hàng", "/gian-hang")));
        }
        if (contains(q, "thong bao", "notification")) {
            facts.add(new Fact("Participant có thể xem thông báo in-app thuộc tài khoản "
                    + "của mình về tác động tham gia và chứng nhận. Thông báo của người khác "
                    + "không được công khai; Sprint 6 không có SMS/push hoặc mark-all-read.",
                    new ChatSource("Trang Participant", "/participant")));
        }
        if (contains(q, "ve hoat dong", "mua ve", "waitlist", "danh sach cho")) {
            facts.add(new Fact("Activity ticket trả phí và waitlist không thuộc phạm vi "
                    + "hiện tại. Không có thao tác mua vé Activity qua chatbot.",
                    new ChatSource("Sự kiện", "/su-kien")));
        }
        if (contains(q, "huy su kien", "huy hoat dong", "doi lich", "thay doi lich")) {
            facts.add(new Fact("Event hoặc Activity có thể thay đổi trạng thái/lịch theo "
                    + "quy tắc nghiệp vụ. Thông tin của đối tượng cụ thể phải đọc từ dữ liệu "
                    + "hiện tại; chatbot không tự suy đoán lý do.",
                    new ChatSource("Sự kiện", "/su-kien")));
        }
    }

    private static boolean isParticipant() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                        .anyMatch(authority -> "ROLE_PARTICIPANT".equals(authority.getAuthority()));
    }

    private boolean matchesDate(String q, Instant start, Instant end) {
        LocalDate today = LocalDate.now(clock.withZone(VIETNAM));
        LocalDate first = null;
        LocalDate last = null;
        if (contains(q, "hom nay")) first = last = today;
        else if (contains(q, "ngay mai")) first = last = today.plusDays(1);
        else if (contains(q, "cuoi tuan", "thu bay", "chu nhat")) {
            first = today.with(DayOfWeek.SATURDAY);
            if (first.isBefore(today)) first = first.plusWeeks(1);
            last = first.plusDays(1);
        } else if (contains(q, "tuan nay")) {
            first = today.with(DayOfWeek.MONDAY);
            last = first.plusDays(6);
        }
        if (first == null) return true;
        LocalDate startDay = start.atZone(VIETNAM).toLocalDate();
        LocalDate endDay = end.atZone(VIETNAM).toLocalDate();
        return !startDay.isAfter(last) && !endDay.isBefore(first);
    }

    private static final Set<String> SEARCH_STOP_WORDS = Set.of(
            "nhung", "nao", "khong", "trong", "duoc", "hien", "tai", "cho", "toi",
            "hoat", "dong", "kien", "event", "activity", "workshop", "hom", "nay",
            "ngay", "mai", "cuoi", "tuan", "thu", "bay", "chu", "nhat", "con", "lich",
            "bao", "gio", "dien", "ra", "dang", "ky", "the", "tham", "gia", "noi", "dau",
            "sach", "cua", "nhu", "sao", "may", "su", "hay", "minh", "tren");

    private static boolean matches(String q, String... values) {
        String combined = normalize(String.join(" ", Arrays.stream(values)
                .filter(value -> value != null).toList()));
        List<String> terms = Arrays.stream(q.split(" "))
                .filter(word -> word.length() > 3 && !SEARCH_STOP_WORDS.contains(word)).toList();
        return terms.isEmpty() || terms.stream().anyMatch(combined::contains);
    }

    private static String clip(String value) {
        if (value == null) return "";
        return value.length() <= 180 ? value : value.substring(0, 180);
    }

    private static boolean contains(String q, String... needles) {
        for (String needle : needles) if (q.contains(needle)) return true;
        return false;
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd').replaceAll("[^a-z0-9 ]", " ")
                .replaceAll(" +", " ").trim();
    }

    private record Fact(String text, ChatSource source) {
    }
}
