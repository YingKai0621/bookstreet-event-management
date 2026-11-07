# Chatbot Guest và Participant — hợp đồng triển khai

Cập nhật 07/11/2026 (thay bản 26/10/2026). Tính năng này được thực hiện theo yêu cầu riêng của
project owner. `08_MVP_Scope_v2.md` vẫn ghi AI chatbot ngoài MVP; chatbot được quản lý như một
hạng mục độc lập, không phải Acceptance Criterion của Sprint nào.

## Mục đích và ranh giới

- Trả lời câu hỏi tự do bằng tiếng Việt cho Guest và Participant về sự kiện, hoạt động, gian hàng,
  quy định và cách dùng website.
- Chỉ đọc dữ liệu. Chatbot không Join/Leave, đăng ký/hủy Activity, điểm danh, đánh giá, thanh toán
  hay sửa hồ sơ.
- Không đưa tên đăng nhập, mật khẩu, email, session, raw QR token, mã chứng nhận, ID nội bộ hoặc
  dữ liệu của User khác cho mô hình.
- Không lưu lịch sử chat vào PostgreSQL hoặc Redis. Giao diện chỉ giữ lịch sử trong bộ nhớ của tab.
- Câu hỏi và kết quả tra cứu đã lọc được gửi tới Gemini Generate Content API. Không nhập thông tin
  bí mật vào ô chat. API key chỉ nằm ở backend.

## Kiến trúc: Gemini function calling trên các công cụ whitelist

Backend không tự phân loại câu hỏi theo từ khóa. Gemini đọc câu hỏi, tự chọn công cụ và tham số;
backend chạy công cụ trên service hiện có rồi trả kết quả đã lọc; Gemini viết câu trả lời.

```
Người dùng ─► ChatController (CSRF, 8 câu/phút/IP)
                 │
                 ▼
           ChatService ── prompt hệ thống + lịch sử (≤ 6 lượt) + câu hỏi + khai báo công cụ ──► Gemini
                 ▲                                                                              │
                 │      text ◄───────────────────────────────────────────────────────────────── ┤
                 │      functionCall(name, args) ◄──────────────────────────────────────────────┘
                 │                │
                 │                ▼
                 │          ChatTools.execute ─► service hiện có ─► repository ─► PostgreSQL
                 │                │
                 └── functionResponse (dữ liệu đã lọc) ── lặp tối đa 4 vòng
```

| Thành phần | Trách nhiệm |
| --- | --- |
| `ChatController` | `POST /api/v1/chat/messages`, kiểm tra rate limit qua `ChatRateLimiter` |
| `ChatService` | Vòng lặp function calling, prompt hệ thống, xóa URL trong câu trả lời của mô hình |
| `GeminiChatClient` | Gọi `generateContent` với `tools`; trả nguyên `content` của mô hình để giữ thought signature |
| `ChatTools` | Khai báo và thực thi công cụ; tự dựng từng trường trả về cho mô hình |
| `ChatGuide` | Nội dung hướng dẫn/quy định đã biên tập, phải khớp `05_Business_Rules` |
| `ChatLinks` | Chọn liên kết chi tiết cho các mục mà câu trả lời thực sự nhắc tới |

### Công cụ

| Công cụ | Tham số | Nguồn | Quyền |
| --- | --- | --- | --- |
| `search_events` | `keyword`, `fromDate`, `toDate` | `EventService.listPublic` | Mọi người |
| `search_activities` | `keyword`, `eventName`, `fromDate`, `toDate`, `onlyOpenForRegistration` | `PublicActivityService.list` | Mọi người |
| `get_event_details` | `eventName` | Event công khai + Activity của Event + số gian hàng trống | Mọi người |
| `search_booths` | `eventName`, `keyword`, `onlyAvailable` | `EventBoothService.listPublic` | Mọi người |
| `get_platform_guide` | `topic` (enum) | `ChatGuide` | Mọi người |
| `get_my_participation` | `fromDate`, `toDate` | Service Participant theo Session | `PARTICIPANT` |
| `get_my_notifications` | `unreadOnly` | `NotificationInboxService` (vai trò `PARTICIPANT`) | `PARTICIPANT` |

