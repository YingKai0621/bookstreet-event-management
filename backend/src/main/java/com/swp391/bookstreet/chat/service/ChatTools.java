package com.swp391.bookstreet.chat.service;

import com.swp391.bookstreet.activity.dto.PublicActivityResponse;
import com.swp391.bookstreet.activity.service.PublicActivityService;
import com.swp391.bookstreet.booth.dto.EventBoothResponse;
import com.swp391.bookstreet.booth.entity.BoothAvailability;
import com.swp391.bookstreet.booth.service.EventBoothService;
import com.swp391.bookstreet.chat.dto.ChatSource;
import com.swp391.bookstreet.event.dto.EventSummaryResponse;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.service.NotificationInboxService;
import com.swp391.bookstreet.registration.service.ParticipantActivityRegistrationService;
import com.swp391.bookstreet.registration.service.ParticipantEventRegistrationService;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * The only data surface Gemini can reach. Every tool returns a hand-built, whitelisted
 * projection: no usernames, passwords, emails, internal ids, tokens or other users' data.
 */
@Component
public class ChatTools {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ChatTools.class);
    static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter FRIENDLY_TIME = DateTimeFormatter
            .ofPattern("dd/MM/yyyy 'lúc' HH:mm", Locale.forLanguageTag("vi-VN")).withZone(VIETNAM);
    private static final int PAGE_SIZE = 30;
    private static final int MAX_PAGES = 10;
    private static final int MAX_RESULTS = 8;

    private final EventService events;
    private final PublicActivityService activities;
    private final ParticipantEventRegistrationService myEvents;
    private final ParticipantActivityRegistrationService myActivities;
    private final EventBoothService booths;
    private final NotificationInboxService myNotifications;

    public ChatTools(EventService events, PublicActivityService activities,
            ParticipantEventRegistrationService myEvents,
            ParticipantActivityRegistrationService myActivities,
            EventBoothService booths, NotificationInboxService myNotifications) {
        this.events = events;
        this.activities = activities;
        this.myEvents = myEvents;
        this.myActivities = myActivities;
        this.booths = booths;
        this.myNotifications = myNotifications;
    }

    public List<Map<String, Object>> declarations() {
        Map<String, Object> keyword = stringProp("Từ khóa trong tên hoặc mô tả, có thể bỏ trống.");
        Map<String, Object> from = stringProp("Ngày bắt đầu khoảng tìm, định dạng yyyy-MM-dd.");
        Map<String, Object> to = stringProp("Ngày kết thúc khoảng tìm, định dạng yyyy-MM-dd.");
        return List.of(
                function("search_events",
                        "Tìm các sự kiện BookStreet đang công khai (sắp diễn ra, đang diễn ra, "
                                + "đã kết thúc hoặc đã hủy).",
                        Map.of("keyword", keyword, "fromDate", from, "toDate", to)),
                function("search_activities",
                        "Tìm các hoạt động công khai (workshop, giao lưu, đọc sách...) thuộc "
                                + "sự kiện, gồm thời gian, địa điểm, số chỗ còn lại và tình trạng "
                                + "đăng ký.",
                        Map.of("keyword", keyword,
                                "eventName", stringProp("Tên sự kiện chứa hoạt động, nếu biết."),
                                "fromDate", from, "toDate", to,
                                "onlyOpenForRegistration", Map.of("type", "boolean",
                                        "description", "true nếu chỉ lấy hoạt động còn mở đăng ký."))),
                function("get_event_details",
                        "Xem chi tiết MỘT sự kiện theo tên: thời gian, mô tả, toàn bộ hoạt động "
                                + "trong sự kiện và số gian hàng còn trống.",
                        Map.of("eventName", stringProp("Tên (hoặc một phần tên) sự kiện."))),
                function("search_booths",
                        "Tìm gian hàng của một sự kiện: mã, tên vị trí, mô tả, sức chứa, giá thuê "
                                + "và tình trạng (còn trống, đang giữ chỗ, đã có đối tác).",
                        Map.of("eventName", stringProp("Tên (hoặc một phần tên) sự kiện."),
                                "keyword", keyword,
                                "onlyAvailable", Map.of("type", "boolean",
                                        "description", "true nếu chỉ lấy gian hàng còn trống."))),
                function("get_platform_guide",
                        "Lấy hướng dẫn chính thức về cách dùng website và quy định hệ thống.",
                        Map.of("topic", Map.of("type", "string",
                                "enum", List.copyOf(ChatGuide.TOPICS.keySet()),
                                "description", "Chủ đề cần tra cứu."))),
                function("get_my_participation",
                        "Lấy sự kiện đã tham gia và hoạt động đã đăng ký của CHÍNH người đang "
                                + "chat, có thể lọc theo khoảng ngày (ví dụ lịch tuần sau). "
                                + "Trả về LOGIN_REQUIRED nếu chưa đăng nhập.",
                        Map.of("fromDate", from, "toDate", to)),
                function("get_my_notifications",
                        "Lấy các thông báo gần đây của CHÍNH người đang chat. Trả về "
                                + "LOGIN_REQUIRED nếu chưa đăng nhập.",
                        Map.of("unreadOnly", Map.of("type", "boolean",
                                "description", "true nếu chỉ lấy thông báo chưa đọc."))));
    }

    /** Executes a model-requested tool; unknown names and bad arguments return an error map. */
    public ToolResult execute(String name, JsonNode args) {
        log.info("Chat tool call {} {}", name, args);
        try {
            return switch (name) {
                case "search_events" -> searchEvents(args);
                case "search_activities" -> searchActivities(args);
                case "get_platform_guide" -> guide(args);
                case "get_my_participation" -> myParticipation(args);
                case "get_event_details" -> eventDetails(args);
                case "search_booths" -> searchBooths(args);
                case "get_my_notifications" -> myNotifications(args);
                default -> new ToolResult(Map.of("error", "UNKNOWN_TOOL"), List.of());
            };
        } catch (RuntimeException error) {
            log.warn("Chat tool {} failed", name, error);
            return new ToolResult(Map.of("error", "LOOKUP_FAILED"), List.of());
        }
    }

    private ToolResult searchEvents(JsonNode args) {
        String keyword = normalize(text(args, "keyword"));
        LocalDate from = date(args, "fromDate");
        LocalDate to = date(args, "toDate");
        List<Map<String, Object>> found = new ArrayList<>();
        List<ChatLinks.Candidate> links = new ArrayList<>();
        for (int page = 0; page < MAX_PAGES && found.size() < MAX_RESULTS; page++) {
            var result = events.listPublic(page, PAGE_SIZE, "startAt,asc", null);
            for (EventSummaryResponse event : result.content()) {
                if (!matches(keyword, event.name(), event.description())
                        || !overlaps(from, to, event.startAt(), event.endAt())) continue;
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("name", event.name());
                item.put("description", clip(event.description()));
                item.put("startsAt", time(event.startAt()));
                item.put("endsAt", time(event.endAt()));
                item.put("status", friendlyStatus(event.status().name()));
                if (event.cancellationReason() != null) {
                    item.put("cancellationReason", clip(event.cancellationReason()));
                }
                found.add(item);
                links.add(eventLink(event));
                if (found.size() >= MAX_RESULTS) break;
            }
            if (page + 1 >= result.totalPages()) break;
        }
        return new ToolResult(Map.of("events", found),
                found.isEmpty() ? List.of() : List.of(new ChatSource("Sự kiện", "/su-kien")),
                links);
    }

    private ToolResult searchActivities(JsonNode args) {
        String keyword = normalize(text(args, "keyword"));
        String eventName = normalize(text(args, "eventName"));
        LocalDate from = date(args, "fromDate");
        LocalDate to = date(args, "toDate");
        boolean openOnly = args != null && args.path("onlyOpenForRegistration").asBoolean(false);
        List<Map<String, Object>> found = new ArrayList<>();
        List<ChatLinks.Candidate> links = new ArrayList<>();
        for (int page = 0; page < MAX_PAGES && found.size() < MAX_RESULTS; page++) {
            var result = activities.list(page, PAGE_SIZE, "startAt,asc",
                    null, null, null, null, null);
            for (PublicActivityResponse activity : result.content()) {
                if ((openOnly && !activity.registrationOpen())
                        || !matches(keyword, activity.title(), activity.description(),
                                activity.activityType(), activity.eventName())
                        || !matches(eventName, activity.eventName())
                        || !overlaps(from, to, activity.startAt(), activity.endAt())) continue;
                found.add(activityItem(activity));
                links.add(activityLink(activity));
                if (found.size() >= MAX_RESULTS) break;
            }
            if (page + 1 >= result.totalPages()) break;
        }
        return new ToolResult(Map.of("activities", found),
                found.isEmpty() ? List.of() : List.of(new ChatSource("Sự kiện", "/su-kien")),
                links);
    }

    /**
     * Resolves one public event by (partial, accent-insensitive) name. An exact name wins;
     * otherwise a single phrase match, then a single all-terms match. Several candidates
     * produce AMBIGUOUS_EVENT so the model asks the user instead of silently picking one.
     */
    private EventLookup findEvent(String name) {
        String wanted = normalize(name);
        if (wanted.isBlank()) return EventLookup.failed(eventNotFound());
        List<EventSummaryResponse> phrase = new ArrayList<>();
        List<EventSummaryResponse> loose = new ArrayList<>();
        for (int page = 0; page < MAX_PAGES; page++) {
            var result = events.listPublic(page, PAGE_SIZE, "startAt,asc", null);
            for (EventSummaryResponse event : result.content()) {
                String eventName = normalize(event.name());
                if (eventName.equals(wanted)) return new EventLookup(event, null);
                if (eventName.contains(wanted)) phrase.add(event);
                else if (matches(wanted, event.name())) loose.add(event);
            }
            if (page + 1 >= result.totalPages()) break;
        }
        List<EventSummaryResponse> candidates = phrase.isEmpty() ? loose : phrase;
        if (candidates.isEmpty()) return EventLookup.failed(eventNotFound());
        if (candidates.size() == 1) return new EventLookup(candidates.get(0), null);
        return EventLookup.failed(new ToolResult(Map.of("error", "AMBIGUOUS_EVENT",
                "candidates", candidates.stream().limit(8).map(EventSummaryResponse::name).toList(),
                "hint", "Hỏi lại người dùng muốn sự kiện nào, hoặc gọi lại với tên đầy đủ."),
                List.of()));
    }

    private record EventLookup(EventSummaryResponse event, ToolResult error) {
        static EventLookup failed(ToolResult error) {
            return new EventLookup(null, error);
        }
    }

    private static ToolResult eventNotFound() {
        return new ToolResult(Map.of("error", "EVENT_NOT_FOUND",
                "hint", "Dùng search_events để tìm đúng tên sự kiện."), List.of());
    }

    private ToolResult eventDetails(JsonNode args) {
        EventLookup lookup = findEvent(text(args, "eventName"));
        if (lookup.error() != null) return lookup.error();
        EventSummaryResponse event = lookup.event();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", event.name());
        data.put("description", clip(event.description()));
        data.put("startsAt", time(event.startAt()));
        data.put("endsAt", time(event.endAt()));
        data.put("status", friendlyStatus(event.status().name()));
        if (event.cancellationReason() != null) {
            data.put("cancellationReason", clip(event.cancellationReason()));
        }
        List<Map<String, Object>> eventActivities = new ArrayList<>();
        List<ChatLinks.Candidate> links = new ArrayList<>(List.of(eventLink(event)));
        for (int page = 0; page < MAX_PAGES && eventActivities.size() < 20; page++) {
            var result = activities.list(page, PAGE_SIZE, "startAt,asc",
                    event.eventId(), null, null, null, null);
            for (PublicActivityResponse activity : result.content()) {
                if (eventActivities.size() >= 20) break;
                eventActivities.add(activityItem(activity));
                links.add(activityLink(activity));
            }
            if (page + 1 >= result.totalPages()) break;
        }
        data.put("activities", eventActivities);
        try {
            data.put("availableBooths", booths.listPublic(event.eventId(), 0, 1, "code,asc",
                    BoothAvailability.AVAILABLE, null).totalElements());
        } catch (RuntimeException ignored) {
            // Booth map may be unavailable for this event; the other details still apply.
        }
        return new ToolResult(data, List.of(new ChatSource(event.name(),
                "/su-kien/" + event.eventId())), links);
    }

    private ToolResult searchBooths(JsonNode args) {
        EventLookup lookup = findEvent(text(args, "eventName"));
        if (lookup.error() != null) return lookup.error();
        EventSummaryResponse event = lookup.event();
        String keyword = normalize(text(args, "keyword"));
        boolean availableOnly = args != null && args.path("onlyAvailable").asBoolean(false);
        List<Map<String, Object>> found = new ArrayList<>();
        List<ChatLinks.Candidate> links = new ArrayList<>();
        var result = booths.listPublic(event.eventId(), 0, 100, "code,asc",
                availableOnly ? BoothAvailability.AVAILABLE : null, null);
        for (EventBoothResponse config : result.content()) {
            var booth = config.booth();
            if (!config.enabled() || !matches(keyword, booth.code(), booth.name(),
                    booth.description(), booth.categoryCode())) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("code", booth.code());
            item.put("name", booth.name());
            item.put("description", clip(booth.description()));
            item.put("category", booth.categoryCode());
            item.put("maxCapacity", booth.maxCapacity());
            item.put("rentalPrice", config.rentalPrice());
            item.put("availability", switch (config.availability()) {
                case AVAILABLE -> "còn trống";
                case ON_HOLD -> "đang được giữ chỗ";
                case ASSIGNED -> "đã có đối tác";
                case UNAVAILABLE -> "không cho thuê";
            });
            found.add(item);
            links.add(new ChatLinks.Candidate(new ChatSource(booth.name(), "/gian-hang/"
                    + booth.boothId() + "?eventId=" + event.eventId()), booth.name(), null));
            if (found.size() >= 15) break;
        }
        return new ToolResult(Map.of("event", event.name(), "booths", found),
                List.of(new ChatSource("Gian hàng", "/gian-hang")), links);
    }

    private ToolResult myNotifications(JsonNode args) {
        if (!isParticipant()) {
            return new ToolResult(Map.of("error", "LOGIN_REQUIRED"),
                    List.of(new ChatSource("Đăng nhập", "/login")));
        }
        boolean unreadOnly = args != null && args.path("unreadOnly").asBoolean(false);
        List<Map<String, Object>> found = new ArrayList<>();
        for (var notification : myNotifications.list(NotificationRecipientRole.PARTICIPANT,
                "0", "10", "createdAt,desc", unreadOnly ? "false" : null, null).content()) {
            found.add(Map.of("title", notification.title(),
                    "message", clip(notification.message()),
                    "createdAt", time(notification.createdAt()),
                    "read", notification.read()));
        }
        return new ToolResult(Map.of("notifications", found), List.of(
                new ChatSource("Thông báo của tôi", "/participant/notifications")));
    }

    private static Map<String, Object> activityItem(PublicActivityResponse activity) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("title", activity.title());
        item.put("event", activity.eventName());
        item.put("type", activity.activityType());
        item.put("description", clip(activity.description()));
        item.put("startsAt", time(activity.startAt()));
        item.put("endsAt", time(activity.endAt()));
        if (activity.location() != null) item.put("location", activity.location().name());
        item.put("status", friendlyStatus(activity.status().name()));
        item.put("registrationRequired", activity.registrationRequired());
        if (activity.registrationRequired()) {
            item.put("registrationOpen", activity.registrationOpen());
            item.put("registrationDeadline", time(activity.registrationDeadlineAt()));
            item.put("capacity", activity.capacity());
            item.put("availableSeats", activity.availableSeats());
        }
        item.put("certificateEnabled", activity.certificateEnabled());
        if (activity.ratingSummary() != null && activity.ratingSummary().ratingCount() > 0) {
            item.put("averageRating", activity.ratingSummary().averageScore());
            item.put("ratingCount", activity.ratingSummary().ratingCount());
        }
        if (activity.cancellationReason() != null) {
            item.put("cancellationReason", clip(activity.cancellationReason()));
        }
        return item;
    }

    private static ToolResult guide(JsonNode args) {
        String topic = text(args, "topic");
        ChatGuide.Topic entry = ChatGuide.TOPICS.get(topic);
        if (entry == null) {
            return new ToolResult(Map.of("error", "UNKNOWN_TOPIC",
                    "availableTopics", List.copyOf(ChatGuide.TOPICS.keySet())), List.of());
        }
        return new ToolResult(Map.of("guide", entry.text()), List.of(entry.source()));
    }

    private ToolResult myParticipation(JsonNode args) {
        LocalDate from = date(args, "fromDate");
        LocalDate to = date(args, "toDate");
        if (!isParticipant()) {
            return new ToolResult(Map.of("error", "LOGIN_REQUIRED"),
                    List.of(new ChatSource("Đăng nhập", "/login")));
        }
        List<Map<String, Object>> joinedEvents = new ArrayList<>();
        List<ChatLinks.Candidate> links = new ArrayList<>();
        for (var registration : myEvents.list(0, 20, "activatedAt,desc", null, null, null)
                .content()) {
            var event = registration.event();
            if (!overlaps(from, to, event.startAt(), event.endAt())) continue;
            joinedEvents.add(Map.of("event", event.name(),
                    "startsAt", time(event.startAt()), "endsAt", time(event.endAt()),
                    "status", friendlyStatus(registration.status().name())));
            links.add(new ChatLinks.Candidate(new ChatSource(event.name(),
                    "/participant/events/" + event.eventId()), event.name(), null));
        }
        List<Map<String, Object>> registeredActivities = new ArrayList<>();
        for (var registration : myActivities.list(0, 20, "activatedAt,desc", null, null,
                null, null, null).content()) {
            var activity = registration.activity();
            if (!overlaps(from, to, activity.startAt(), activity.endAt())) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("activity", activity.title());
            item.put("location", activity.locationName());
            item.put("startsAt", time(activity.startAt()));
            item.put("endsAt", time(activity.endAt()));
            item.put("registrationStatus", friendlyStatus(registration.status()));
            item.put("outcome", friendlyStatus(registration.outcome()));
            item.put("certificate", registration.certificate() == null ? "chưa có"
                    : friendlyStatus(registration.certificate().status()));
            registeredActivities.add(item);
            links.add(new ChatLinks.Candidate(new ChatSource(activity.title(),
                    "/participant/activities/detail/" + activity.activityId()),
                    activity.title(), null));
        }
        return new ToolResult(Map.of("joinedEvents", joinedEvents,
                "registeredActivities", registeredActivities),
                List.of(new ChatSource("Sự kiện của tôi", "/participant/events"),
                        new ChatSource("Hoạt động của tôi", "/participant/activities")));
    }

    static boolean isParticipant() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                        .anyMatch(authority -> "ROLE_PARTICIPANT".equals(authority.getAuthority()));
    }

    private static final Set<String> STOP_WORDS = Set.of("su", "kien", "hoat", "dong",
            "event", "activity", "nao", "cac", "nhung", "va", "cua", "o", "tai", "voi");

    /** Accent-insensitive match: every significant keyword term must appear in the values. */
    static boolean matches(String keyword, String... values) {
        if (keyword.isBlank()) return true;
        String haystack = normalize(String.join(" ", Arrays.stream(values)
                .filter(value -> value != null).toList()));
        if (haystack.contains(keyword)) return true;
        List<String> terms = Arrays.stream(keyword.split(" "))
                .filter(term -> term.length() > 1 && !STOP_WORDS.contains(term)).toList();
        return terms.isEmpty() || terms.stream().allMatch(term ->
                (" " + haystack + " ").contains(" " + term + " "));
    }

    static String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd').replaceAll("[^a-z0-9 ]", " ")
                .replaceAll(" +", " ").trim();
    }

    private static boolean overlaps(LocalDate from, LocalDate to, Instant start, Instant end) {
        if (start == null || end == null) return from == null && to == null;
        LocalDate startDay = start.atZone(VIETNAM).toLocalDate();
        LocalDate endDay = end.atZone(VIETNAM).toLocalDate();
        return (to == null || !startDay.isAfter(to)) && (from == null || !endDay.isBefore(from));
    }

    private static String text(JsonNode args, String field) {
        if (args == null || !args.path(field).isString()) return "";
        String value = args.path(field).asString().trim();
        return value.length() > 100 ? value.substring(0, 100) : value;
    }

    private static LocalDate date(JsonNode args, String field) {
        String value = text(args, field);
        if (value.isEmpty()) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException error) {
            return null;
        }
    }

    private static String clip(String value) {
        if (value == null) return "";
        return value.length() <= 300 ? value : value.substring(0, 300) + "…";
    }

    private static String time(Instant instant) {
        return instant == null ? null : FRIENDLY_TIME.format(instant);
    }

    static String friendlyStatus(String status) {
        if (status == null) return "đang được cập nhật";
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
            case "PENDING" -> "chưa có kết quả";
            default -> "đang được cập nhật";
        };
    }

    private static Map<String, Object> stringProp(String description) {
        return Map.of("type", "string", "description", description);
    }

    private static Map<String, Object> function(String name, String description,
            Map<String, Object> properties) {
        Map<String, Object> declaration = new LinkedHashMap<>();
        declaration.put("name", name);
        declaration.put("description", description);
        if (!properties.isEmpty()) {
            declaration.put("parameters", Map.of("type", "object", "properties", properties));
        }
        return declaration;
    }

    public record ToolResult(Map<String, Object> data, List<ChatSource> sources,
            List<ChatLinks.Candidate> links) {
        public ToolResult(Map<String, Object> data, List<ChatSource> sources) {
            this(data, sources, List.of());
        }
    }

    private static ChatLinks.Candidate eventLink(EventSummaryResponse event) {
        return new ChatLinks.Candidate(new ChatSource(event.name(), "/su-kien/" + event.eventId()),
                event.name(), null);
    }

    private static ChatLinks.Candidate activityLink(PublicActivityResponse activity) {
        // Activities have no public page of their own; the link opens (and is named after)
        // the event page that lists them.
        return new ChatLinks.Candidate(new ChatSource(activity.eventName(),
                "/su-kien/" + activity.eventId()), activity.title(), activity.eventName());
    }
}
