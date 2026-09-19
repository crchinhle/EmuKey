import { Button, Input, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { useState } from 'react';

import { PageHeader } from '../components/WorkspacePrimitives';

export function AiKnowledgeScreen() {
  const [query, setQuery] = useState('');
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    void file;
    return false;
  };
  return (
    <>
      <PageHeader
        title="AI Knowledge"
        description="Quản lý nguồn tài liệu dùng cho trợ lý hỗ trợ sản phẩm."
      />
      <section className="workspace-card knowledge-upload">
        <div>
          <h2>Tải tài liệu</h2>
          <p>Chấp nhận PDF hoặc TXT tối đa 10 MB trong bản giao diện.</p>
        </div>
        <div className="file-picker">
          <label htmlFor="knowledge-upload">Chọn tài liệu kiến thức</label>
          <Upload
            accept=".pdf,.txt"
            beforeUpload={beforeUpload}
            id="knowledge-upload"
            showUploadList={false}
          >
            <Button>Chọn tệp</Button>
          </Upload>
        </div>
      </section>
      <section className="workspace-card document-list">
        <div className="card-heading">
          <h2>Tài liệu đã nạp</h2>
          <Input.Search
            aria-label="Tìm tài liệu"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tài liệu"
            value={query}
          />
        </div>
        <p className="muted-copy">Knowledge API upload chưa được nối vào màn hình này. Không hiển thị dữ liệu tài liệu giả.</p>
      </section>
    </>
  );
}
