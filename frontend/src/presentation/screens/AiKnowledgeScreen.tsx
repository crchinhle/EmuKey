import { Alert, Button, Empty, Input, Select, Spin, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useState } from 'react';

import { useAdminProducts } from '../../application/catalog/catalogQueries';
import { useCreateKnowledgeDocument, useKnowledgeDocuments, usePublishKnowledgeDocument } from '../../application/assistance/knowledgeQueries';
import { PageHeader } from '../components/WorkspacePrimitives';

export function AiKnowledgeScreen() {
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File>();
  const [productId, setProductId] = useState('');
  const [messageApi, contextHolder] = message.useMessage();
  const products = useAdminProducts();
  const documents = useKnowledgeDocuments();
  const create = useCreateKnowledgeDocument();
  const publish = usePublishKnowledgeDocument();
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    setFile(file);
    return false;
  };
  const visibleDocuments = (documents.data ?? []).filter((document) => `${document.title} ${document.logicalDocumentKey}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
  const upload = () => {
    if (!file || !productId) return;
    const title = file.name.replace(/\.[^.]+$/, '');
    create.mutate({ file, productId, logicalDocumentKey: title.replace(/[^A-Za-z0-9/_-]/g, '-'), sourceType: file.name.toLocaleLowerCase('vi').endsWith('.pdf') ? 'PDF' : 'TXT', title }, {
      onSuccess: () => { setFile(undefined); void messageApi.success('Đã tải tài liệu lên.'); },
    });
  };
  return (
    <>
      {contextHolder}
      <PageHeader
        title="Kho tri thức AI"
      />
      <section className="workspace-card knowledge-upload">
        <div>
          <h2>Tải tài liệu</h2>
          <p>Chấp nhận PDF hoặc TXT tối đa 10 MB trong bản giao diện.</p>
        </div>
        <div className="file-picker">
          <Select aria-label="Sản phẩm của tài liệu" onChange={setProductId} options={(products.data ?? []).filter((product) => product.status !== 'ARCHIVED').map((product) => ({ label: product.name, value: product.id }))} placeholder="Chọn sản phẩm" {...(productId ? { value: productId } : {})} />
          <label htmlFor="knowledge-upload">Chọn tài liệu kiến thức</label>
          <Upload
            accept=".pdf,.txt"
            beforeUpload={beforeUpload}
            id="knowledge-upload"
            showUploadList={false}
          >
            <Button>Chọn tệp</Button>
          </Upload>
          <Button disabled={!file || !productId} loading={create.isPending} onClick={upload} type="primary">Tải lên</Button>
          {file ? <span>Đã chọn tài liệu</span> : null}
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
        {documents.isLoading ? <Spin aria-label="Đang tải tài liệu kiến thức" /> : null}
        {documents.isError ? <Alert showIcon type="error" message="Không thể tải tài liệu kiến thức." /> : null}
        {!documents.isLoading && !documents.isError && visibleDocuments.length === 0 ? <Empty description="Chưa có tài liệu kiến thức phù hợp." /> : null}
        {visibleDocuments.map((document) => (
          <div className="data-row" key={document.id}>
            <span><strong>{document.title}</strong><small>{document.logicalDocumentKey} · v{document.version}</small></span>
            <span className="table-actions"><span className="status-chip status-chip--neutral">{document.status}</span>{document.status !== 'PUBLISHED' ? <Button loading={publish.isPending} onClick={() => publish.mutate(document.id)}>Công bố</Button> : null}</span>
          </div>
        ))}
      </section>
    </>
  );
}
