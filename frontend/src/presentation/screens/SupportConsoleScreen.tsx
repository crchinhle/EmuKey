import { Button } from 'antd';
import { Empty, Spin } from 'antd';
import { useState } from 'react';

import { useAppendSupportMessage, useClaimConversation, useSupportConversationMessages, useSupportQueue } from '../../application/assistance/supportQueries';
import { ConversationPanel } from '../components/ConversationPanel';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function SupportConsoleScreen() {
  const queue = useSupportQueue();
  const [selectedId, setSelectedId] = useState<string>();
  const [claimedId, setClaimedId] = useState<string>();
  const claim = useClaimConversation();
  const append = useAppendSupportMessage();
  const queueData = queue.data ?? [];
  const selected = queueData.find((item) => item.id === selectedId) ?? queueData[0];
  const messages = useSupportConversationMessages(selected?.id);
  if (queue.isLoading && queueData.length === 0) return <Spin />;
  if (!selected) return <Empty description="Hàng đợi trống" />;
  return (
    <>
      <PageHeader
        title="Support Console"
        description="Hàng đợi hội thoại và ngữ cảnh Customer tối thiểu theo thời gian thực."
        action={<StatusChip tone="realtime">Realtime · demo</StatusChip>}
      />
      <div className="console-grid support-console">
        <aside className="workspace-card queue-panel">
          <h2>Hàng đợi</h2>
          {queueData.map((conversation) => (
            <Button
              className={
                conversation.id === selected.id
                  ? 'queue-item queue-item--active'
                  : 'queue-item'
              }
              key={conversation.id}
              onClick={() => setSelectedId(conversation.id)}
            >
              <span>
                  <strong>{conversation.customerUserId.startsWith('Người mua') ? conversation.customerUserId : `Người mua #${conversation.customerUserId.slice(0, 4)}`}</strong>
                  <small>{conversation.title ?? conversation.id}</small>
              </span>
              <StatusChip tone="neutral">
                {conversation.status}
              </StatusChip>
            </Button>
          ))}
        </aside>
        <section className="workspace-card conversation-card" key={selected.id}>
          <header>
            <small>#{selected.id}</small>
            <h2>{selected.title ?? 'Hội thoại hỗ trợ'}</h2>
            <Button onClick={() => { setClaimedId(selected.id); claim.mutate(selected.id); }}>
              {selected.status === 'SUPPORT_ACTIVE' || claimedId === selected.id ? 'Đang xử lý bởi bạn' : 'Nhận xử lý'}
            </Button>
          </header>
          <ConversationPanel
            author="Support"
            initialMessages={(messages.data ?? []).map((message) => ({
              author: message.senderType === 'CUSTOMER' ? ('Buyer' as const) : message.senderType === 'AI' ? ('AI' as const) : ('Support' as const),
              body: message.content,
              id: message.id,
            }))}
            inputLabel="Phản hồi hỗ trợ"
            onSubmit={(content) => append.mutate({ clientMessageId: crypto.randomUUID(), content, conversationId: selected.id })}
            submitLabel="Gửi phản hồi"
          />
        </section>
        <aside className="workspace-card detail-card">
          <h2>Ngữ cảnh Customer</h2>
          <strong>{selected.customerUserId.startsWith('Người mua') ? selected.customerUserId : `Người mua #${selected.customerUserId.slice(0, 4)}`}</strong>
          <FactList
            facts={[
              { label: 'Context', value: selected.contextType },
              { label: 'Status', value: selected.status },
            ]}
          />
          <p className="security-note">
            Chỉ hiển thị dữ liệu cần thiết cho vai trò hỗ trợ.
          </p>
        </aside>
      </div>
    </>
  );
}
