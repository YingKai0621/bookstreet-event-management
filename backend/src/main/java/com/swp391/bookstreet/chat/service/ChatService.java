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
import java.time.format.DateTimeFormatter;
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
    private static final DateTimeFormatter FRIENDLY_TIME = DateTimeFormatter
            .ofPattern("HH:mm 'ngày' dd/MM/yyyy", Locale.forLanguageTag("vi-VN"))
            .withZone(VIETNAM);
    private static final String UNKNOWN = "Mình chưa tìm được thông tin phù hợp. "
            + "Bạn thử hỏi cụ thể tên sự kiện hoặc hoạt động nhé.";

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
            return new ChatResponse("Mình không thể chia sẻ mật khẩu, mã điểm danh "
                    + "hoặc thông tin riêng của người khác.", List.of());
        }
        boolean personal = contains(retrievalQuery, "cua toi", "toi da", "toi co", "my event",
                "my activit", "my certificate", "thong bao cua toi", "dang ky cua toi");
        if (personal && !isParticipant()) {
            return new ChatResponse("Bạn đăng nhập để mình xem thông tin tham gia của bạn nhé.",
                    List.of(new ChatSource("Đăng nhập", "/login")));
        }
        List<Fact> facts = new ArrayList<>();
        boolean discovery = contains(normalized, "nao", "hom nay", "ngay mai", "cuoi tuan",
                "tuan nay", "con cho", "cho trong", "o dau", "khi nao");
        boolean howTo = contains(normalized, "lam sao", "huong dan", "cach", "the nao");
        if (!discovery || howTo) addGuidance(retrievalQuery, facts);
        if (personal) addPersonal(retrievalQuery, facts);
        else {
            int guidanceCount = facts.size();
            if (!howTo) addPublic(retrievalQuery, facts);
            if (facts.size() == guidanceCount && contains(retrievalQuery,
                    "hom nay", "ngay mai", "cuoi tuan", "tuan nay", "thu bay",
                    "chu nhat", "con cho", "cho trong")) {
                return new ChatResponse(UNKNOWN, List.of());
            }
        }
        if (facts.isEmpty()) return new ChatResponse(UNKNOWN, List.of());
        List<Fact> selected = facts.stream().limit(5).toList();
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
                    facts.add(new Fact("Sự kiện " + event.name() + " diễn ra từ "
                            + friendlyTime(event.startAt()) + " đến " + friendlyTime(event.endAt())
                            + ". Hiện " + friendlyStatus(event.status().name()) + ". "
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
                    String seats = activity.availableSeats() == null ? ""
                            : " Còn " + activity.availableSeats() + " chỗ.";
                    String registration = activity.registrationRequired()
                            ? activity.registrationOpen() ? " Có thể đăng ký ngay."
                                    : " Hiện chưa thể đăng ký."
                            : " Không cần đăng ký trước.";
                    facts.add(new Fact("Hoạt động " + activity.title() + " thuộc sự kiện "
                            + activity.eventName() + ", diễn ra từ "
                            + friendlyTime(activity.startAt()) + " đến "
                            + friendlyTime(activity.endAt()) + " tại "
                            + activity.location().name() + ". Hiện "
                            + friendlyStatus(activity.status().name()) + "."
                            + registration + seats + " " + clip(activity.description()),
                            new ChatSource(activity.title(), "/su-kien")));
                }
            }
        }
    }

    private void addPersonal(String q, List<Fact> facts) {
        if (contains(q, "su kien", "event", "tham gia")) {
            var page = myEvents.list(0, 20, "activatedAt,desc", null, null, null);
            for (var registration : page.content()) {
                facts.add(new Fact("Bạn đã tham gia sự kiện "
                        + registration.event().name() + "; hiện "
                        + friendlyStatus(registration.status().name()) + ".",
                        new ChatSource(registration.event().name(), "/participant/events")));
            }
        }
        if (contains(q, "hoat dong", "activity", "dang ky", "diem danh",
                "chung nhan", "certificate", "workshop")) {
            var page = myActivities.list(0, 20, "activatedAt,desc", null, null,
                    null, null, null);
            for (var registration : page.content()) {
                facts.add(new Fact("Bạn đã đăng ký hoạt động "
                        + registration.activity().title() + "; hiện "
                        + friendlyStatus(registration.status()) + ". Kết quả tham gia: "
                        + friendlyStatus(registration.outcome()) + ". Chứng nhận: "
                        + (registration.certificate() == null ? "chưa có"
                                : friendlyStatus(registration.certificate().status())) + ".",
                        new ChatSource(registration.activity().title(), "/participant/events")));
            }
        }
    }

    private static void addGuidance(String q, List<Fact> facts) {
        if (contains(q, "tai khoan", "dang nhap", "mat khau", "ten dang nhap")
                || contains(q, "dang ky")
                && !contains(q, "hoat dong", "workshop", "su kien", "event")) {
            facts.add(new Fact("Để tạo tài khoản, bạn mở trang Đăng ký và nhập tên đăng nhập, "
                    + "họ tên, mật khẩu và xác nhận mật khẩu. Email không bắt buộc. Tên đăng nhập "
                    + "dài 3–20 ký tự, bắt đầu bằng chữ cái và chỉ gồm chữ cái không dấu hoặc số. "
                    + "Mật khẩu cần 8–64 ký tự. Đừng gửi mật khẩu qua chat.",
                    new ChatSource("Đăng ký", "/register")));
        }
        if (contains(q, "tham gia su kien", "join event", "roi su kien", "my event")) {
            facts.add(new Fact("Bạn có thể tham gia sự kiện đang mở trước khi hết hạn đăng ký. "
                    + "Tham gia sự kiện chưa tự giữ chỗ cho hoạt động; nếu muốn dự hoạt động cần "
                    + "đăng ký riêng. Bạn chỉ có thể rời sự kiện khi không còn chỗ đang giữ "
                    + "ở hoạt động nào.", new ChatSource("Sự kiện", "/su-kien")));
        }
        if (contains(q, "hoat dong", "workshop", "cho trong", "dang ky lai")) {
            facts.add(new Fact("Với hoạt động cần đăng ký, bạn có thể giữ chỗ khi hoạt động "
                    + "còn mở, chưa hết hạn đăng ký và còn chỗ. Nếu hai hoạt động trùng giờ, "
                    + "hệ thống sẽ nhắc bạn kiểm tra lịch.",
                    new ChatSource("Hoạt động", "/su-kien")));
        }
        if (contains(q, "qr", "diem danh", "attendance")) {
            facts.add(new Fact("Khi đến địa điểm, bạn đăng nhập và tự quét mã QR của hoạt động "
                    + "để điểm danh. Bạn có thể quét từ 15 phút trước giờ bắt đầu đến trước "
                    + "giờ kết thúc.",
                    new ChatSource("Hoạt động của tôi", "/participant/events")));
        }
        if (contains(q, "chung nhan", "certificate", "danh gia", "rating")) {
            facts.add(new Fact("Bạn có thể nhận chứng nhận sau khi hoạt động kết thúc và "
                    + "bạn đã điểm danh hợp lệ. Bạn cũng có thể đánh giá hoạt động khi "
                    + "đáp ứng hai điều kiện đó.", new ChatSource("Hoạt động của tôi",
                    "/participant/events")));
        }
        if (contains(q, "xac minh email", "xac thuc email", "email xac minh")) {
            facts.add(new Fact("Participant có thể đăng ký không cung cấp email. Khi có email, "
                    + "người dùng có thể xác minh bằng liên kết được gửi và yêu cầu gửi lại "
                    + "theo giao diện tài khoản. Không nhập liên kết hoặc mã xác minh vào chat.",
                    new ChatSource("Tài khoản", "/participant/profile")));
        }
        if (contains(q, "quen mat khau", "dat lai mat khau", "reset password")) {
            facts.add(new Fact("Hiện mình chưa thấy chức năng đặt lại mật khẩu trên website. "
                    + "Bạn đừng gửi mật khẩu hoặc mã xác minh qua chat.",
                    new ChatSource("Đăng nhập", "/login")));
        }
        if (contains(q, "gian hang", "booth", "so do", "ban do")) {
            facts.add(new Fact("Bạn có thể xem các gian hàng và bản đồ mà không cần đăng nhập. "
                    + "Nếu muốn thuê gian hàng, bạn cần làm theo quy trình dành cho đối tác.",
                    new ChatSource("Gian hàng", "/gian-hang")));
        }
        if (contains(q, "thong bao", "notification")) {
            facts.add(new Fact("Bạn có thể xem thông báo trong tài khoản của mình khi sự kiện "
                    + "hoặc hoạt động thay đổi, hoặc khi có cập nhật về chứng nhận.",
                    new ChatSource("Trang Participant", "/participant")));
        }
        if (contains(q, "ve hoat dong", "mua ve", "waitlist", "danh sach cho")) {
            facts.add(new Fact("Hiện website chưa hỗ trợ mua vé hoạt động hoặc đăng ký "
                    + "vào danh sách chờ qua chatbot.",
                    new ChatSource("Sự kiện", "/su-kien")));
        }
        if (contains(q, "huy su kien", "huy hoat dong", "doi lich", "thay doi lich")) {
            facts.add(new Fact("Lịch hoặc trạng thái của sự kiện và hoạt động có thể thay đổi. "
                    + "Hãy xem thông tin mới nhất trên trang sự kiện để biết chi tiết.",
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

    private static String friendlyTime(Instant instant) {
        return FRIENDLY_TIME.format(instant);
    }

    private static String friendlyStatus(String status) {
        return switch (status) {
            case "PUBLISHED" -> "sắp diễn ra";
            case "ONGOING" -> "đang diễn ra";
            case "COMPLETED" -> "đã kết thúc";
            case "ATTENDED" -> "đã tham gia";
            case "CANCELLED" -> "đã hủy";
            case "ACTIVE" -> "đang tham gia";
            case "LEFT" -> "đã rời";
            case "NO_SHOW" -> "chưa điểm danh";
            case "ISSUED" -> "đã cấp";
            case "REVOKED" -> "đã thu hồi";
            default -> "đang được cập nhật";
        };
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
