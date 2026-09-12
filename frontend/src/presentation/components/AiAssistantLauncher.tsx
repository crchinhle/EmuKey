import { RobotOutlined } from '@ant-design/icons';
import { FloatButton, Popover, Tag } from 'antd';
import { useState } from 'react';

const assistantPanelId = 'emukey-ai-assistant-panel';

export function AiAssistantLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      content={
        <section
          aria-label="Trợ lý AI EmuKey"
          className="ai-assistant-panel"
          id={assistantPanelId}
        >
          <Tag color="purple">AI</Tag>
          <h2>Trợ lý AI EmuKey</h2>
          <p>Hỏi về số thiết bị, thời hạn và quyền sử dụng phù hợp.</p>
          <p className="inline-message" role="status">
            Gợi ý mẫu: Gói Business phù hợp với nhóm từ 11–50 thiết bị.
          </p>
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
        aria-label="Hỏi AI"
        className="ai-assistant-launcher"
        icon={<RobotOutlined />}
        tooltip={open ? undefined : 'Hỏi AI'}
        type="primary"
      />
    </Popover>
  );
}
