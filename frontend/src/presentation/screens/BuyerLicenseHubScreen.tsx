import { Alert, Button, Empty, Progress, Segmented, Spin } from 'antd';
import { useEffect, useState } from 'react';

import {
  useLicenses,
  useRetrieveActivationKey,
} from '../../application/licenses/licenseQueries';
import { colorPalette } from '../theme';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function BuyerLicenseHubScreen() {
  const licenses = useLicenses();
  const retrieval = useRetrieveActivationKey();
  const [selectedId, setSelectedId] = useState('');
  const [activationKey, setActivationKey] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const rows = licenses.data ?? [];
  useEffect(() => {
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }, [rows, selectedId]);
  const selected = rows.find((license) => license.id === selectedId) ?? rows[0];

  if (licenses.isPending) return <Spin />;
  if (licenses.error)
    return <Alert type="error" message="Không thể tải danh sách License." />;
  if (!selected) return <Empty description="Chưa có License" />;

  return (
    <>
      <PageHeader
        title="License Hub"
        description="Quản lý License và nhận activation key sau khi đạt finality."
      />
      <Segmented
        aria-label="Chọn license"
        block
        onChange={(value) => {
          setSelectedId(value);
          setActivationKey(null);
          retrieval.reset();
        }}
        options={rows.map((license) => ({
          label: license.productName,
          value: license.id,
        }))}
        value={selected.id}
      />
      <div className="workspace-two-column license-grid">
        <section className="workspace-card detail-card">
          <header className="card-heading">
            <div>
              <small>{selected.publicLicenseId}</small>
              <h2>{selected.productName}</h2>
            </div>
            <StatusChip
              tone={selected.status === 'ACTIVE' ? 'success' : 'warning'}
            >
              {selected.status}
            </StatusChip>
          </header>
          <Progress
            percent={selected.status === 'ACTIVE' ? 100 : 50}
            strokeColor={colorPalette.primary}
          />
          <FactList
            facts={[
              {
                label: 'Gói',
                value: `${selected.plan.name} v${selected.plan.version}`,
              },
              {
                label: 'Thiết bị tối đa',
                value: String(selected.maxActiveDevices),
              },
              {
                label: 'Hết hạn',
                value: new Date(selected.expiresAt).toLocaleDateString('vi-VN'),
              },
              {
                label: 'Finality',
                value: `${selected.finality} (${selected.confirmationCount})`,
              },
              {
                label: 'Activation key',
                value: activationKey ? (
                  <code>{activationKey}</code>
                ) : (
                  '••••-••••-••••'
                ),
              },
            ]}
          />
          <Button
            disabled={selected.status !== 'ACTIVE' || activationKey !== null}
            loading={retrieval.isPending}
            onClick={() =>
              retrieval.mutate({ id: selected.id }, {
                onSuccess: (value) => setActivationKey(value.activationKey),
              })
            }
          >
            Nhận activation key
          </Button>
          {activationKey ? (
            <Button
              onClick={() => {
                void navigator.clipboard?.writeText(activationKey);
                setCopyStatus('Đã sao chép activation key');
              }}
            >
              Sao chép activation key
            </Button>
          ) : null}
          {retrieval.error ? (
            <Alert
              type="warning"
              message="Key không còn khả dụng hoặc đã được nhận trước đó."
            />
          ) : null}
          <span aria-live="polite">{copyStatus}</span>
        </section>
      </div>
    </>
  );
}
