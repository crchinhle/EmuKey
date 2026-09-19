import { Button, Empty, Spin } from 'antd';
import { useState } from 'react';

import { useAppendConversationMessage, useAskAi, useConversationMessages, useConversations, useCreateConversation } from '../../application/assistance/assistanceQueries';
import { ConversationPanel } from '../components/ConversationPanel';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function BuyerAssistanceScreen() {
  const conversations = useConversations();
  const [selectedId, setSelectedId] = useState<string>();
  const append = useAppendConversationMessage();
  const askAi = useAskAi();
  const create = useCreateConversation();
  const conversation = conversations.data?.find((item) => item.id === selectedId) ?? conversations.data?.[0];
  const messages = useConversationMessages(conversation?.id);
  if (conversations.isLoading) return <Spin />;
  if (!conversation) {
    return (
      <>
        <PageHeader title="Trung tâm hỗ trợ" description="Trao đổi với đội ngũ hỗ trợ về đơn hàng và kích hoạt." />
        <Empty description="Bạn chưa có hội thoại hỗ trợ." image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button loading={create.isPending} onClick={() => create.mutate({ contextType: 'GENERAL', title: 'Hội thoại hỗ trợ' })} type="primary">
            Bắt đầu hội thoại
          </Button>
        </Empty>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Trung tâm hỗ trợ"
        description="Trao đổi với đội ngũ hỗ trợ về đơn hàng và kích hoạt."
        action={<StatusChip tone="error">{conversation.status}</StatusChip>}
      />
      <div className="support-thread-tabs" aria-label="Hội thoại hỗ trợ">
        {(conversations.data ?? [conversation]).map((item) => (
          <Button
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            type={item.id === conversation.id ? 'primary' : 'default'}
          >
            {item.title ?? item.id}
          </Button>
        ))}
      </div>
      <div className="support-layout" key={conversation.id}>
        <section className="workspace-card conversation-card">
          <header>
            <small>#{conversation.id}</small>
            <h2>{conversation.title ?? 'Hội thoại hỗ trợ'}</h2>
          </header>
          <ConversationPanel
            author="Buyer"
            initialMessages={(messages.data ?? []).map((message) => ({
              body: message.content,
              id: message.id,
              author: message.senderType === 'CUSTOMER' ? ('Buyer' as const) : message.senderType === 'AI' ? ('AI' as const) : ('Support' as const),
            }))}
            inputLabel="Tin nhắn hỗ trợ"
            onSubmit={(content) => append.mutate({ clientMessageId: crypto.randomUUID(), content, conversationId: conversation.id })}
            onAskAi={(question) => askAi.mutate({ conversationId: conversation.id, question })}
            submitLabel="Gửi tin nhắn"
            suggestion="Gợi ý demo: Vui lòng kiểm tra quota và mã tham chiếu thiết bị trước khi kích hoạt lại."
          />
        </section>
        <aside className="workspace-card detail-card">
          <h2>Thông tin liên quan</h2>
          <FactList
            facts={[
               { label: 'Context', value: conversation.contextType },
               { label: 'Status', value: conversation.status },
            ]}
          />
        </aside>
      </div>
    </>
  );
}
