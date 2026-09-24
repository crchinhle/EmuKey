import { Button, Input } from 'antd';
import { useEffect, useState } from 'react';

import type { ConversationMessage } from '../../domain/workspace';

interface ConversationPanelProps {
  readonly initialMessages: readonly ConversationMessage[];
  readonly inputLabel: string;
  readonly submitLabel: string;
  readonly author: ConversationMessage['author'];
  readonly suggestion?: string;
  readonly onSubmit?: (content: string) => void;
  readonly onAskAi?: (question: string) => void;
  readonly readOnly?: boolean;
}

export function ConversationPanel({
  initialMessages,
  inputLabel,
  submitLabel,
  author,
  suggestion,
  onSubmit,
  onAskAi,
  readOnly = false,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const sendMessage = () => {
    const body = draft.trim();
    if (!body) return;
    onSubmit?.(body);
    setMessages((current) => [
      ...current,
      { id: `local-${current.length}`, author, body },
    ]);
    setDraft('');
  };

  return (
    <section className="conversation-panel" aria-label="Nội dung hội thoại">
      <div className="message-list" aria-live="polite">
        {messages.map((message) => (
          <article
            className={`message message--${message.author.toLowerCase()}`}
            key={message.id}
          >
            <small>{message.author}</small>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      {readOnly ? (
        <p className="muted-copy">Hội thoại đã hoàn tất. Không thể gửi thêm tin nhắn ở trạng thái này.</p>
      ) : <label className="message-composer">
        <span>{inputLabel}</span>
        <Input.TextArea
          aria-label={inputLabel}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          value={draft}
        />
        <span className="composer-actions">
          {suggestion ? (
            <Button onClick={() => setDraft(suggestion)}>Chèn gợi ý AI</Button>
          ) : null}
          {onAskAi ? <Button disabled={!draft.trim()} onClick={() => onAskAi(draft.trim())}>Hỏi AI có nguồn</Button> : null}
          <Button onClick={sendMessage} type="primary">
            {submitLabel}
          </Button>
        </span>
      </label>}
    </section>
  );
}
