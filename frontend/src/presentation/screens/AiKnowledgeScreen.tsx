import { Button, Input, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { useMemo, useState } from 'react';

import { knowledgeDocuments } from '../../infrastructure/workspace/mockWorkspace';
import { PageHeader, StatusChip } from '../components/WorkspacePrimitives';

export function AiKnowledgeScreen() {
  const [localFiles, setLocalFiles] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const visibleDocuments = useMemo(
    () =>
      knowledgeDocuments.filter((document) =>
        document.name
          .toLocaleLowerCase('vi')
          .includes(query.trim().toLocaleLowerCase('vi')),
      ),
    [query],
  );
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    setLocalFiles((current) => [...current, file.name]);
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
        {localFiles.map((name) => (
          <article key={name}>
            <div>
              <strong>{name}</strong>
              <small>Tệp cục bộ · chờ tải lên</small>
            </div>
            <StatusChip tone="warning">Bản nháp</StatusChip>
          </article>
        ))}
        {visibleDocuments.map((document) => (
          <article key={document.id}>
            <div>
              <strong>{document.name}</strong>
              <small>{document.meta}</small>
            </div>
            <StatusChip tone={document.tone}>{document.status}</StatusChip>
          </article>
        ))}
      </section>
    </>
  );
}
