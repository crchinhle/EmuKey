import { Alert, Button, Input } from 'antd';
import { useState } from 'react';

import { findVerification } from '../../application/workspace/workspaceSelectors';
import { verificationRecords } from '../../infrastructure/workspace/mockWorkspace';
import { PublicHeader } from '../components/PublicHeader';
import { UploadZone } from '../components/UploadZone';
import { FactList, StatusChip } from '../components/WorkspacePrimitives';

export function PublicVerificationScreen() {
  const [code, setCode] = useState('KLTN-2026-8F3A91');
  const [selectedFile, setSelectedFile] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const result = submitted
    ? findVerification(verificationRecords, code)
    : undefined;

  function clearQuery() {
    setCode('');
    setSelectedFile(undefined);
    setSubmitted(false);
  }

  return (
    <div className="page-shell">
      <PublicHeader />
      <main className="verification-content">
        <section className="verification-query" aria-labelledby="verify-title">
          <h1 id="verify-title">Xác minh hợp đồng</h1>
          <p>
            Nhập mã xác thực hoặc chọn tài liệu PDF. Hệ thống chỉ hiển thị dữ
            liệu công khai an toàn.
          </p>
          <label>
            Mã xác thực
            <Input
              aria-label="Mã xác thực"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setSubmitted(false);
              }}
            />
          </label>
          <span className="or-label">Hoặc</span>
          <UploadZone
            accept=".pdf,application/pdf"
            buttonLabel="Chọn PDF"
            helper="PDF tối đa 10 MB · chỉ mô phỏng chọn tệp"
            label="Tải PDF hợp đồng"
            onSelect={setSelectedFile}
            selectedFile={selectedFile}
          />
          <div className="workspace-actions">
            <Button onClick={clearQuery}>Xóa</Button>
            <Button
              disabled={!code.trim()}
              type="primary"
              onClick={() => setSubmitted(true)}
            >
              Xác minh
            </Button>
          </div>
        </section>

        <section className="verification-result" aria-label="Kết quả xác minh">
          {!submitted ? (
            <div className="verification-placeholder" role="status">
              <StatusChip tone="info">Sẵn sàng</StatusChip>
              <h2>Kết quả xác minh sẽ hiển thị tại đây</h2>
              <p>Không công khai danh tính hoặc dữ liệu cá nhân của bên mua.</p>
            </div>
          ) : result ? (
            <>
              <Alert
                showIcon
                description="Chữ ký và bằng chứng Blockchain trong bản ghi mẫu đã khớp."
                message="Hợp đồng hợp lệ"
                type="success"
              />
              <article className="workspace-card verification-summary">
                <header>
                  <h2>{result.contractId}</h2>
                  <StatusChip tone="success">Đã ký</StatusChip>
                </header>
                <FactList
                  facts={[
                    { label: 'Sản phẩm', value: result.product },
                    { label: 'Nhà cung cấp', value: result.provider },
                    { label: 'Thời hạn', value: result.validity },
                    { label: 'Số thiết bị', value: result.devices },
                  ]}
                />
              </article>
              <article className="workspace-card blockchain-evidence">
                <h2>Bằng chứng Blockchain</h2>
                <FactList
                  facts={[
                    { label: 'Đã tạo bản ghi', value: result.createdAt },
                    {
                      label: 'Đã xác nhận',
                      value: `Block ${result.blockNumber}`,
                    },
                    { label: 'Hash tài liệu', value: result.documentHash },
                  ]}
                />
              </article>
            </>
          ) : (
            <Alert
              showIcon
              message="Không tìm thấy hợp đồng phù hợp với mã xác thực."
              role="alert"
              type="error"
            />
          )}
        </section>
      </main>
    </div>
  );
}
