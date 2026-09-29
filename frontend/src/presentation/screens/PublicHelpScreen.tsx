import { Button } from 'antd';
import { Link, useNavigate } from 'react-router-dom';

import { SiteHeader } from '../components/SiteHeader';
import { useOptionalAuth } from '../../application/auth/authContext';
import { roleHomePath } from '../../domain/workspace';

export function PublicHelpScreen() {
  const navigate = useNavigate();
  const auth = useOptionalAuth();

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="public-help-content">
        <section aria-labelledby="public-help-title" className="public-help-card">
          <h1 id="public-help-title">Hướng dẫn sử dụng EmuKey</h1>
          <p>Từ chọn phần mềm đến quản lý bản quyền, bạn có thể theo dõi từng bước trong tài khoản của mình.</p>
          <h2>1. Chọn sản phẩm và gói</h2>
          <p>Mở danh mục, xem giá, thời hạn và số thiết bị. Dùng tính năng so sánh để đối chiếu từ hai đến bốn gói trước khi quyết định.</p>
          <h2>2. Xác nhận đơn hàng và thanh toán</h2>
          <p>Đăng nhập, đọc điều khoản của đơn hàng và xác nhận trước khi đến cổng SePay. Sau thanh toán, quay về EmuKey để theo dõi kết quả. Nếu giao dịch chưa rõ kết quả, kiểm tra trạng thái đơn trước khi thanh toán lại.</p>
          <h2>3. Nhận mã và kích hoạt phần mềm</h2>
          <p>Khi bản quyền sẵn sàng, nhận mã bản quyền và lưu ở nơi an toàn: mã chỉ được hiển thị một lần. Nhập mã trong phần mềm trên thiết bị cần sử dụng. Không chia sẻ mã trong hội thoại hỗ trợ.</p>
          <h2>4. Quản lý và gia hạn</h2>
          <p>Vào Bản quyền &amp; thiết bị, chọn bản quyền rồi bấm Gia hạn. Kiểm tra giá, thời hạn và điều khoản trước khi thanh toán. Không cần nhập mã; mã bản quyền và thiết bị hiện tại được giữ nguyên. Nếu đã có đơn gia hạn đang chờ, hãy tiếp tục đơn đó.</p>
          <h2>5. Xác minh công khai</h2>
          <p>Dùng mã tra cứu công khai tại trang Xác minh để kiểm tra trạng thái trên blockchain. Đây không phải mã bản quyền dùng trong phần mềm và không dùng để đăng nhập.</p>
          <h2>Cần trợ giúp thêm?</h2>
          <p>Nếu mất mã, gặp lỗi thanh toán hoặc kích hoạt, hãy gửi yêu cầu hỗ trợ kèm mã đơn hàng hoặc mã tra cứu công khai. Không gửi mã bản quyền bí mật.</p>
          <Button type="primary" onClick={() => void navigate(auth?.user ? auth.user.role === 'CUSTOMER' ? '/buyer/support' : roleHomePath(auth.user.role) : '/auth?redirect=/buyer/support')}>
            {auth?.user ? 'Mở khu vực hỗ trợ' : 'Đăng nhập để được hỗ trợ'}
          </Button>
          <Link className="public-help-close" to="/products">Khám phá sản phẩm</Link>
        </section>
      </main>
    </div>
  );
}
