import { Button, Input } from 'antd';
import { useState } from 'react';

import type { ConversationMessage } from '../../domain/workspace';

interface ConversationPanelProps {
  readonly initialMessages: readonly ConversationMessage[];
  readonly inputLabel: string;
  readonly submitLabel: string;
  readonly author: ConversationMessage['author'];
  readonly suggestion?: string;
}

export function ConversationPanel({
  initialMessages,
  inputLabel,
  submitLabel,
  author,
  suggestion,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');

  const sendMessage = () => {
    const body = draft.trim();
    if (!body) return;
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
      <label className="message-composer">
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
          <Button onClick={sendMessage} type="primary">
            {submitLabel}
          </Button>
        </span>
      </label>
    </section>
  );
}
