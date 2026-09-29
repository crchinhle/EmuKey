import { Alert, Button, Empty, Spin } from 'antd';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOptionalAuth } from '../../application/auth/authContext';

import { useAppendSupportMessage, useClaimConversation, useCloseSupportConversation, useSupportConversationMessages, useSupportQueue } from '../../application/assistance/supportQueries';
import { conversationContextLabels, conversationStatusLabels } from '../../application/assistance/assistanceQueries';
import { ConversationPanel } from '../components/ConversationPanel';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function SupportConsoleScreen() {
  const location = useLocation();
  const auth = useOptionalAuth();
  const queue = useSupportQueue(new URLSearchParams(location.search).get('view') === 'resolved');
  const [selectedId, setSelectedId] = useState<string>();
  const claim = useClaimConversation();
  const append = useAppendSupportMessage();
  const close = useCloseSupportConversation();
  const view = new URLSearchParams(location.search).get('view') ?? 'all';
  const queueData = (queue.data ?? []).filter((conversation) =>
    view === 'active'
      ? conversation.status === 'SUPPORT_ACTIVE'
      : view === 'resolved'
        ? conversation.status === 'CLOSED'
        : true,
  );
  const selected = queueData.find((item) => item.id === selectedId) ?? queueData[0];
  const messages = useSupportConversationMessages(selected?.id);
  if (queue.isLoading && !queue.data) return <Spin aria-label="Đang tải hàng đợi hỗ trợ" />;
  return (
    <>
      <PageHeader
        title="Hàng đợi hỗ trợ"
        action={<Button onClick={() => void queue.refetch()} loading={queue.isFetching}>Làm mới</Button>}
      />
      {queue.isError ? <Alert showIcon type="error" message="Không thể tải hàng đợi hỗ trợ." action={<Button onClick={() => void queue.refetch()}>Thử lại</Button>} /> : null}
      {claim.isError || close.isError ? <Alert type="error" title="Không thể cập nhật hội thoại. Vui lòng thử lại." /> : null}
      {!queue.isLoading && !queue.isError && !selected ? <Empty description={view === 'resolved' ? 'Chưa có hội thoại đã giải quyết.' : view === 'active' ? 'Không có hội thoại đang xử lý.' : 'Hàng đợi trống'} /> : null}
      {selected ? <div className="console-grid support-console">
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
                {conversationStatusLabels[conversation.status]}
              </StatusChip>
            </Button>
          ))}
        </aside>
        <section className="workspace-card conversation-card" key={selected.id}>
          <header>
            <small>#{selected.id}</small>
            <h2>{selected.title ?? 'Hội thoại hỗ trợ'}</h2>
            <div className="conversation-actions">
              {selected.status === 'CLOSED' ? <StatusChip tone="success">Đã hoàn tất</StatusChip> : (
                <>
                  <Button loading={claim.isPending} disabled={selected.status === 'SUPPORT_ACTIVE'} onClick={() => claim.mutate(selected.id)}>
                    {selected.status === 'SUPPORT_ACTIVE' ? selected.assignedSupportUserId === auth?.user?.id ? 'Đang xử lý bởi bạn' : 'Đã có người xử lý' : 'Nhận xử lý'}
                  </Button>
                  <Button
                    disabled={selected.status !== 'SUPPORT_ACTIVE' || selected.assignedSupportUserId !== auth?.user?.id}
                    loading={close.isPending}
                    onClick={() => close.mutate(selected.id)}
                  >
                    Hoàn tất
                  </Button>
                </>
              )}
            </div>
          </header>
          {messages.isError ? <Alert type="error" title="Không thể tải tin nhắn" action={<Button onClick={() => void messages.refetch()}>Thử lại</Button>} /> : null}
          <ConversationPanel
            author="Support"
            initialMessages={(messages.data ?? []).map((message) => ({
              author: message.senderType === 'CUSTOMER' ? ('Buyer' as const) : message.senderType === 'AI' ? ('AI' as const) : ('Support' as const),
              body: message.content,
              id: message.id,
            }))}
            inputLabel="Phản hồi hỗ trợ"
            onSubmit={(content) => append.mutateAsync({ clientMessageId: crypto.randomUUID(), content, conversationId: selected.id })}
            readOnly={selected.status === 'CLOSED'}
            submitLabel="Gửi phản hồi"
          />
        </section>
        <aside className="workspace-card detail-card">
          <h2>Thông tin người mua</h2>
          <strong>{selected.customerUserId.startsWith('Người mua') ? selected.customerUserId : `Người mua #${selected.customerUserId.slice(0, 4)}`}</strong>
          <FactList
            facts={[
              { label: 'Nội dung cần hỗ trợ', value: conversationContextLabels[selected.contextType] },
              { label: 'Trạng thái', value: conversationStatusLabels[selected.status] },
            ]}
          />
          <p className="security-note">
            Chỉ hiển thị dữ liệu cần thiết cho vai trò hỗ trợ.
          </p>
        </aside>
      </div> : null}
    </>
  );
}
