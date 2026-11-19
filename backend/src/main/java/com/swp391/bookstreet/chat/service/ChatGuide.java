package com.swp391.bookstreet.chat.service;

import com.swp391.bookstreet.chat.dto.ChatSource;
import java.util.LinkedHashMap;
import java.util.Map;

/** Curated, reviewed platform knowledge that Gemini may cite. Keep aligned with Business Rules. */
final class ChatGuide {
    record Topic(String text, ChatSource source) {
    }

    static final Map<String, Topic> TOPICS;

    static {
        Map<String, Topic> topics = new LinkedHashMap<>();
        topics.put("ACCOUNT_REGISTRATION", new Topic("Để tạo tài khoản, mở trang Đăng ký và nhập "
                + "tên đăng nhập, họ tên, mật khẩu và xác nhận mật khẩu. Email không bắt buộc; nếu "
                + "nhập thì email chưa được tài khoản khác dùng. Tên đăng nhập dài 3–20 ký tự, bắt "
                + "đầu bằng chữ cái, chỉ gồm chữ cái không dấu hoặc số. Họ tên 2–50 ký tự. Mật khẩu "
                + "8–64 ký tự. Tài khoản tự đăng ký là tài khoản người tham gia.",
                new ChatSource("Đăng ký", "/register")));
        topics.put("LOGIN", new Topic("Mở trang Đăng nhập, nhập tên đăng nhập và mật khẩu đã đăng "
                + "ký. Nếu quên mật khẩu, chọn Quên mật khẩu và dùng email đã xác minh để nhận liên "
                + "kết đặt lại. Không bao giờ gửi mật khẩu, mã xác minh hoặc liên kết đặt lại qua chat.",
                new ChatSource("Quên mật khẩu", "/forgot-password")));
        topics.put("EMAIL_VERIFICATION", new Topic("Người tham gia có thể đăng ký không cần email. "
                + "Khi có email, có thể xác minh bằng liên kết được gửi và yêu cầu gửi lại trong "
                + "trang tài khoản. Không nhập liên kết hoặc mã xác minh vào chat.",
                new ChatSource("Tài khoản", "/participant/profile")));
        topics.put("GUEST_ACCESS", new Topic("Khách có thể xem sự kiện, hoạt động đã công bố, gian "
                + "hàng và bản đồ mà không cần đăng nhập. Để tham gia sự kiện hoặc đăng ký hoạt "
                + "động cần đăng nhập.", new ChatSource("Sự kiện", "/su-kien")));
        topics.put("EVENT_VS_ACTIVITY", new Topic("Sự kiện là chương trình lớn; hoạt động là một "
                + "buổi cụ thể thuộc sự kiện. Tham gia sự kiện không tự giữ chỗ cho mọi hoạt động; "
                + "buổi nào yêu cầu đăng ký thì cần đăng ký riêng.",
                new ChatSource("Sự kiện", "/su-kien")));
        topics.put("EVENT_PARTICIPATION", new Topic("Có thể tham gia sự kiện đang mở trước khi hết "
                + "hạn đăng ký. Nếu đăng ký hoạt động trước, hệ thống tự ghi nhận tham gia sự kiện "
                + "khi đủ điều kiện. Chỉ có thể rời sự kiện khi không còn giữ chỗ ở hoạt động nào.",
                new ChatSource("Sự kiện của tôi", "/participant/events")));
        topics.put("ACTIVITY_REGISTRATION", new Topic("Với hoạt động cần đăng ký, có thể giữ chỗ khi "
                + "hoạt động còn mở, chưa hết hạn đăng ký và còn chỗ. Nếu hai hoạt động trùng giờ, "
                + "hệ thống sẽ nhắc kiểm tra lịch. Một số hoạt động mở cho khách tham gia trực tiếp "
                + "không cần đăng ký trước. Website chưa hỗ trợ mua vé hay danh sách chờ.",
                new ChatSource("Hoạt động", "/su-kien")));
        topics.put("CANCEL_REGISTRATION", new Topic("Có thể hủy đăng ký hoạt động trước giờ bắt đầu "
                + "nếu chưa điểm danh hợp lệ. Chỗ sẽ được trả lại; đăng ký lại phụ thuộc hạn và số "
                + "chỗ còn lại.", new ChatSource("Hoạt động của tôi", "/participant/activities")));
        topics.put("ATTENDANCE", new Topic("Không có mã QR riêng cho từng người. Khi đến địa điểm, "
                + "đăng nhập và quét mã QR chung do Ban tổ chức đặt tại hoạt động, trong thời gian "
                + "điểm danh của hoạt động.",
                new ChatSource("Hoạt động của tôi", "/participant/activities")));
        topics.put("CERTIFICATE", new Topic("Nếu hoạt động có cấp chứng nhận, có thể nhận sau khi "
                + "hoạt động kết thúc và đã điểm danh hợp lệ.",
                new ChatSource("Chứng nhận của tôi", "/participant/certificates")));
        topics.put("RATING", new Topic("Có thể đánh giá hoạt động sau khi hoạt động kết thúc và đã "
                + "điểm danh hợp lệ, trong mục Đánh giá & Góp ý.",
                new ChatSource("Đánh giá hoạt động", "/participant/feedback")));
        topics.put("BOOTH_AND_MAP", new Topic("Có thể xem gian hàng và bản đồ vị trí trên trang chủ "
                + "mà không cần đăng nhập. Muốn thuê gian hàng cần làm theo quy trình dành cho đối "
                + "tác.", new ChatSource("Gian hàng", "/#gian-hang")));
        topics.put("NOTIFICATION", new Topic("Thông báo trong tài khoản cập nhật khi sự kiện hoặc "
                + "hoạt động thay đổi, bị hủy, hoặc khi có cập nhật về chứng nhận.",
                new ChatSource("Thông báo của tôi", "/participant/notifications")));
        TOPICS = java.util.Collections.unmodifiableMap(topics);
    }

    private ChatGuide() {
    }
}
