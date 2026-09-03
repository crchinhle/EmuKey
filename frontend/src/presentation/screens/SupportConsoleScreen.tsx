import { Button } from 'antd';
import { useState } from 'react';

import type { ConversationRecord } from '../../domain/workspace';
import { conversations } from '../../infrastructure/workspace/mockWorkspace';
import { ConversationPanel } from '../components/ConversationPanel';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function SupportConsoleScreen() {
  const [selected, setSelected] = useState<ConversationRecord>(
    conversations[0]!,
  );
  const [claimed, setClaimed] = useState<string>();
  return (
    <>
      <PageHeader
        title="Support Console"
        description="Hàng đợi hội thoại và ngữ cảnh khách hàng theo thời gian thực."
        action={<StatusChip tone="realtime">Realtime · demo</StatusChip>}
      />
      <div className="console-grid support-console">
        <aside className="workspace-card queue-panel">
          <h2>Hàng đợi</h2>
          {conversations.map((conversation) => (
            <Button
              className={
                conversation.id === selected.id
                  ? 'queue-item queue-item--active'
                  : 'queue-item'
              }
              key={conversation.id}
              onClick={() => setSelected(conversation)}
            >
              <span>
                <strong>{conversation.customer}</strong>
                <small>{conversation.subject}</small>
              </span>
              <StatusChip tone={conversation.tone}>
                {conversation.status}
              </StatusChip>
            </Button>
          ))}
        </aside>
        <section className="workspace-card conversation-card" key={selected.id}>
          <header>
            <small>#{selected.id}</small>
            <h2>{selected.subject}</h2>
            <Button onClick={() => setClaimed(selected.id)}>
              {claimed === selected.id ? 'Đang xử lý bởi bạn' : 'Nhận xử lý'}
            </Button>
          </header>
          <ConversationPanel
            author="Support"
            initialMessages={selected.messages}
            inputLabel="Phản hồi hỗ trợ"
            submitLabel="Gửi phản hồi"
          />
        </section>
        <aside className="workspace-card detail-card">
          <h2>Ngữ cảnh khách hàng</h2>
          <strong>{selected.company}</strong>
          <FactList
            facts={[
              { label: 'Sản phẩm', value: selected.product },
              { label: 'Đơn hàng', value: selected.orderId },
              { label: 'Thanh toán', value: selected.payment },
              {
                label: 'Quota',
                value: `${selected.usedDevices} / ${selected.totalDevices}`,
              },
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
