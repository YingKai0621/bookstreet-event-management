# Chatbot Guest và Participant — hợp đồng triển khai

Ngày 26/10/2026. Tính năng này được thực hiện theo yêu cầu riêng của project owner. `08_MVP_Scope_v2.md` vẫn ghi AI chatbot ngoài MVP, và `CURRENT_SPRINT.md` vẫn giới hạn Sprint 6; thay đổi này cần được quản lý như một hạng mục chatbot độc lập, không coi là Acceptance Criterion Sprint 6.

## Mục đích và ranh giới

- Trả lời câu hỏi tự do bằng tiếng Việt cho Guest và Participant.
- Chỉ đọc dữ liệu. Chatbot không Join/Leave, đăng ký/hủy Activity, điểm danh, đánh giá, thanh toán hay sửa hồ sơ.
- Thông tin công khai lấy từ `EventService.listPublic` và `PublicActivityService.list`. Thông tin “của tôi” lấy từ các service Participant hiện có, vốn xác định User từ Session.
- Không đưa raw QR token, mật khẩu, session ID hoặc thông tin của User khác vào ngữ cảnh AI.
- Không lưu lịch sử chat vào PostgreSQL hoặc Redis. Giao diện chỉ giữ lịch sử trong bộ nhớ của tab đang mở.
- Câu hỏi và các facts liên quan được gửi tới OpenAI Responses API. Vì vậy không nhập thông tin bí mật vào ô chat. API key chỉ nằm ở backend.

## API

`POST /api/v1/chat/messages` cho Guest và Participant. Trình duyệt gửi CSRF token theo chính sách hiện có.

Request:

```json
{"message":"Cuối tuần này có hoạt động nào?"}
```

`message` bắt buộc, không quá 500 ký tự. Response:

`history` tùy chọn, tối đa 6 lượt `{ "role": "user|assistant", "text": "..." }` (mỗi lượt tối đa 500 ký tự). Frontend gửi lịch sử trong tab để hiểu câu hỏi nối tiếp; backend không tin lịch sử này là dữ liệu BookStreet và luôn truy vấn lại nguồn hiện tại.

```json
{
  "answer":"Câu trả lời bằng tiếng Việt dựa trên dữ liệu đã tìm được.",
  "sources":[{"title":"Hoạt động hoặc trang liên quan","url":"/su-kien"}]
}
```

Chatbot tự trả lời khi không tìm được facts hoặc khi Guest hỏi dữ liệu cá nhân. Khi chưa có `CHATBOT_API_KEY`, API trả `503`. Lỗi từ nhà cung cấp trả `502`; quá 8 yêu cầu/phút trên cùng IP trả `429`. Không hiển thị phản hồi lỗi thô hoặc key của nhà cung cấp.

## Cấu hình

Đặt `CHATBOT_API_KEY` và tùy chọn `CHATBOT_MODEL` trong `.env` cục bộ hoặc secret của môi trường triển khai. File `.env` không được commit. Mặc định model là `gpt-4.1-mini`; model phải được tài khoản API của bạn hỗ trợ. Server cần outbound HTTPS tới `api.openai.com`. Không cần GPU, pgvector hoặc migration.

## Phép thử nghiệm thu

1. Guest hỏi quy tắc đăng ký: có trả lời và link; Guest hỏi “đăng ký của tôi”: hướng dẫn đăng nhập, không gọi service dữ liệu riêng.
2. Participant hỏi “hoạt động của tôi”: lấy dữ liệu theo Session, không chấp nhận userId trong request.
3. Sự kiện/Activity không có trong dữ liệu trả về: chatbot nói chưa tìm được, không bịa kết quả.
4. Thiếu API key và lỗi nhà cung cấp: giao diện báo chưa trả lời được, không hiển thị câu giả.
5. Câu hỏi quá 500 ký tự hoặc gửi quá nhanh bị từ chối.
6. Câu lệnh yêu cầu mật khẩu, QR token hoặc dữ liệu người khác không được gửi tới mô hình.

## Giới hạn hiện tại

- Tìm kiếm dữ liệu công khai đọc tối đa 30 Event và 30 Activity theo thứ tự bắt đầu. Cần thêm tìm kiếm/paging theo query trước khi dùng cho catalog lớn.
- Nguồn dẫn tới trang danh sách hiện có; frontend chưa có link public riêng cho từng Activity.
- Bộ câu hỏi 82 ý định là tập kiểm thử ban đầu, không phải toàn bộ FAQ đã được biên tập và duyệt.
- Chưa có kiểm thử tích hợp với tài khoản OpenAI thật vì repository không chứa API key.
