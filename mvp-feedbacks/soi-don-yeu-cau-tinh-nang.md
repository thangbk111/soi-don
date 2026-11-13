# Yêu cầu bổ sung tính năng cho ứng dụng Soi Đơn

## 1. Mục tiêu và phạm vi

Ứng dụng hiện đã nhập dữ liệu đơn hàng Shopee từ Gmail, hiển thị danh sách đơn, bộ lọc thời gian và các số liệu tổng hợp.

Chỉ bổ sung hai nhóm tính năng:

1. Phân loại chi tiêu ở cấp sản phẩm.
2. Trang tổng quan phân tích chi tiêu, tách biệt với danh sách đơn hàng.

Mục tiêu là giúp người dùng trả lời:

- Tôi đang chi tiền cho những nhóm nào?
- Chi tiêu thay đổi như thế nào giữa các kỳ?
- Tôi có thể xem các đơn và sản phẩm cấu thành một khoản chi ở đâu?

Không nằm trong phạm vi lần này:

- Tính năng chất lượng dữ liệu và đối soát: không xây trạng thái độ tin cậy, danh sách vấn đề, trang cần kiểm tra, màn hình bằng chứng email hoặc lịch sử chỉnh sửa phục vụ đối soát.
- Thiết kế lại trạng thái thanh toán, giao hàng hoặc hoàn tiền hiện có.
- Thay đổi pipeline nhập Gmail hiện tại.
- Kết nối thêm sàn.
- Chat AI.
- Dự báo tồn kho, nhắc mua lại.
- Chức năng riêng cho mẹ và bé.
- Thay đổi toàn bộ kiến trúc hoặc framework hiện có.

## 2. Nguyên tắc chung

- Tận dụng codebase, database và luồng nhập Gmail hiện tại.
- Không ghi đè hoặc làm mất dữ liệu đơn hàng đang có.
- Giữ nguyên cách tính tổng tiền và cách xử lý trạng thái đơn hiện tại, trừ phần phân bổ phục vụ báo cáo danh mục được mô tả bên dưới.
- Không dùng dữ liệu giả trong tài khoản thật.
- Không biến giá trị chưa biết thành `0`.
- Logic tính tiền và tổng hợp nằm ở backend/database, không giao cho LLM tính.
- Kiểm tra quyền truy cập theo người dùng cho mọi API và thao tác dữ liệu.
- Các ví dụ câu chữ dưới đây là mẫu giao diện, không phải số liệu cần hardcode.

## 3. Tính năng A — Phân loại chi tiêu theo sản phẩm

### 3.1. Phân loại ở cấp dòng sản phẩm

Mỗi dòng sản phẩm trong đơn có danh mục riêng. Một đơn có thể chứa nhiều danh mục; không buộc toàn bộ đơn vào một danh mục duy nhất.

Cấu trúc danh mục ban đầu tối đa hai cấp, ví dụ:

```text
Mẹ và bé
├── Tã và vệ sinh
├── Sữa và ăn dặm
├── Quần áo
├── Đồ chơi
└── Đồ dùng khác

Thực phẩm
Thời trang
Làm đẹp
Gia dụng
Điện tử
Sức khỏe
Học tập
Khác
Chưa phân loại
```

Phải phân biệt:

- “Khác”: đã xem xét nhưng không thuộc danh mục có sẵn.
- “Chưa phân loại”: chưa xác định được.

### 3.2. Cơ chế gán danh mục

Thứ tự ưu tiên:

1. Danh mục người dùng đã chỉnh cho dòng sản phẩm.
2. Quy tắc ghi nhớ riêng của người dùng.
3. Quy tắc phân loại có sẵn.
4. AI đề xuất nếu đã có tích hợp.
5. Chưa phân loại nếu không đủ căn cứ.

Không bắt buộc phải tích hợp AI để hoàn thành phiên bản đầu tiên.

Lưu nguồn phân loại: thủ công, quy tắc hoặc AI.

Không dùng độ tự tin do AI tự trả về như bằng chứng duy nhất rằng danh mục đúng.

### 3.3. Giao diện chỉnh sửa danh mục

Người dùng có thể:

- Xem và sửa danh mục ngay tại dòng sản phẩm hoặc trong chi tiết đơn.
- Chọn nhiều sản phẩm và đổi danh mục hàng loạt.
- Lọc sản phẩm theo danh mục.
- Lọc các sản phẩm chưa phân loại.
- Chọn “Áp dụng cho sản phẩm này trong những lần nhập sau”.

Quy tắc ghi nhớ:

- Chỉ có hiệu lực với người dùng hiện tại.
- Ưu tiên khóa nhận diện sản phẩm/biến thể nếu có.
- Nếu chỉ có tên, dùng tên chuẩn hóa và tránh áp dụng quá rộng.
- Cho phép xem và xóa quy tắc đã ghi nhớ trong phần cài đặt.
- Không ghi đè phân loại thủ công khi nhập lại.
- Xóa quy tắc không tự động thay đổi danh mục đã lưu của sản phẩm cũ.

### 3.4. Phân bổ giảm giá để thống kê danh mục

Mục đích: tính giá trị chi tiêu theo sản phẩm và danh mục, không xây thêm hệ thống đối soát.

Tận dụng các trường tiền hiện có. Nếu cần, bổ sung trường dẫn xuất phục vụ báo cáo nhưng không sửa giá trị gốc đã nhập.

Cần phân biệt khi dữ liệu nguồn có cung cấp:

- Tiền hàng theo sản phẩm.
- Giảm giá cấp sản phẩm.
- Giảm giá cấp đơn.
- Phí vận chuyển.
- Khoản điều chỉnh khác.
- Hoàn tiền.

Quy tắc:

1. Giảm giá gắn trực tiếp với sản phẩm được áp dụng cho sản phẩm đó.
2. Giảm giá chung cấp đơn được phân bổ theo tỷ trọng tiền hàng sau giảm giá cấp sản phẩm.
3. Không trừ giảm giá hai lần. Kiểm tra ý nghĩa các trường hiện tại trước khi triển khai.
4. Phần chênh làm tròn phải được xử lý theo quy tắc cố định để tổng phân bổ khớp số tiền cần phân bổ.
5. Nếu thiếu giá trị sản phẩm, không tự giả định chia đều. Đưa phần giá trị đã biết nhưng chưa phân bổ được vào “Chưa phân bổ”.
6. Nếu không biết cả giá trị cần phân bổ, không tạo số tiền giả; hiển thị số dòng không có giá trị tiền trong ghi chú báo cáo.

Trong báo cáo danh mục:

- Dùng giá trị hàng hóa sau giảm giá.
- Hiển thị phí vận chuyển riêng.
- Nếu dữ liệu hoàn tiền hiện có xác định rõ sản phẩm, trừ vào sản phẩm đó.
- Nếu chỉ có hoàn tiền cấp đơn, hiển thị khoản điều chỉnh riêng, không âm thầm gán vào danh mục.
- Không bổ sung luồng xác nhận hoặc đối soát hoàn tiền trong phạm vi này.

Tổng danh mục cộng phí và các khoản điều chỉnh phải khớp chỉ số tổng tương ứng theo quy tắc hiện có.

### 3.5. Tiêu chí nghiệm thu

- Một đơn có hai danh mục được chia đúng vào hai nhóm.
- Người dùng có thể sửa đơn lẻ và hàng loạt.
- Sửa danh mục làm báo cáo cập nhật tương ứng.
- Đồng bộ lại không làm mất danh mục người dùng đã sửa.
- Quy tắc ghi nhớ được áp dụng khi nhập sản phẩm mới phù hợp.
- Tổng phân bổ không lệch vì làm tròn.
- Khoản chưa thể phân bổ luôn hiển thị rõ, không bị bỏ qua.
- Các quy tắc của người dùng A không ảnh hưởng người dùng B.

## 4. Tính năng B — Trang tổng quan phân tích

### 4.1. Điều hướng

Bổ sung trang “Tổng quan”, giữ lại trang Đơn hàng và khu vực kết nối hiện có:

```text
Tổng quan | Đơn hàng | Kết nối Gmail
```

Không thêm trang hoặc mục điều hướng “Cần kiểm tra”.

Trang Đơn hàng tiếp tục phục vụ tra cứu chi tiết và chỉnh danh mục.

### 4.2. Bộ lọc thời gian

Trang tổng quan có:

- Tháng này.
- Tháng trước.
- Ba tháng gần nhất.
- Mười hai tháng gần nhất.
- Khoảng ngày tùy chọn.

Yêu cầu:

- Hiển thị rõ khoảng ngày báo cáo.
- Dùng ngày đặt đơn để lọc, thống nhất với trang Đơn hàng hiện tại.
- Dùng cùng múi giờ và quy ước ngày giữa frontend và backend.
- Bộ lọc báo cáo không được âm thầm thay đổi phạm vi quét Gmail.
- Có thể giữ thông tin lần đồng bộ cuối nếu hệ thống hiện đã có; không xây hệ thống đánh giá độ đầy đủ dữ liệu mới.

### 4.3. Các thẻ chỉ số

Hàng chính:

1. Tổng thực trả — dùng cùng định nghĩa và công thức hiện có trên trang Đơn hàng.
2. Số đơn — dùng cùng điều kiện lọc hiện có.
3. Giá trị trung bình mỗi đơn — tổng thực trả chia số đơn được tính tương ứng.
4. Thay đổi so với kỳ trước — hiển thị chênh lệch tiền và tỷ lệ khi có thể tính.