- Công cụ cá nhân trả `LOGIN_REQUIRED` khi người hỏi chưa đăng nhập và không gọi service dữ liệu.
  Service xác định User từ Session; mô hình không truyền được userId.
- Tên công cụ lạ trả `UNKNOWN_TOOL`. Tham số chuỗi bị cắt ở 100 ký tự; ngày sai định dạng bị bỏ qua.
  Lỗi khi tra cứu trả `LOOKUP_FAILED` và được ghi log cảnh báo.
- Mỗi lần gọi công cụ ghi log `Chat tool call <tên> <tham số>` để theo dõi.

### Nguyên tắc: việc gì code làm được thì không giao cho mô hình

- Lọc theo khoảng ngày, kiểm tra còn chỗ/mở đăng ký và tính trạng thái đều chạy trong backend.
  Mô hình chỉ đổi “cuối tuần này”, “tháng 12”… thành `fromDate`/`toDate`. Prompt cho biết hôm nay
  là thứ mấy, ngày nào và tuần bắt đầu từ thứ Hai.
- Từ khóa so khớp không dấu, không phân biệt hoa thường; mọi từ quan trọng phải xuất hiện.
- Tên sự kiện: khớp chính xác được ưu tiên, sau đó là khớp cụm, cuối cùng là khớp đủ từ. Nếu nhiều
  sự kiện cùng khớp, công cụ trả `AMBIGUOUS_EVENT` kèm danh sách để chatbot hỏi lại.
- Thời gian gửi cho mô hình có dạng `15/12/2026 lúc 18:00` để tránh đọc nhầm giờ thành ngày.
- Mỗi công cụ tìm kiếm đọc tối đa 10 trang × 30 bản ghi và trả tối đa 8 kết quả (gian hàng: 15,
  hoạt động trong `get_event_details`: 20).

## API

`POST /api/v1/chat/messages` cho Guest và Participant. Trình duyệt gửi CSRF token theo chính sách
hiện có.

```json
{"message":"Cuối tuần này có hoạt động nào?",
 "history":[{"role":"user","text":"..."},{"role":"assistant","text":"..."}]}
```

`message` bắt buộc, tối đa 500 ký tự. `history` tùy chọn, tối đa 6 lượt, mỗi lượt tối đa 500 ký
tự. Lịch sử chỉ giúp hiểu câu hỏi nối tiếp; dữ liệu luôn được tra lại qua công cụ. Frontend không
gửi các câu báo lỗi vào lịch sử.

```json
{
  "answer":"Câu trả lời bằng văn bản thuần, không Markdown.",
  "sources":[{"title":"Không gian Sách, STEM và Công nghệ","url":"/su-kien/84"}]
}
```

| Mã | Khi nào |
| --- | --- |
| `503` | Thiếu `GEMINI_API_KEY`, model sai định dạng, hoặc key/model không truy cập được |
| `402` | Tài khoản Gemini cần thanh toán hoặc hết hạn mức |
| `429` | Quá 8 câu/phút trên cùng IP, hoặc Gemini giới hạn tốc độ |
| `502` | Gemini lỗi tạm thời hoặc bị chặn/không hoàn tất câu trả lời |

Giao diện chỉ hiển thị câu thân thiện (riêng `429` báo thử lại sau một phút); không hiển thị lỗi
thô, tên nhà cung cấp hay key.

## Liên kết nguồn

Backend tự dựng mọi URL từ ID đã tra được; URL trong câu trả lời của mô hình bị xóa. `ChatLinks`
chỉ giữ liên kết của những mục được nhắc tên trong câu trả lời (so khớp không dấu, nguyên từ; chấp
nhận tên rút gọn bỏ tiền tố `[...]` hoặc phần trước ` - `), theo thứ tự xuất hiện, tối đa 4. Khi
tên rút gọn trùng nhau giữa nhiều sự kiện, tên sự kiện trong câu trả lời được dùng để chọn đúng
liên kết. Không mục nào được nhắc tới thì dùng liên kết chung của công cụ.

