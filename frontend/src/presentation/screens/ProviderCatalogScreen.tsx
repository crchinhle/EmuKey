import { Button, Input, Modal, Table, message } from 'antd';
import { useMemo, useState } from 'react';

import { products } from '../../infrastructure/catalog/mockCatalog';
import { promotions } from '../../infrastructure/workspace/mockWorkspace';
import { PageHeader, StatusChip } from '../components/WorkspacePrimitives';

export function ProviderCatalogScreen() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [messageApi, contextHolder] = message.useMessage();
  const filteredPromotions = useMemo(
    () =>
      promotions.filter((promotion) =>
        promotion.name
          .toLocaleLowerCase('vi')
          .includes(query.trim().toLocaleLowerCase('vi')),
      ),
    [query],
  );
  const saveDraft = () => {
    const safeName = name.trim() || 'Chưa đặt tên';
    setOpen(false);
    void messageApi.success(`Đã lưu bản nháp “${safeName}”`);
  };
  return (
    <>
      {contextHolder}
      <PageHeader
        title="Danh mục & khuyến mãi"
        description="Quản lý sản phẩm, gói thiết bị và chương trình ưu đãi."
        action={
          <Button type="primary" onClick={() => setOpen(true)}>
            Tạo khuyến mãi
          </Button>
        }
      />
      <section className="workspace-card table-card">
        <h2 className="section-title">Sản phẩm</h2>
        <Table
          dataSource={[...products]}
          pagination={false}
          rowKey="slug"
          scroll={{ x: 620 }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'name' },
            { title: 'Nhóm', dataIndex: 'group' },
            {
              title: 'Số gói',
              dataIndex: 'plans',
              render: (plans: readonly unknown[]) => plans.length,
            },
            { title: 'Ưu đãi', dataIndex: 'promotion' },
          ]}
        />
      </section>
      <section className="workspace-card table-card spaced-card">
        <h2 className="section-title">Chương trình khuyến mãi</h2>
        <div className="inline-filter">
          <Input.Search
            aria-label="Tìm khuyến mãi"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm chương trình"
            value={query}
          />
          <small>Mỗi đơn hàng chỉ áp dụng một khuyến mãi hợp lệ.</small>
        </div>
        <Table
          dataSource={[...filteredPromotions]}
          pagination={false}
          rowKey="id"
          scroll={{ x: 720 }}
          columns={[
            { title: 'Tên', dataIndex: 'name' },
            { title: 'Phạm vi', dataIndex: 'scope' },
            { title: 'Mức giảm', dataIndex: 'discount' },
            { title: 'Thời gian', dataIndex: 'period' },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (value: string, record) => (
                <StatusChip tone={record.tone}>{value}</StatusChip>
              ),
            },
          ]}
        />
      </section>
      <Modal
        open={open}
        title="Tạo chương trình khuyến mãi"
        okText="Lưu bản nháp"
        cancelText="Hủy"
        onCancel={() => setOpen(false)}
        onOk={saveDraft}
      >
        <label className="modal-field">
          <span>Tên chương trình</span>
          <Input
            aria-label="Tên chương trình"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: Ưu đãi khách hàng mới"
          />
        </label>
        <p className="security-note">
          Bản demo chỉ lưu trong bộ nhớ trình duyệt.
        </p>
      </Modal>
    </>
  );
}