Hàng phụ hoặc phần mở rộng:

- Tiền hàng.
- Giảm giá ghi nhận.
- Phí vận chuyển.

Yêu cầu:

- Không thiết kế thêm chỉ số “Chi tiêu đã xác nhận”, “Giá trị chưa xác nhận” hoặc “Đơn cần kiểm tra”.
- Nếu số đơn bằng 0, giá trị trung bình hiển thị “Không có dữ liệu”, không chia cho 0.
- Các thẻ tổng hợp đơn có thể bấm để mở danh sách đơn tương ứng, giữ nguyên khoảng thời gian.
- Có tooltip ngắn giải thích công thức và cách lọc.
- Không lấy “giảm giá nhiều” làm kết luận rằng người dùng đã tiết kiệm tốt.

### 4.4. Biểu đồ chi tiêu theo thời gian

- Hiển thị theo ngày hoặc tháng tùy khoảng thời gian.
- Dùng cùng định nghĩa tổng tiền với thẻ tổng thực trả.
- Tooltip có kỳ, số tiền và số đơn.
- Bấm một điểm/cột để xem đơn của kỳ đó.
- Ghi rõ báo cáo dựa trên dữ liệu đã nhập; không khẳng định đã phản ánh toàn bộ chi tiêu thực tế.
- Không dựng số liệu giả để lấp khoảng trống.

### 4.5. Phân tích theo danh mục

Ưu tiên biểu đồ thanh ngang, sắp xếp giảm dần.

Mỗi danh mục hiển thị:

- Giá trị hàng hóa sau giảm giá và các hoàn tiền cấp sản phẩm đã có.
- Tỷ trọng trong tổng giá trị hàng hóa được phân bổ.
- Số dòng sản phẩm; ghi rõ đây không phải tổng số lượng đơn vị sản phẩm.

Yêu cầu:

- Có “Chưa phân loại” nếu có sản phẩm chưa có danh mục.
- Có “Chưa phân bổ” nếu có giá trị chưa thể chia vào sản phẩm.
- Hai khái niệm này phải được phân biệt rõ trong tooltip.
- Phí ship và các khoản điều chỉnh cấp đơn hiển thị riêng.
- Nêu rõ cơ sở tính tỷ trọng; không làm người dùng hiểu nhầm biểu đồ danh mục là toàn bộ tiền thực trả.
- Bấm danh mục mở danh sách đơn có sản phẩm thuộc danh mục đó và làm nổi bật các dòng phù hợp.
- Nếu danh sách hiển thị tổng tiền toàn đơn, phải phân biệt với số tiền thuộc danh mục đang lọc.

### 4.6. So sánh kỳ trước

- Với kỳ tháng/quý/năm đầy đủ: so với kỳ liền trước tương ứng.
- Với khoảng ngày tùy chọn: so với khoảng liền trước có cùng số ngày.
- Với kỳ hiện tại chưa kết thúc: so cùng số ngày đã trôi qua; nếu kỳ trước ngắn hơn, giới hạn theo số ngày thực tế và hiển thị rõ hai khoảng ngày.

Hiển thị cả chênh lệch tiền và phần trăm.

Trường hợp đặc biệt:

- Kỳ trước bằng `0`: không chia cho 0; hiển thị “Không có giá trị kỳ trước để tính tỷ lệ”.
- Nếu hệ thống hiện có thông tin cho biết kỳ chưa được nhập, hiển thị “Chưa đủ dữ liệu để so sánh”. Không xây thêm cơ chế kiểm tra độ đầy đủ trong phạm vi này.
- Nếu không biết độ đầy đủ, ghi rõ so sánh dựa trên dữ liệu đã nhập.
- Không mô tả một biến động là tăng chi tiêu thực tế chắc chắn khi dữ liệu không đủ căn cứ.

### 4.7. Bố cục đề xuất

```text
Tiêu đề Tổng quan                         Bộ lọc thời gian

[Tổng thực trả] [Số đơn] [Trung bình/đơn] [So với kỳ trước]

Chi tiêu theo thời gian       Chi tiêu theo danh mục

Tiền hàng · Giảm giá · Phí vận chuyển · Khoản điều chỉnh

Liên kết “Xem tất cả đơn hàng”
```

Không thêm khu vực vấn đề dữ liệu, cảnh báo đối soát hoặc danh sách cần kiểm tra.

### 4.8. Trạng thái giao diện

