# Chatbot Guest và Participant — hợp đồng triển khai

Ngày 26/10/2026. Tính năng này được thực hiện theo yêu cầu riêng của project owner. `08_MVP_Scope_v2.md` vẫn ghi AI chatbot ngoài MVP, và `CURRENT_SPRINT.md` vẫn giới hạn Sprint 6; thay đổi này cần được quản lý như một hạng mục chatbot độc lập, không coi là Acceptance Criterion Sprint 6.

## Mục đích và ranh giới

- Trả lời câu hỏi tự do bằng tiếng Việt cho Guest và Participant.
- Chỉ đọc dữ liệu. Chatbot không Join/Leave, đăng ký/hủy Activity, điểm danh, đánh giá, thanh toán hay sửa hồ sơ.
- Thông tin công khai lấy từ `EventService.listPublic` và `PublicActivityService.list`. Thông tin “của tôi” lấy từ các service Participant hiện có, vốn xác định User từ Session.
- Không đưa raw QR token, mật khẩu, session ID hoặc thông tin của User khác vào ngữ cảnh AI.
- Không lưu lịch sử chat vào PostgreSQL hoặc Redis. Giao diện chỉ giữ lịch sử trong bộ nhớ của tab đang mở.
- Câu trả lời hướng tới người dùng phổ thông: 1–3 câu ngắn, dùng giờ Việt Nam và từ ngữ quen thuộc; chỉ nêu chi tiết được hỏi. Mã trạng thái và thuật ngữ kỹ thuật không được đưa vào ngữ cảnh hiển thị.
- Câu hỏi và các facts liên quan được gửi tới Gemini Generate Content API. Vì vậy không nhập thông tin bí mật vào ô chat. API key chỉ nằm ở backend.

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

Chatbot tự trả lời khi không tìm được facts hoặc khi Guest hỏi dữ liệu cá nhân. Nếu bước phân loại AI không sẵn sàng, chatbot trả lời chưa tìm thấy thay vì truy vấn dữ liệu theo một ý định chưa được kiểm tra. Khi đã có facts nhưng chưa có `GEMINI_API_KEY`/`CHATBOT_API_KEY` hoặc key/model không truy cập được, API trả `503`. Gemini trả `402` khi tài khoản cần thanh toán hoặc hết hạn mức; lỗi tạm thời khác trả `502`; quá 8 yêu cầu/phút trên cùng IP trả `429`. Không hiển thị phản hồi lỗi thô hoặc key của nhà cung cấp.

## Cấu hình

Đặt `GEMINI_API_KEY` và tùy chọn `CHATBOT_MODEL` trong `.env` cục bộ hoặc secret của môi trường triển khai. `CHATBOT_API_KEY` cũ vẫn được đọc nếu chưa đổi tên biến. File `.env` không được commit. Mặc định model là `gemini-3.5-flash-lite`; model phải được tài khoản Gemini API của bạn hỗ trợ. Server cần outbound HTTPS tới `generativelanguage.googleapis.com`. Không cần GPU, pgvector hoặc migration.

## Phép thử nghiệm thu

1. Guest hỏi quy tắc đăng ký: có trả lời và link; Guest hỏi “đăng ký của tôi”: hướng dẫn đăng nhập, không gọi service dữ liệu riêng.
2. Participant hỏi “hoạt động của tôi”: lấy dữ liệu theo Session, không chấp nhận userId trong request.
3. Sự kiện/Activity không có trong dữ liệu trả về: chatbot nói chưa tìm được, không bịa kết quả.
4. Thiếu API key và lỗi nhà cung cấp: giao diện báo chưa trả lời được, không hiển thị câu giả.
5. Câu hỏi quá 500 ký tự hoặc gửi quá nhanh bị từ chối.
6. Câu lệnh yêu cầu mật khẩu, QR token hoặc dữ liệu người khác không được gửi tới mô hình.

## Nhận diện câu hỏi nhiều cách diễn đạt

