import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, SupportEmail } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Điều khoản sử dụng · Soi Đơn' };

export default function Terms() {
  return (
    <LegalPage title="Điều khoản sử dụng">
      <section>
        <p>
          Khi dùng Soi Đơn, bạn đồng ý với các điều khoản dưới đây. Vui lòng đọc cùng{' '}
          <Link href="/privacy">Chính sách quyền riêng tư</Link>, nơi mô tả cách Soi Đơn xử lý dữ
          liệu của bạn.
        </p>
      </section>

      <section>
        <h2>1. Dịch vụ</h2>
        <p>
          Soi Đơn đọc email đơn hàng Shopee trong Gmail của bạn (khi bạn cho phép) và tổng hợp
          thành danh sách đơn hàng và báo cáo chi tiêu. Soi Đơn là dịch vụ độc lập, không thuộc,
          không được tài trợ hay xác nhận bởi Shopee hoặc Google.
        </p>
        <p>
          Soi Đơn đang trong giai đoạn thử nghiệm. Tính năng có thể thay đổi, tạm dừng hoặc ngừng
          cung cấp.
        </p>
      </section>

      <section>
        <h2>2. Tài khoản</h2>
        <ul>
          <li>Bạn cần từ 16 tuổi trở lên và đăng nhập bằng tài khoản Google của chính mình.</li>
          <li>
            Chỉ kết nối hộp thư Gmail mà bạn sở hữu hoặc có quyền hợp pháp để cho Soi Đơn đọc.
          </li>
          <li>
            Bạn chịu trách nhiệm giữ an toàn cho tài khoản Google và thiết bị đang đăng nhập Soi
            Đơn.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Độ chính xác của số liệu</h2>
        <p>
          Số liệu trong Soi Đơn được trích tự động từ email, nên có thể thiếu hoặc sai, ví dụ khi
          Shopee đổi mẫu email, khi một đơn không có email xác nhận, hoặc khi email bị xóa khỏi hộp
          thư. Danh mục sản phẩm là gợi ý tự động và có thể không đúng.
        </p>
        <p>
          Soi Đơn chỉ giúp bạn tham khảo chi tiêu cá nhân. Đây không phải chứng từ kế toán, hóa đơn
          hay lời khuyên tài chính. Khi cần số liệu chính xác, hãy đối chiếu với lịch sử đơn hàng
          trên Shopee.
        </p>
      </section>

      <section>
        <h2>4. Sử dụng hợp lệ</h2>
        <p>Bạn không được:</p>
        <ul>
          <li>dùng Soi Đơn để truy cập hộp thư hoặc dữ liệu của người khác khi không được phép;</li>
          <li>
            tìm cách truy cập trái phép hệ thống, dữ liệu của người dùng khác, hoặc vượt qua các
            biện pháp bảo mật;
          </li>
          <li>gửi lượng truy cập tự động bất thường làm ảnh hưởng tới dịch vụ;</li>
          <li>dùng Soi Đơn cho mục đích trái pháp luật Việt Nam.</li>
        </ul>
      </section>

      <section>
        <h2>5. Ngừng sử dụng</h2>
        <p>
          Bạn có thể ngắt kết nối Gmail bất cứ lúc nào và yêu cầu xóa toàn bộ dữ liệu theo hướng
          dẫn trong <Link href="/privacy">Chính sách quyền riêng tư</Link>. Soi Đơn có thể tạm khóa
          hoặc chấm dứt tài khoản vi phạm mục 4, và sẽ báo cho bạn qua email trừ khi pháp luật
          không cho phép.
        </p>
      </section>

      <section>
        <h2>6. Phí</h2>
        <p>
          Soi Đơn hiện miễn phí. Nếu sau này có tính năng trả phí, Soi Đơn sẽ thông báo rõ giá trước
          và chỉ thu phí khi bạn đồng ý.
        </p>
      </section>

      <section>
        <h2>7. Giới hạn trách nhiệm</h2>
        <p>
          Soi Đơn được cung cấp &quot;nguyên trạng&quot;. Trong phạm vi pháp luật cho phép, Soi Đơn
          không chịu trách nhiệm cho thiệt hại gián tiếp phát sinh từ việc dựa vào số liệu trong
          ứng dụng, hoặc từ việc dịch vụ bị gián đoạn. Điều này không giới hạn các quyền của bạn
          mà pháp luật bảo vệ người tiêu dùng không cho phép loại trừ.
        </p>
      </section>

      <section>
        <h2>8. Thay đổi điều khoản</h2>
        <p>
          Khi điều khoản thay đổi, ngày cập nhật ở đầu trang sẽ đổi theo. Với thay đổi quan trọng,
          Soi Đơn sẽ báo cho bạn trước khi áp dụng. Tiếp tục dùng Soi Đơn sau đó nghĩa là bạn đồng ý
          với điều khoản mới.
        </p>
      </section>

      <section>
        <h2>9. Luật áp dụng</h2>
        <p>Điều khoản này được điều chỉnh bởi pháp luật Việt Nam.</p>
      </section>

      <section>
        <h2>10. Liên hệ</h2>
        <p>
          Câu hỏi về điều khoản: <SupportEmail />.
        </p>
      </section>
    </LegalPage>
  );
}
