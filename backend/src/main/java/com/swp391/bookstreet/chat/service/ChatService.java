package com.swp391.bookstreet.chat.service;

import com.swp391.bookstreet.activity.service.PublicActivityService;
import com.swp391.bookstreet.chat.dto.ChatResponse;
import com.swp391.bookstreet.chat.dto.ChatSource;
import com.swp391.bookstreet.chat.dto.ChatTurn;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.registration.service.ParticipantActivityRegistrationService;
import com.swp391.bookstreet.registration.service.ParticipantEventRegistrationService;
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
        String normalized = ChatIntentResolver.normalize(question);
        String retrievalQuery = normalized;
        if (contains(normalized, "cai thu", "hoat dong do", "su kien do", "o dau")
                && !recent.isEmpty()) {
            for (int index = recent.size() - 1; index >= 0; index--) {
                if ("user".equals(recent.get(index).role())) {
                    retrievalQuery = ChatIntentResolver.normalize(recent.get(index).text())
                            + " " + normalized;
                    break;
                }
            }
        }
        if (contains(normalized, "mat khau", "password", "session", "token", "qr diem danh")
                && contains(normalized, "nguoi khac", "cua ban", "cho toi", "lay", "gui")) {
            return new ChatResponse("Mình không thể chia sẻ mật khẩu, mã điểm danh "
                    + "hoặc thông tin riêng của người khác.", List.of());
        }
        ChatIntentResolver.Intent intent = ChatIntentResolver.resolve(retrievalQuery);
        if (intent.personal() && !isParticipant()) {
            return new ChatResponse("Bạn đăng nhập để mình xem thông tin tham gia của bạn nhé.",
                    List.of(new ChatSource("Đăng nhập", "/login")));
        }
        List<Fact> facts = new ArrayList<>();
        if ((!intent.personal() || contains(intent.query(), "thong bao"))
                && (intent.target() == ChatIntentResolver.Target.NONE
                || !intent.discovery() || intent.howTo())) {
            addGuidance(intent.query(), facts);
        }
        if (intent.target() == ChatIntentResolver.Target.NONE && facts.isEmpty()
                && !intent.personal()) {
            ChatClassification classification = ai.classify(retrievalQuery);
            if (classification != null
                    && classification.intent() != ChatClassification.Kind.UNKNOWN) {
                intent = ChatIntentResolver.fromClassification(retrievalQuery, classification);
                if (intent.personal() && !isParticipant()) {
                    return new ChatResponse("Bạn đăng nhập để mình xem thông tin tham gia của bạn nhé.",
                            List.of(new ChatSource("Đăng nhập", "/login")));
                }
                if (intent.howTo()) addGuidance(intent.query(), facts);
            }
        }
        if (intent.personal()) addPersonal(intent.query(), facts);
        else {
            int guidanceCount = facts.size();
            if (!intent.howTo()) addPublic(intent, facts);
            if (facts.size() == guidanceCount && intent.target() != ChatIntentResolver.Target.NONE
                    && (intent.timeframe() != ChatIntentResolver.Timeframe.NONE
                    || intent.availability() || intent.fullOnly())) {
                return new ChatResponse(noPublicResults(intent), List.of());
            }
        }
        if (facts.isEmpty() && intent.personal()) {
            return new ChatResponse("Mình chưa thấy sự kiện hoặc hoạt động đã đăng ký "
                    + "trong tài khoản của bạn.", List.of(new ChatSource("Sự kiện của tôi",
                    "/participant/events")));
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

    private void addPublic(ChatIntentResolver.Intent intent, List<Fact> facts) {
        String q = intent.query();
        if (intent.target() == ChatIntentResolver.Target.EVENT
                || intent.target() == ChatIntentResolver.Target.BOTH) {
            for (int pageNumber = 0; pageNumber < 10 && facts.size() < 3; pageNumber++) {
                var page = events.listPublic(pageNumber, 30, "startAt,asc", null);
                for (var event : page.content()) {
                    if (matches(q, event.name(), event.description())
                            && matchesDate(intent.timeframe(), event.startAt(), event.endAt())) {
                        facts.add(new Fact("Sự kiện " + event.name() + " diễn ra từ "
                                + friendlyTime(event.startAt()) + " đến "
                                + friendlyTime(event.endAt()) + ". Hiện "
                                + friendlyStatus(event.status().name()) + ". "
                                + clip(event.description()), new ChatSource(event.name(),
                                "/su-kien")));
                        if (facts.size() >= 3) break;
                    }
                }
                if (pageNumber + 1 >= page.totalPages()) break;
            }
        }
        if (intent.target() == ChatIntentResolver.Target.ACTIVITY
                || intent.target() == ChatIntentResolver.Target.BOTH) {
            int activityCount = 0;
            for (int pageNumber = 0; pageNumber < 10 && activityCount < 3; pageNumber++) {
                var page = activities.list(pageNumber, 30, "startAt,asc",
                        null, null, null, null, null);
                for (var activity : page.content()) {
                    if ((!intent.availability() || activity.registrationOpen())
                            && (!intent.fullOnly() || activity.availableSeats() != null
                                    && activity.availableSeats() == 0)
                            && matchesActivityKind(q, activity.title(), activity.activityType())
                            && matches(q, activity.title(), activity.eventName(),
                                    activity.description())
                            && matchesDate(intent.timeframe(), activity.startAt(),
                                    activity.endAt())) {
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
                        activityCount++;
                        if (activityCount >= 3) break;
                    }
                }
                if (pageNumber + 1 >= page.totalPages()) break;
            }
        }
    }

    private void addPersonal(String q, List<Fact> facts) {
        boolean genericSchedule = contains(q, "lich", "lich cua toi", "lich cua minh",
                "toi da tham gia", "minh da tham gia");
        if (genericSchedule || contains(q, "su kien", "event", "tham gia")) {
            var page = myEvents.list(0, 20, "activatedAt,desc", null, null, null);
            for (var registration : page.content()) {
                facts.add(new Fact("Bạn đã tham gia sự kiện "
                        + registration.event().name() + "; hiện "
                        + friendlyStatus(registration.status().name()) + ".",
                        new ChatSource(registration.event().name(), "/participant/events")));
            }
        }
        if (genericSchedule || contains(q, "hoat dong", "activity", "dang ky", "diem danh",
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
                        new ChatSource(registration.activity().title(),
                                contains(q, "chung nhan", "certificate")
                                        ? "/participant/certificates" : "/participant/activities")));
            }
        }
    }

    private static void addGuidance(String q, List<Fact> facts) {
        boolean viewingPublic = contains(q, "xem su kien", "xem hoat dong", "xem lich",
                "khach", "guest")
                && contains(q, "dang nhap", "tai khoan", "can");
        if (viewingPublic) {
            facts.add(new Fact("Bạn có thể xem sự kiện và hoạt động đã công bố mà không cần "
                    + "đăng nhập. Để tham gia sự kiện hoặc đăng ký hoạt động, bạn cần đăng nhập.",
                    new ChatSource("Sự kiện", "/su-kien")));
        }
        if (contains(q, "khac nhau", "khac gi", "phan biet", "tai sao phai dang ky rieng")) {
            facts.add(new Fact("Sự kiện là chương trình lớn; hoạt động là một buổi cụ thể thuộc "
                    + "sự kiện. Tham gia sự kiện không tự giữ chỗ cho mọi hoạt động. Buổi nào "
                    + "yêu cầu đăng ký thì bạn cần chọn và đăng ký riêng.",
                    new ChatSource("Sự kiện và hoạt động", "/su-kien")));
        }
        if (contains(q, "quen mat khau", "dat lai mat khau", "reset password")) {
            facts.add(new Fact("Hiện mình chưa thấy chức năng đặt lại mật khẩu trên website. "
                    + "Bạn đừng gửi mật khẩu hoặc mã xác minh qua chat.",
                    new ChatSource("Đăng nhập", "/login")));
        } else if (!viewingPublic && contains(q, "dang nhap", "login")
                && !contains(q, "dang ky", "tao tai khoan")) {
            facts.add(new Fact("Bạn mở trang Đăng nhập, nhập tên đăng nhập và mật khẩu "
                    + "đã đăng ký để vào tài khoản của mình.",
                    new ChatSource("Đăng nhập", "/login")));
        } else if (!viewingPublic && (contains(q, "tai khoan", "dang nhap", "mat khau",
                "ten dang nhap")
                || contains(q, "dang ky")
                && !contains(q, "hoat dong", "workshop", "su kien", "event"))) {
            facts.add(new Fact("Để tạo tài khoản, bạn mở trang Đăng ký và nhập tên đăng nhập, "
                    + "họ tên, mật khẩu và xác nhận mật khẩu. Email không bắt buộc. Tên đăng nhập "
                    + "dài 3–20 ký tự, bắt đầu bằng chữ cái và chỉ gồm chữ cái không dấu hoặc số. "
                    + "Mật khẩu cần 8–64 ký tự. Đừng gửi mật khẩu qua chat.",
                    new ChatSource("Đăng ký", "/register")));
        }
        if (contains(q, "tham gia su kien", "dang ky su kien", "join event",
                "roi su kien", "my event")) {
            facts.add(new Fact("Bạn có thể tham gia sự kiện đang mở trước khi hết hạn đăng ký. "
                    + "Tham gia sự kiện chưa tự giữ chỗ cho hoạt động; nếu muốn dự hoạt động cần "
                    + "đăng ký riêng. Nếu đăng ký hoạt động trước, hệ thống sẽ tự ghi nhận tham gia "
                    + "sự kiện khi đủ điều kiện. Bạn chỉ có thể rời sự kiện khi không còn chỗ "
                    + "đang giữ ở hoạt động nào.", contains(q, "roi su kien")
                    ? new ChatSource("Sự kiện của tôi", "/participant/events")
                    : new ChatSource("Sự kiện", "/su-kien")));
        }
        if (contains(q, "hoat dong", "workshop", "cho trong", "dang ky lai")) {
            facts.add(new Fact("Với hoạt động cần đăng ký, bạn có thể giữ chỗ khi hoạt động "
                    + "còn mở, chưa hết hạn đăng ký và còn chỗ. Nếu hai hoạt động trùng giờ, "
                    + "hệ thống sẽ nhắc bạn kiểm tra lịch.",
                    new ChatSource("Hoạt động", "/su-kien")));
        }
        if (contains(q, "khong can dang ky", "khong phai dang ky", "tham gia truc tiep")) {
            facts.add(new Fact("Một số hoạt động mở cho khách tham gia trực tiếp, không cần "
                    + "đăng ký trước. Hoạt động có giới hạn chỗ sẽ hiển thị nút Đăng ký khi "
                    + "còn mở và còn chỗ.", new ChatSource("Hoạt động", "/su-kien")));
        }
        if (contains(q, "huy dang ky", "bo dang ky", "tra cho")) {
            facts.add(new Fact("Bạn có thể hủy đăng ký hoạt động trước giờ bắt đầu nếu chưa "
                    + "điểm danh hợp lệ. Chỗ đó sẽ được trả lại; đăng ký lại còn phụ thuộc "
                    + "hạn và số chỗ còn lại.", new ChatSource("Hoạt động của tôi",
                    "/participant/activities")));
        }
        if (contains(q, "qr", "diem danh", "attendance")) {
            facts.add(new Fact("Không có mã QR riêng cho mỗi người tham gia. Khi đến địa điểm, "
                    + "bạn đăng nhập và quét mã QR chung do Ban tổ chức đặt tại hoạt động. "
                    + "Chỉ quét được trong thời gian điểm danh của hoạt động.",
                    new ChatSource("Hoạt động của tôi", "/participant/activities")));
        }
        if (contains(q, "chung nhan", "certificate")) {
            facts.add(new Fact("Nếu hoạt động có cấp chứng nhận, bạn có thể nhận sau khi "
                    + "hoạt động kết thúc và đã điểm danh hợp lệ. Khi đủ điều kiện, bạn "
                    + "cũng có thể đánh giá hoạt động.", new ChatSource("Chứng nhận của tôi",
                    "/participant/certificates")));
        }
        if (contains(q, "danh gia", "rating")) {
            facts.add(new Fact("Bạn có thể đánh giá hoạt động sau khi hoạt động kết thúc "
                    + "và đã điểm danh hợp lệ. Mở mục Đánh giá & Góp ý để chọn hoạt động.",
                    new ChatSource("Đánh giá hoạt động", "/participant/feedback")));
        }
        if (contains(q, "xac minh email", "xac thuc email", "email xac minh")) {
            facts.add(new Fact("Participant có thể đăng ký không cung cấp email. Khi có email, "
                    + "người dùng có thể xác minh bằng liên kết được gửi và yêu cầu gửi lại "
                    + "theo giao diện tài khoản. Không nhập liên kết hoặc mã xác minh vào chat.",
                    new ChatSource("Tài khoản", "/participant/profile")));
        }
        if (contains(q, "email") && contains(q, "bat buoc", "can khong", "khong co")) {
            facts.add(new Fact("Email không bắt buộc khi bạn tự tạo tài khoản tham gia. "
                    + "Nếu nhập email, địa chỉ đó cần chưa được tài khoản khác sử dụng.",
                    new ChatSource("Đăng ký", "/register")));
        }
        if (contains(q, "gian hang", "booth")) {
            facts.add(new Fact("Bạn có thể xem các gian hàng và bản đồ mà không cần đăng nhập. "
                    + "Nếu muốn thuê gian hàng, bạn cần làm theo quy trình dành cho đối tác.",
                    new ChatSource("Gian hàng", "/#gian-hang")));
        }
        if (contains(q, "so do", "ban do")) {
            facts.add(new Fact("Bạn mở mục Bản đồ trên trang chủ để xem vị trí các gian hàng. "
                    + "Bạn không cần đăng nhập để xem bản đồ.",
                    new ChatSource("Bản đồ", "/#ban-do")));
        }
        if (contains(q, "thong bao", "notification")) {
            facts.add(new Fact("Bạn có thể xem thông báo trong tài khoản của mình khi sự kiện "
                    + "hoặc hoạt động thay đổi, hoặc khi có cập nhật về chứng nhận.",
                    new ChatSource("Thông báo của tôi", "/participant/notifications")));
        }
        if (contains(q, "lich cua toi", "lich cua minh", "hoat dong da dang ky")) {
            facts.add(new Fact("Sau khi đăng nhập, bạn xem sự kiện đã tham gia trong mục "
                    + "Sự kiện của tôi và các buổi đã giữ chỗ trong mục Hoạt động của tôi.",
                    new ChatSource("Hoạt động của tôi", "/participant/activities")));
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

    private boolean matchesDate(ChatIntentResolver.Timeframe timeframe, Instant start, Instant end) {
        DateWindow window = dateWindow(timeframe);
        if (window == null) return true;
        LocalDate startDay = start.atZone(VIETNAM).toLocalDate();
        LocalDate endDay = end.atZone(VIETNAM).toLocalDate();
        return !startDay.isAfter(window.last()) && !endDay.isBefore(window.first());
    }

    private DateWindow dateWindow(ChatIntentResolver.Timeframe timeframe) {
        LocalDate today = LocalDate.now(clock.withZone(VIETNAM));
        LocalDate thisSaturday = today.with(DayOfWeek.MONDAY).plusDays(5);
        LocalDate saturday = thisSaturday.isBefore(today)
                ? thisSaturday.plusWeeks(1) : thisSaturday;
        LocalDate sunday = today.with(DayOfWeek.SUNDAY);
        if (sunday.isBefore(today)) sunday = sunday.plusWeeks(1);
        return switch (timeframe) {
            case NONE -> null;
            case TODAY -> new DateWindow(today, today);
            case TOMORROW -> new DateWindow(today.plusDays(1), today.plusDays(1));
            case THIS_WEEK -> new DateWindow(today.with(DayOfWeek.MONDAY),
                    today.with(DayOfWeek.SUNDAY));
            case NEXT_WEEK -> new DateWindow(today.with(DayOfWeek.MONDAY).plusWeeks(1),
                    today.with(DayOfWeek.SUNDAY).plusWeeks(1));
            case THIS_WEEKEND -> new DateWindow(thisSaturday, thisSaturday.plusDays(1));
            case NEXT_WEEKEND -> new DateWindow(thisSaturday.plusWeeks(1),
                    thisSaturday.plusWeeks(1).plusDays(1));
            case SATURDAY -> new DateWindow(saturday, saturday);
            case SUNDAY -> new DateWindow(sunday, sunday);
        };
    }

    private String noPublicResults(ChatIntentResolver.Intent intent) {
        String kind = switch (intent.target()) {
            case EVENT -> "sự kiện";
            case ACTIVITY -> "hoạt động";
            case BOTH -> "sự kiện hoặc hoạt động";
            case NONE -> "thông tin";
        };
        DateWindow window = dateWindow(intent.timeframe());
        if (window != null) {
            return "Mình chưa thấy " + kind + " công khai nào "
                    + (intent.availability() ? "còn chỗ "
                            : intent.fullOnly() ? "đã hết chỗ " : "") + "trong khoảng "
                    + window.first().format(DateTimeFormatter.ofPattern("dd/MM")) + "–"
                    + window.last().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                    + ". Bạn có thể xem lịch mới nhất ở trang Sự kiện nhé.";
        }
        if (intent.availability()) return "Mình chưa thấy hoạt động nào đang mở đăng ký và còn chỗ. "
                + "Bạn có thể xem lịch mới nhất ở trang Sự kiện nhé.";
        if (intent.fullOnly()) return "Mình chưa thấy hoạt động nào đã hết chỗ. "
                + "Bạn có thể xem lịch mới nhất ở trang Sự kiện nhé.";
        return UNKNOWN;
    }

    private record DateWindow(LocalDate first, LocalDate last) {
    }

    private static final Set<String> SEARCH_STOP_WORDS = Set.copyOf(List.of(
            "nhung", "nao", "khong", "trong", "duoc", "hien", "tai", "cho", "toi",
            "hoat", "dong", "kien", "event", "activity", "workshop", "hom", "nay",
            "ngay", "mai", "cuoi", "tuan", "thu", "bay", "chu", "nhat", "con", "lich",
            "bao", "gio", "dien", "ra", "dang", "ky", "the", "tham", "gia", "noi", "dau",
            "sach", "cua", "nhu", "sao", "may", "su", "hay", "minh", "tren",
            "muon", "biet", "giup", "vui", "choi", "nhat", "toan", "lich",
            "chuong", "trinh", "giao", "luu", "thao", "khao", "nghiem",
            "ngay", "buoi", "coi", "tiep", "can", "dang", "suat", "trong",
            "thang", "cuoi", "truoc", "khac", "phan", "biet", "tuan",
            "chuyen", "noi", "talkshow", "show", "thuong", "bookstreet",
            "nhieu", "thieu", "du", "day",
            "duong", "pho", "sai", "gon"));

    private static boolean matches(String q, String... values) {
        String combined = ChatIntentResolver.normalize(String.join(" ", Arrays.stream(values)
                .filter(value -> value != null).toList()));
        List<String> terms = Arrays.stream(q.split(" "))
                .filter(word -> word.length() > 3 && !SEARCH_STOP_WORDS.contains(word)).toList();
        return terms.isEmpty() || terms.stream().anyMatch(combined::contains);
    }

    private static boolean matchesActivityKind(String q, String title, String type) {
        String description = ChatIntentResolver.normalize((title == null ? "" : title)
                + " " + (type == null ? "" : type));
        if (ChatIntentResolver.has(q, "giao luu", "toa dam", "gap tac gia", "talkshow",
                "buoi noi chuyen")) {
            return ChatIntentResolver.has(description, "giao luu", "toa dam", "talkshow",
                    "noi chuyen", "gap tac gia");
        }
        if (ChatIntentResolver.has(q, "workshop", "lop hoc", "buoi hoc")) {
            return ChatIntentResolver.has(description, "workshop", "lop hoc", "buoi hoc");
        }
        if (ChatIntentResolver.has(q, "buoi doc sach")) {
            return ChatIntentResolver.has(description, "doc sach", "reading");
        }
        return true;
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

    private record Fact(String text, ChatSource source) {
    }
}