Backend chuẩn hóa tiếng Việt rồi xử lý các cụm phổ biến theo `ChatIntentResolver`: sự kiện,
hoạt động, câu hỏi lịch chung, hướng dẫn, dữ liệu của tôi, thời gian và yêu cầu còn chỗ.
Các cách nói như “cuối tuần có gì vui”, “lịch thứ Bảy”, “có chương trình nào”, “buổi giao lưu”,
“buổi nói chuyện” và “còn suất” được chuyển về cùng loại truy vấn mà không gọi thêm Gemini.
Tìm kiếm chỉ dùng service công khai hoặc service Participant lấy chủ sở hữu từ Session.
Danh sách được đọc từng trang tối đa 10 trang × 30 bản ghi; chatbot chỉ gửi tối đa 5 facts
cho bước soạn câu trả lời.

Khi không xác định được ý định bằng quy tắc, backend gọi Gemini một lần để phân loại thành
`intent`, `timeframe` và `availableOnly`. Backend chỉ chấp nhận enum và boolean hợp lệ;
không nhận SQL, URL, userId, tên bảng hay nội dung trả lời từ bước phân loại. Kết quả
không hợp lệ hoặc API phân loại không sẵn sàng được xem là `UNKNOWN`; không truy vấn dữ liệu
riêng nếu Guest chưa đăng nhập. Bước soạn câu trả lời vẫn chỉ nhận facts đã tìm được.

Ngữ cảnh hướng dẫn thường gặp gồm: xem nội dung khi chưa đăng nhập, tạo tài khoản,
khác biệt giữa tham gia Event và giữ chỗ Activity, hoạt động không cần đăng ký, hủy đăng ký,
quét QR chung tại địa điểm, chứng nhận, email, thông báo, gian hàng và chức năng chưa hỗ trợ.
Thông tin lịch, chỗ trống và trạng thái cá nhân luôn lấy từ runtime, không lấy từ câu hỏi mẫu.

## Giới hạn hiện tại

### Liên kết điều hướng đã đối chiếu với frontend

| Nội dung | Đích liên kết |
| --- | --- |
| Tra cứu sự kiện, hoạt động công khai | `/su-kien` |
| Gian hàng trên trang chủ | `/#gian-hang` |
| Bản đồ trên trang chủ | `/#ban-do` |
| Đăng nhập / tạo tài khoản | `/login` / `/register` |
| Sự kiện đã tham gia, rời sự kiện | `/participant/events` |
| Hoạt động đã đăng ký, hủy đăng ký, hướng dẫn điểm danh | `/participant/activities` |
| Chứng nhận | `/participant/certificates` |
| Đánh giá hoạt động | `/participant/feedback` |
| Thông báo | `/participant/notifications` |
| Hồ sơ, xác minh email | `/participant/profile` |

Các trang Participant yêu cầu đăng nhập; frontend giữ đích đến để quay lại sau đăng nhập.
Chatbot không dẫn trực tiếp tới `/participant/attendance/scan`: trang này cần token từ QR
của Ban tổ chức và hiển thị lỗi nếu mở liên kết không có token. Nguồn cho từng sự kiện/hoạt
động hiện dẫn về danh sách phù hợp, chưa tự mở chi tiết bản ghi.

### Giới hạn tìm kiếm và dữ liệu

- Tìm kiếm dữ liệu công khai đọc tối đa 300 Event và 300 Activity theo thứ tự bắt đầu. Với catalog lớn hơn cần truy vấn theo ngày và từ khóa ngay trong PostgreSQL.
- Bộ quy tắc chỉ hiểu các nhóm ngày tương đối đang hỗ trợ; ngày nhập tự do và câu hỏi mơ hồ phụ thuộc bước phân loại AI hoặc trả lời chưa tìm thấy.
- Nguồn dẫn tới trang danh sách hiện có; frontend chưa có link public riêng cho từng Activity.
- Bộ câu hỏi 82 ý định là tập kiểm thử ban đầu, không phải toàn bộ FAQ đã được biên tập và duyệt.
- Đã xác nhận key hiện tại liệt kê được model Gemini, nhưng yêu cầu generateContent tới `gemini-3.5-flash-lite` trả `402 RESOURCE_EXHAUSTED` tại thời điểm chuyển đổi. Cần kiểm tra quyền/hạn mức/thanh toán trong Google AI Studio trước khi kiểm thử câu trả lời thật.
