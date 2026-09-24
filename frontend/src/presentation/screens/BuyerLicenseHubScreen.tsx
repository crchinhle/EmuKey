import { Alert, Button, Empty, Input, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useLicenseDevices, useLicenses, useRetrieveActivationKey } from '../../application/licenses/licenseQueries';
import { AiAssistantLauncher } from '../components/AiAssistantLauncher';

type LicenseTab = 'overview' | 'key' | 'devices';

function statusLabel(status: string) {
  if (status === 'ACTIVE') return 'Hoạt động';
  if (status === 'PENDING') return 'Sắp gia hạn';
  if (status === 'REVOKED') return 'Đã thu hồi';
  return status;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

export function BuyerLicenseHubScreen() {
  const licenses = useLicenses();
  const retrieve = useRetrieveActivationKey();
  const [searchParams] = useSearchParams();
  const rows = licenses.data ?? [];
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState<LicenseTab>('overview');
  const [activationKey, setActivationKey] = useState<string>();
  const [copyStatus, setCopyStatus] = useState('');
  const actionToken = searchParams.get('actionToken') ?? '';
  const selected = rows.find((license) => license.id === selectedId) ?? rows[0];
  const devices = useLicenseDevices(selected?.id);

  useEffect(() => {
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  if (licenses.isPending) return <Spin aria-label="Đang tải bản quyền" />;
  if (licenses.isError) return <Alert type="error" message="Không thể tải danh sách bản quyền." />;
  if (!selected) return <Empty description="Chưa có bản quyền" />;

  const activeDevices = (devices.data ?? []).filter((device) => device.status === 'ACTIVE').length;
  const remainingDevices = Math.max(selected.maxActiveDevices - activeDevices, 0);
  const displayedKey = activationKey ?? 'XXXX-XXXX-XXXX-9K2M';

  return (
    <div className="buyer-licenses-screen">
      <main className="buyer-licenses-main">
        <header className="buyer-licenses-title"><h1>Bản quyền &amp; thiết bị</h1><p>Quản lý quyền sử dụng, activation key và thiết bị.</p></header>
        <div className="buyer-licenses-tabs"><button className="active" type="button">Đang hoạt động {rows.filter((row) => row.status === 'ACTIVE').length}</button><button type="button">Sắp hết hạn</button><button type="button">Đã thu hồi</button></div>
        <div className="buyer-licenses-layout">
          <aside aria-label="Danh sách bản quyền" className="buyer-licenses-list">
            {rows.map((license) => (
              <button className={`buyer-license-list-item ${license.id === selected.id ? 'selected' : ''}`} key={license.id} onClick={() => { setSelectedId(license.id); setTab('overview'); setActivationKey(undefined); }} type="button">
                <span className="buyer-license-list-heading"><strong>{license.productName}</strong><span className={`buyer-license-status buyer-license-status--${license.status.toLowerCase()}`}>{statusLabel(license.status)}</span></span>
                <span>{license.id === selected.id ? activeDevices : 0}/{license.maxActiveDevices} thiết bị</span>
                <span className="buyer-license-progress"><i style={{ width: `${Math.min(((license.id === selected.id ? activeDevices : 0) / license.maxActiveDevices) * 100, 100)}%` }} /></span>
              </button>
            ))}
          </aside>
          <section aria-label="Chi tiết bản quyền" className="buyer-license-detail">
            <header className="buyer-license-detail-header"><div><h2>{selected.productName} · {selected.plan.name}</h2><p>{selected.publicLicenseId} · Hết hạn {dateLabel(selected.expiresAt)}</p></div><span className="buyer-license-status buyer-license-status--active">{statusLabel(selected.status)}</span></header>
            <nav aria-label="Chi tiết bản quyền" className="buyer-license-detail-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')} type="button">Tổng quan</button><button className={tab === 'key' ? 'active' : ''} onClick={() => setTab('key')} type="button">Khóa kích hoạt</button><button className={tab === 'devices' ? 'active' : ''} onClick={() => setTab('devices')} type="button">Thiết bị</button></nav>
            {tab === 'overview' ? <>
              <div className="buyer-license-summary"><article><span>Phạm vi</span><strong>{selected.maxActiveDevices} thiết bị</strong></article><article><span>Đã kích hoạt</span><strong>{activeDevices}</strong></article><article><span>Còn lại</span><strong>{remainingDevices}</strong></article></div>
              <section className="buyer-license-key-card"><span className="buyer-license-once">Hiển thị một lần</span><Button onClick={() => void navigator.clipboard?.writeText(displayedKey)}>Sao chép</Button><strong>{displayedKey}</strong><p>Chỉ hiển thị một lần sau khi hệ thống xác nhận; nếu mất khóa, hãy tạo khóa mới.</p></section>
              <section className="buyer-license-devices"><h3>Thiết bị gần đây</h3>{(devices.data ?? []).slice(0, 2).map((device) => <div className="buyer-license-device-row" key={device.id}><span>{device.deviceRef} · Windows 11 · {statusLabel(device.status)}</span><Button onClick={() => setTab('devices')}>Chi tiết</Button></div>)}</section>
            </> : null}
            {tab === 'key' ? <section className="buyer-license-action-panel"><h3>Khóa kích hoạt</h3><Input.Password aria-label="Activation key" onChange={(event) => setActivationKey(event.target.value || undefined)} placeholder="Dán activation key đã lưu hoặc nhận key lần đầu" value={activationKey ?? ''} /><Button disabled={!selected.activationKeyAvailable} loading={retrieve.isPending} onClick={() => retrieve.mutate({ id: selected.id }, { onSuccess: (value) => setActivationKey(value.activationKey) })}>Nhận activation key</Button>{activationKey ? <><code>{activationKey}</code><Button onClick={() => { void navigator.clipboard?.writeText(activationKey); setCopyStatus('Đã sao chép activation key'); }}>Sao chép activation key</Button></> : null}<span aria-live="polite">{copyStatus}</span><Button href={`/buyer/licenses/${encodeURIComponent(selected.id)}/renew`} type="primary">Gia hạn License</Button></section> : null}
            {tab === 'devices' ? <section className="buyer-license-action-panel"><h3>Thiết bị đã đăng ký</h3>{devices.isPending ? <Spin /> : null}{devices.data?.length ? devices.data.map((device) => <div className="buyer-license-device-row" key={device.id}><span>{device.deviceRef} · {statusLabel(device.status)}</span><Button>Chi tiết</Button></div>) : <Empty description="Chưa có thiết bị." />}</section> : null}
            {actionToken ? <input aria-label="Email action token" className="sr-only" readOnly value={actionToken} /> : null}
          </section>
        </div>
      </main>
      <AiAssistantLauncher />
    </div>
  );
}
