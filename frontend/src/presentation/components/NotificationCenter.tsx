import { BellOutlined } from '@ant-design/icons';
import { Badge, Button, Empty, List, Popover, Spin } from 'antd';

import { useMarkNotificationRead, useNotifications } from '../../application/notifications/notificationQueries';

export function NotificationCenter() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const unread = (notifications.data ?? []).filter((item) => !item.isRead).length;

  const content = notifications.isLoading ? <Spin size="small" /> : notifications.data?.length ? (
    <List
      className="notification-list"
      dataSource={notifications.data.slice(0, 8)}
      locale={{ emptyText: <Empty description="Chưa có thông báo" /> }}
      renderItem={(item) => (
        <List.Item {...(!item.isRead ? { actions: [<Button key="read" size="small" type="link" onClick={() => markRead.mutate(item.id)}>Đã đọc</Button>] } : {})}>
          <List.Item.Meta description={item.content} title={item.title} />
        </List.Item>
      )}
    />
  ) : <Empty description="Chưa có thông báo" />;

  return (
    <div className="notification-wrapper">
      <Popover content={<div className="notification-popover">{content}</div>} placement="bottomRight" trigger="click">
        <Badge count={unread} overflowCount={99} size="small">
          <Button aria-label="Thông báo" icon={<BellOutlined />} type="default" />
        </Badge>
      </Popover>
    </div>
  );
}
