import { Button } from 'antd';
import { useState } from 'react';

import { conversations } from '../../infrastructure/workspace/mockWorkspace';
import { ConversationPanel } from '../components/ConversationPanel';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function BuyerAssistanceScreen() {
  const [conversation, setConversation] = useState(conversations[0]!);
  return (
    <>
      <PageHeader
        title="Trung tâm hỗ trợ"
        description="Trao đổi với đội ngũ hỗ trợ về đơn hàng và kích hoạt."
        action={<StatusChip tone="error">{conversation.status}</StatusChip>}
      />
      <div className="support-thread-tabs" aria-label="Hội thoại hỗ trợ">
        {conversations.map((item) => (
          <Button
            key={item.id}
            onClick={() => setConversation(item)}
            type={item.id === conversation.id ? 'primary' : 'default'}
          >
            {item.subject}
          </Button>
        ))}
      </div>
      <div className="support-layout" key={conversation.id}>
        <section className="workspace-card conversation-card">
          <header>
            <small>#{conversation.id}</small>
            <h2>{conversation.subject}</h2>
          </header>
          <ConversationPanel
            author="Buyer"
            initialMessages={conversation.messages}
            inputLabel="Tin nhắn hỗ trợ"
            submitLabel="Gửi tin nhắn"
            suggestion="Gợi ý demo: Vui lòng kiểm tra quota và mã tham chiếu thiết bị trước khi kích hoạt lại."
          />
        </section>
        <aside className="workspace-card detail-card">
          <h2>Thông tin liên quan</h2>
          <FactList
            facts={[
              { label: 'Sản phẩm', value: conversation.product },
              { label: 'Đơn hàng', value: conversation.orderId },
              { label: 'Thanh toán', value: conversation.payment },
              {
                label: 'Quota',
                value: `${conversation.usedDevices} / ${conversation.totalDevices}`,
              },
            ]}
          />
        </aside>
      </div>
    </>
  );
}
