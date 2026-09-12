import { Alert, Button, Input, Spin } from 'antd';
import { useState } from 'react';

import { usePublicLicenseVerification } from '../../application/licenses/licenseQueries';
import { PublicHeader } from '../components/PublicHeader';
import { FactList, StatusChip } from '../components/WorkspacePrimitives';

export function PublicVerificationScreen() {
  const [code, setCode] = useState('EMU-TEST-LICENSE');
  const verification = usePublicLicenseVerification();
  const result = verification.data;
  const found = result && result.state !== 'NOT_FOUND';

  return (
    <div className="page-shell">
      <PublicHeader />
      <main className="verification-content">
        <section className="verification-query" aria-labelledby="verify-title">
          <h1 id="verify-title">Xác minh Blockchain</h1>
          <p>
            Nhập mã License công khai để kiểm tra trạng thái và finality, không
            hiển thị dữ liệu người mua.
          </p>
          <label>
            Mã xác thực
            <Input
              aria-label="Mã xác thực"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                verification.reset();
              }}
            />
          </label>
          <div className="workspace-actions">
            <Button
              onClick={() => {
                setCode('');
                verification.reset();
              }}
            >
              Xóa
            </Button>
            <Button
              disabled={!code.trim()}
              loading={verification.isPending}
              type="primary"
              onClick={() => verification.mutate(code.trim())}
            >
              Xác minh
            </Button>
          </div>
        </section>

        <section className="verification-result" aria-label="Kết quả xác minh">
          {verification.isPending ? <Spin /> : null}
          {!verification.isPending && !result && !verification.error ? (
            <div className="verification-placeholder" role="status">
              <StatusChip tone="info">Sẵn sàng</StatusChip>
              <h2>Kết quả xác minh sẽ hiển thị tại đây</h2>
            </div>
          ) : null}
          {verification.error ? (
            <Alert
              showIcon
              message="Không thể xác minh lúc này."
              role="alert"
              type="error"
            />
          ) : null}
          {found ? (
            <>
              <Alert
                showIcon
                message="Đã tìm thấy License"
                type={
                  result.state === 'CHAIN_CONFIRMED' ? 'success' : 'warning'
                }
              />
              <article className="workspace-card verification-summary">
                <header>
                  <h2>{result.licenseId}</h2>
                  <StatusChip
                    tone={
                      result.state === 'CHAIN_CONFIRMED' ? 'success' : 'warning'
                    }
                  >
                    {result.state}
                  </StatusChip>
                </header>
                <FactList
                  facts={[
                    { label: 'Sản phẩm', value: result.productName ?? '—' },
                    {
                      label: 'Nhà cung cấp',
                      value:
                        result.provider?.organizationName ??
                        result.provider?.displayName ??
                        '—',
                    },
                    {
                      label: 'Hết hạn',
                      value: result.expiresAt
                        ? new Date(result.expiresAt).toLocaleDateString('vi-VN')
                        : '—',
                    },
                    {
                      label: 'Plan commitment',
                      value: result.plan?.commitment ?? '—',
                    },
                    {
                      label: 'Block',
                      value:
                        result.blockNumber == null
                          ? 'Chưa finality'
                          : String(result.blockNumber),
                    },
                  ]}
                />
              </article>
            </>
          ) : null}
          {result?.state === 'NOT_FOUND' ? (
            <Alert
              showIcon
              message="Không tìm thấy License phù hợp với mã xác thực."
              role="alert"
              type="error"
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
