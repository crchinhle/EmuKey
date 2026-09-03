import { Button, Progress, Segmented } from 'antd';
import { useState } from 'react';

import { licenses } from '../../infrastructure/workspace/mockWorkspace';
import { colorPalette } from '../theme';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function BuyerLicenseHubScreen() {
  const [selectedId, setSelectedId] = useState(licenses[0]!.id);
  const [revealed, setRevealed] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const selected =
    licenses.find((license) => license.id === selectedId) ?? licenses[0]!;

  return (
    <>
      <PageHeader
        title="License Hub"
        description="Quản lý key demo, quota và thiết bị đã kích hoạt."
      />
      <Segmented
        aria-label="Chọn license"
        block
        onChange={(value) => {
          setSelectedId(value);
          setRevealed(false);
        }}
        options={licenses.map((license) => ({
          label: license.product,
          value: license.id,
        }))}
        value={selectedId}
      />
      <div className="workspace-two-column license-grid">
        <section className="workspace-card detail-card">
          <header className="card-heading">
            <div>
              <small>{selected.id}</small>
              <h2>{selected.product}</h2>
            </div>
            <StatusChip
              tone={selected.status === 'active' ? 'success' : 'warning'}
            >
              {selected.statusLabel}
            </StatusChip>
          </header>
          <Progress
            percent={Math.round((selected.used / selected.total) * 100)}
            strokeColor={colorPalette.primary}
          />
          <FactList
            facts={[
              { label: 'Gói', value: selected.plan },
              {
                label: 'Thiết bị',
                value: `${selected.used} / ${selected.total}`,
              },
              { label: 'Hết hạn', value: selected.expiresAt },
              {
                label: 'License key',
                value: revealed ? (
                  <code>{selected.demoKey}</code>
                ) : (
                  '••••-••••-••••'
                ),
              },
            ]}
          />
          <Button onClick={() => setRevealed((value) => !value)}>
            {revealed ? 'Ẩn key demo' : 'Hiện key demo'}
          </Button>
          {revealed ? (
            <Button
              onClick={() => {
                void navigator.clipboard?.writeText(selected.demoKey);
                setCopyStatus('Đã sao chép key demo');
              }}
            >
              Sao chép key demo
            </Button>
          ) : null}
          <span aria-live="polite">{copyStatus}</span>
          <p className="security-note">
            Dữ liệu này chỉ là mô phỏng giao diện, không phải khóa thật.
          </p>
        </section>
        <section className="workspace-card detail-card">
          <h2>Thiết bị đã kích hoạt</h2>
          <div className="stack-list">
            {selected.devices.map((device) => (
              <article key={device.id}>
                <div>
                  <strong>{device.id}</strong>
                  <small>{device.platform}</small>
                </div>
                <StatusChip tone="success">{device.status}</StatusChip>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
