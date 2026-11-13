import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, SupportEmail } from '@/components/legal-page';
import { GOOGLE_USER_DATA_POLICY_URL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Chính sách quyền riêng tư · Soi Đơn' };

// Mỗi câu ở đây phải đúng với code hiện tại (scope, dữ liệu lưu, cách xóa). Đổi hành vi → sửa trang này.
export default function Privacy() {
  return (
    <LegalPage title="Chính sách quyền riêng tư">
      <section>
        <p>
          Soi Đơn giúp bạn xem mình đã chi bao nhiêu trên Shopee, bằng cách đọc các email xác nhận
          đơn hàng Shopee trong Gmail của bạn. Trang này giải thích Soi Đơn đọc gì, lưu gì, dùng
          vào việc gì, và bạn kiểm soát dữ liệu của mình ra sao.
        </p>
      </section>

      <section>
        <h2>1. Dữ liệu Soi Đơn thu thập</h2>
        <p>
          <strong>Khi bạn đăng nhập bằng Google:</strong> địa chỉ email, tên hiển thị và mã định
          danh tài khoản Google. Bước này không cho Soi Đơn quyền đọc Gmail.
        </p>
        <p>
          <strong>Khi bạn kết nối Gmail:</strong> Soi Đơn xin quyền chỉ đọc (
          <code>gmail.readonly</code>) và dùng quyền này để:
        </p>
        <ul>
          <li>
            tìm các email gửi từ Shopee (tên miền shopee.vn, shopee.com) có tiêu đề về đơn hàng,
            trong khoảng thời gian bạn chọn quét;
          </li>
          <li>
            đọc nội dung những email đó để trích ra thông tin đơn hàng, rồi bỏ toàn văn email đi.
          </li>
        </ul>
        <p>Soi Đơn không đọc email từ người gửi khác, và không gửi, sửa hay xóa email nào.</p>
        <p>
          <strong>Những gì được lưu lại</strong> cho mỗi đơn hàng:
        </p>
        <ul>
          <li>mã đơn, ngày đặt, tên shop, trạng thái đơn;</li>
          <li>tên sản phẩm, phân loại, số lượng, đơn giá;</li>
          <li>tiền hàng, giảm giá, phí vận chuyển, số tiền thực trả, số tiền hoàn;</li>
          <li>
            mã định danh của email Gmail đã xử lý (để không xử lý lại), thời điểm nhận và loại
            email.
          </li>
        </ul>
        <p>
          Soi Đơn <strong>không lưu toàn văn email</strong>, tệp đính kèm, hay email nào không phải
          của Shopee.
        </p>
        <p>
          <strong>Dữ liệu bạn tự tạo:</strong> danh mục bạn gán cho sản phẩm và quy tắc phân loại
          được ghi nhớ từ đó.
        </p>
        <p>
          <strong>Dữ liệu kỹ thuật:</strong> mã thông báo truy cập Gmail (refresh token), được mã
          hóa bằng AES-256-GCM trước khi lưu; cookie phiên đăng nhập; nhật ký hoạt động ghi lại các
          thao tác như kết nối, ngắt kết nối, bắt đầu quét. Nhật ký không chứa nội dung email, tên
          sản phẩm hay số tiền.
        </p>
      </section>

      <section>
        <h2>2. Soi Đơn dùng dữ liệu vào việc gì</h2>
        <p>Chỉ để hiển thị cho chính bạn:</p>
        <ul>
          <li>danh sách đơn hàng Shopee của bạn;</li>
          <li>tổng chi tiêu, chi tiêu theo thời gian và theo danh mục;</li>
          <li>gợi ý danh mục cho sản phẩm dựa trên tên sản phẩm.</li>
        </ul>
        <p>
          Phân loại sản phẩm chạy bằng quy tắc từ khóa trên máy chủ của Soi Đơn. Tên sản phẩm và dữ
          liệu email không được gửi cho dịch vụ AI hay bên thứ ba nào để phân tích.
        </p>
      </section>

      <section>
        <h2>3. Cam kết với dữ liệu từ Google</h2>
        <p>
          Việc Soi Đơn sử dụng và chuyển giao thông tin nhận được từ Google API tuân thủ{' '}
          <a href={GOOGLE_USER_DATA_POLICY_URL} target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , bao gồm các yêu cầu về Limited Use. Cụ thể:
        </p>
        <ul>
          <li>
            Dữ liệu Gmail chỉ dùng để cung cấp và cải thiện tính năng xem chi tiêu mà bạn thấy
            trong Soi Đơn.
          </li>
          <li>Không bán dữ liệu Gmail, và không chuyển cho bên thứ ba.</li>
          <li>
            Không dùng dữ liệu Gmail cho quảng cáo, kể cả quảng cáo nhắm mục tiêu, cá nhân hóa hay
            tái nhắm mục tiêu.
          </li>
          <li>Không dùng để đánh giá tín dụng hay cho vay.</li>
          <li>
            Không có người nào đọc dữ liệu Gmail của bạn, trừ khi bạn đồng ý cho một trường hợp cụ
            thể (ví dụ khi bạn nhờ hỗ trợ một đơn bị đọc sai), khi cần cho mục đích bảo mật như
            điều tra lạm dụng, hoặc khi pháp luật yêu cầu.
          </li>
          <li>
            Không dùng dữ liệu Gmail để huấn luyện mô hình trí tuệ nhân tạo hay học máy dùng chung.
          </li>
        </ul>
        <p lang="en" className="text-sm text-stone-500">
          Soi Đơn&apos;s use and transfer of information received from Google APIs to any other app
          will adhere to{' '}
          <a href={GOOGLE_USER_DATA_POLICY_URL} target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </section>

      <section>
        <h2>4. Chia sẻ dữ liệu</h2>
        <p>
          Soi Đơn không bán và không chia sẻ dữ liệu cá nhân của bạn với ai. Dữ liệu chỉ rời khỏi
          hệ thống của Soi Đơn khi pháp luật buộc phải cung cấp cho cơ quan có thẩm quyền.
        </p>
        <p>
          Soi Đơn không phải là sản phẩm của Shopee hay Google và không gửi dữ liệu của bạn cho hai
          công ty này. Google chỉ biết bạn đã cấp quyền cho Soi Đơn, như với mọi ứng dụng dùng đăng
          nhập Google.
        </p>
      </section>

      <section>
        <h2>5. Bảo mật</h2>
        <ul>
          <li>Kết nối giữa trình duyệt và Soi Đơn được mã hóa bằng HTTPS.</li>
          <li>Refresh token Gmail được mã hóa AES-256-GCM trước khi ghi vào cơ sở dữ liệu.</li>
          <li>Mỗi truy vấn dữ liệu đều giới hạn theo tài khoản của bạn.</li>
          <li>Nhật ký hệ thống không ghi nội dung email, tên sản phẩm, số tiền hay token.</li>
        </ul>
        <p>
          Không hệ thống nào an toàn tuyệt đối. Nếu xảy ra sự cố ảnh hưởng tới dữ liệu của bạn, Soi
          Đơn sẽ thông báo cho bạn qua email.
        </p>
      </section>

      <section>
        <h2>6. Lưu giữ và xóa dữ liệu</h2>
        <ul>
          <li>
            Dữ liệu đơn hàng được giữ cho tới khi bạn yêu cầu xóa, để bạn xem lại lịch sử chi tiêu.
          </li>
          <li>
            <strong>Ngắt kết nối Gmail</strong> (trên trang{' '}
            <Link href="/onboarding">Kết nối Gmail</Link>): Soi Đơn thu hồi quyền với Google và xóa
            refresh token ngay. Đơn hàng đã đọc vẫn được giữ cho tới khi bạn yêu cầu xóa.
          </li>
          <li>
            Bạn cũng có thể thu hồi quyền bất cứ lúc nào tại{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
              trang quyền của tài khoản Google
            </a>
            .
          </li>
          <li>
            <strong>Xóa toàn bộ dữ liệu:</strong> gửi yêu cầu tới <SupportEmail /> từ địa chỉ email
            bạn dùng để đăng nhập. Soi Đơn sẽ thu hồi quyền Gmail và xóa tài khoản cùng mọi đơn hàng,
            sản phẩm, danh mục và quy tắc của bạn trong vòng 30 ngày, rồi báo lại cho bạn. Nhật ký
            hoạt động được giữ lại nhưng không còn liên kết với bạn.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Quyền của bạn</h2>
        <p>
          Theo pháp luật Việt Nam về bảo vệ dữ liệu cá nhân, bạn có quyền biết dữ liệu nào được thu
          thập, xem và chỉnh sửa dữ liệu, rút lại sự đồng ý và yêu cầu xóa dữ liệu. Bạn xem và sửa
          đơn hàng, danh mục ngay trong Soi Đơn; các yêu cầu khác gửi tới <SupportEmail />.
        </p>
      </section>

      <section>
        <h2>8. Trẻ em</h2>
        <p>Soi Đơn dành cho người từ 16 tuổi trở lên và không cố ý thu thập dữ liệu của trẻ em.</p>
      </section>

      <section>
        <h2>9. Thay đổi chính sách</h2>
        <p>
          Khi chính sách thay đổi, ngày cập nhật ở đầu trang sẽ đổi theo. Nếu thay đổi mở rộng
          cách Soi Đơn dùng dữ liệu Gmail, Soi Đơn sẽ báo cho bạn và xin lại sự đồng ý trước khi áp
          dụng.
        </p>
      </section>

      <section>
        <h2>10. Liên hệ</h2>
        <p>
          Câu hỏi về quyền riêng tư hoặc yêu cầu về dữ liệu: <SupportEmail />.
        </p>
      </section>
    </LegalPage>
  );
}
