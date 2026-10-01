import { BellOutlined } from '@ant-design/icons';
import { Badge, Button, Empty, List, Popover, Spin } from 'antd';
import { Link } from 'react-router-dom';

import { useMarkNotificationRead, useNotifications } from '../../application/notifications/notificationQueries';

export function NotificationCenter() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const unread = (notifications.data ?? []).filter((item) => !item.isRead).length;

  const content = notifications.isLoading ? <Spin size="small" /> : notifications.isError ? (
    <div className="notification-popover-error">
      <p>Không thể tải thông báo.</p>
      <Button size="small" onClick={() => void notifications.refetch()}>Thử lại</Button>
    </div>
  ) : notifications.data?.length ? (
    <>
      <List
        className="notification-list"
        dataSource={notifications.data.slice(0, 8)}
        locale={{ emptyText: <Empty description="Chưa có thông báo" /> }}
        renderItem={(item) => (
          <List.Item
            {...(!item.isRead ? { actions: [<Button key="read" size="small" type="link" loading={markRead.isPending && markRead.variables === item.id} onClick={() => markRead.mutate(item.id)}>Đã đọc</Button>] } : {})}
          >
            <List.Item.Meta description={item.content} title={item.title} />
          </List.Item>
        )}
      />
      {notifications.data.length > 8 ? <Link to="/buyer/notifications">Xem tất cả thông báo</Link> : null}
    </>
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