- Đang tải: hiển thị skeleton/loading state.
- Chưa có dữ liệu: giải thích và có nút tới màn hình quét Gmail hiện có.
- Bộ lọc không có kết quả: hiển thị thông báo và nút đặt lại bộ lọc.
- Lỗi API: hiển thị thông báo và nút thử lại.
- Chưa phân loại: hiển thị đúng nhóm “Chưa phân loại”, không ẩn sản phẩm.

### 4.9. Tiêu chí nghiệm thu

- Tổng trên dashboard khớp trang Đơn hàng khi dùng cùng bộ lọc và công thức.
- Bấm thẻ hoặc biểu đồ mở đúng danh sách chi tiết.
- Tổng theo danh mục, phí và các khoản điều chỉnh khớp tổng tương ứng.
- Sửa danh mục làm biểu đồ cập nhật.
- Không có dữ liệu thì hiển thị trạng thái trống, không dựng biểu đồ giả.
- Không chia cho 0 khi tính trung bình hoặc tỷ lệ.
- Dùng được trên desktop và mobile.
- Mọi số tiền được định dạng VND nhất quán.

## 5. Yêu cầu dữ liệu và triển khai

Không bắt buộc dùng đúng tên bảng dưới đây; ưu tiên mở rộng cấu trúc hiện có:

| Nhóm dữ liệu | Nội dung cần lưu |
|---|---|
| Danh mục | Tên, danh mục cha, thứ tự hiển thị |
| Dòng sản phẩm | Danh mục, nguồn phân loại, giá trị được phân bổ |
| Quy tắc danh mục | Quy tắc ghi nhớ riêng theo người dùng |

Yêu cầu bổ sung:

- Không thêm bảng vấn đề dữ liệu, bằng chứng email hoặc lịch sử đối soát cho lần triển khai này.
- Migration không phá dữ liệu cũ.
- Có thể phân loại lại dữ liệu cũ bằng quy tắc mới, nhưng chỉ với dòng chưa được người dùng chỉnh thủ công.
- Có bước tính lại giá trị phân bổ khi cần, không ghi đè trường tiền gốc.
- API tổng hợp và trang Đơn hàng dùng chung quy tắc lọc.
- Không đưa token Gmail, khóa dịch vụ hoặc toàn văn email vào log frontend.
- Kiểm tra phân quyền cho dữ liệu danh mục riêng, quy tắc cá nhân và báo cáo của từng người dùng.

## 6. Thứ tự thực hiện và bàn giao

### Giai đoạn 1 — Phân loại sản phẩm

- Thêm danh mục và quan hệ với dòng sản phẩm.
- Hiển thị và sửa danh mục đơn lẻ, hàng loạt.
- Quy tắc ghi nhớ riêng theo người dùng.
- Lọc theo danh mục và chưa phân loại.
- Phân bổ giảm giá và xử lý làm tròn.
- Test việc nhập lại không ghi đè chỉnh sửa thủ công.

### Giai đoạn 2 — Trang tổng quan

- Thêm điều hướng Tổng quan.
- Bộ lọc thời gian.
- Các thẻ chỉ số.
- Biểu đồ thời gian và danh mục.
- So sánh kỳ trước.
- Điều hướng về đơn chi tiết.
- Trạng thái tải, trống và lỗi; responsive mobile.

Trước khi viết code, hãy kiểm tra cấu trúc dự án hiện tại và trình bày:

1. Những phần có thể tái sử dụng.
2. Thay đổi database cần thiết.
3. Ý nghĩa các trường tiền hiện tại và cách tránh trừ giảm giá hai lần.
4. Kế hoạch triển khai theo từng phần nhỏ.

Mỗi giai đoạn cần có test và báo cáo phần đã hoàn thành. Không triển khai đồng thời toàn bộ bằng một thay đổi lớn.

## 7. Checklist kiểm thử tối thiểu

- [ ] Một đơn có sản phẩm thuộc nhiều danh mục.
- [ ] Sửa danh mục một dòng và nhiều dòng.
- [ ] Quy tắc ghi nhớ chỉ áp dụng trong tài khoản tương ứng.
- [ ] Nhập lại email không làm mất danh mục đã sửa.
- [ ] Giảm giá cấp sản phẩm và cấp đơn không bị trừ hai lần.
- [ ] Phân bổ có làm tròn vẫn giữ đúng tổng.
- [ ] Thiếu giá sản phẩm không bị tự chia đều hoặc coi là 0.
- [ ] Phí ship và điều chỉnh cấp đơn được hiển thị riêng.
- [ ] Dashboard và danh sách đơn có cùng tổng khi cùng bộ lọc.
- [ ] Lọc danh mục không nhầm tổng toàn đơn với số tiền thuộc danh mục.
- [ ] So sánh kỳ trước xử lý kỳ bằng 0 và tháng có số ngày khác nhau.
- [ ] Không có màn hình hoặc tính năng chất lượng dữ liệu và đối soát mới.
