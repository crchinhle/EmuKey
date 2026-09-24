import { CustomerServiceOutlined } from '@ant-design/icons';
import { Button, FloatButton, Input, Popover, Spin, Tag } from 'antd';
import { useState } from 'react';

import { useKnowledgeSearch } from '../../application/assistance/knowledgeQueries';
import { useOptionalAuth } from '../../application/auth/authContext';

const assistantPanelId = 'emukey-ai-assistant-panel';

export function AiAssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const auth = useOptionalAuth();
  const search = useKnowledgeSearch(submittedQuestion);

  const ask = () => {
    if (!auth?.user || !question.trim()) return;
    setSubmittedQuestion(question.trim());
  };

  return (
    <Popover
      content={
        <section
          aria-label="Trợ lý AI Emukey"
          className="ai-assistant-panel"
          id={assistantPanelId}
        >
          <Tag color="purple">AI</Tag>
          <h2>Trợ lý AI Emukey</h2>
          {auth?.user ? <>
            <p>Hỏi về số thiết bị, thời hạn và quyền sử dụng phù hợp.</p>
            <Input.Search aria-label="Câu hỏi cho trợ lý AI" enterButton="Hỏi" loading={search.isFetching} onChange={(event) => setQuestion(event.target.value)} onSearch={ask} placeholder="Ví dụ: Gói nào cho 3 thiết bị?" value={question} />
            {search.isLoading ? <Spin aria-label="Đang tìm nguồn kiến thức" /> : null}
            {search.isError ? <p className="inline-message" role="alert">Không thể truy vấn kho tri thức lúc này.</p> : null}
            {search.data?.length ? <div className="ai-sources" role="status">{search.data.map((source) => <p key={source.id}>{source.content}</p>)}</div> : null}
          </> : <>
            <p>Đăng nhập để hỏi trợ lý theo nguồn tài liệu chính thức.</p>
            <Button href="/auth" type="primary">Đăng nhập</Button>
          </>}
        </section>
      }
      onOpenChange={setOpen}
      open={open}
      placement="topRight"
      trigger="click"
    >
      <FloatButton
        aria-controls={assistantPanelId}
        aria-expanded={open}
        className="ai-assistant-launcher"
        aria-label="Mở chat chăm sóc khách hàng"
        icon={<CustomerServiceOutlined />}
        tooltip={open ? undefined : 'Chat chăm sóc khách hàng'}
        type="primary"
      />
    </Popover>
  );
}