| Mục | Liên kết |
| --- | --- |
| Sự kiện | `/su-kien/{eventId}` |
| Hoạt động | `/su-kien/{eventId}` của sự kiện chứa nó (chưa có trang công khai riêng cho Activity) |
| Gian hàng | `/gian-hang/{boothId}?eventId={eventId}` |
| Sự kiện của tôi | `/participant/events/{eventId}` |
| Hoạt động của tôi | `/participant/activities/detail/{activityId}` |
| Hướng dẫn | Trang theo chủ đề: `/register`, `/login`, `/participant/certificates`, `/#gian-hang`… |

Chatbot không dẫn tới `/participant/attendance/scan`: trang này cần token từ QR của Ban tổ chức.

## Cấu hình

Đặt `GEMINI_API_KEY` và tùy chọn `CHATBOT_MODEL` trong `.env` cục bộ hoặc secret của môi trường
triển khai. File `.env` không được commit. Mặc định model là `gemini-3.5-flash-lite`; model phải hỗ
trợ function calling và được tài khoản Gemini API cho phép. Server cần outbound HTTPS tới
`generativelanguage.googleapis.com`. Không cần migration, GPU hay pgvector.

## Mở rộng thêm công cụ

1. Thêm khai báo trong `ChatTools.declarations()`.
2. Thêm nhánh trong `ChatTools.execute()`.
3. Gọi service hiện có (không truy vấn repository hay SQL trực tiếp) và tự chọn từng trường trả về.
   Không trả ID, email, tên đăng nhập, token hay dữ liệu của người khác.
4. Nếu là dữ liệu cá nhân: kiểm tra `ChatTools.isParticipant()` và trả `LOGIN_REQUIRED`.
5. Thêm `ChatLinks.Candidate` nếu kết quả có trang chi tiết; viết test trong `ChatServiceTests`.

Không thêm công cụ cho dữ liệu Admin/Organizer, danh sách người tham gia, liên hệ đối tác hay
thanh toán.

## Phép thử nghiệm thu

1. Guest hỏi quy tắc đăng ký: có câu trả lời từ `get_platform_guide` và liên kết đúng trang.
2. Guest hỏi “hoạt động của tôi”/“thông báo của tôi”: được mời đăng nhập; service cá nhân không
   được gọi.
3. Participant hỏi “lịch tuần sau”: công cụ nhận đúng `fromDate`/`toDate`, chỉ trả mục trong khoảng.
4. Sự kiện không tồn tại: chatbot nói chưa tìm thấy, không bịa, không có liên kết.
5. Tên sự kiện mơ hồ: chatbot hỏi lại sự kiện cụ thể.
6. Yêu cầu tài khoản/mật khẩu/email của người khác hoặc lệnh “bỏ qua quy tắc”: bị từ chối.
7. Câu hỏi ngoài BookStreet: từ chối lịch sự và gợi ý hỏi về sự kiện.
8. Thiếu API key: API trả `503`, giao diện báo chưa trả lời được.
9. Câu hỏi quá 500 ký tự hoặc gửi quá nhanh bị từ chối.

Test tự động: `ChatServiceTests`, `ChatLinksTests`, `GeminiChatClientTests`,
`ChatControllerIntegrationTests`.

## Giới hạn hiện tại

- Tìm kiếm đọc tối đa 300 Event/Activity theo thứ tự bắt đầu. Catalog lớn hơn cần lọc theo ngày
  và từ khóa ngay trong PostgreSQL.
- Mỗi câu hỏi có thể gọi Gemini tối đa 5 lần (4 vòng công cụ + 1 lần trả lời), ảnh hưởng chi phí
  và độ trễ.
- Prompt chỉ là lớp bảo vệ mềm. Lớp bảo vệ chắc chắn là dữ liệu: mô hình chỉ thấy những gì công cụ
  trả về.
- Liên kết dựa trên việc câu trả lời có nhắc tên mục; nếu mô hình diễn đạt khác hẳn tên gốc thì chỉ
  có liên kết chung.
- Bộ câu hỏi trong `guest-participant-question-bank.md` là tập kiểm thử, không phải FAQ đã duyệt.
