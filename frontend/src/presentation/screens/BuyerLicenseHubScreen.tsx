import { Alert, Button, Empty, Input, Progress, Segmented, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  useActivateDevice,
  useActivationChallenge,
  useLicenseDevices,
  useIssueEntitlement,
  useRefreshEntitlement,
  useRevokeDevice,
  useRotateActivationKey,
  useLicenses,
  usePhase6Command,
  useRetrieveActivationKey,
  useRequestLicensingActionVerification,
  useVerifyEntitlement,
} from '../../application/licenses/licenseQueries';
import { colorPalette } from '../theme';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function BuyerLicenseHubScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const licenses = useLicenses();
  const retrieval = useRetrieveActivationKey();
  const challenge = useActivationChallenge();
  const activation = useActivateDevice();
  const revoke = useRevokeDevice();
  const rotate = useRotateActivationKey();
  const entitlement = useIssueEntitlement();
  const entitlementRefresh = useRefreshEntitlement();
  const actionVerification = useRequestLicensingActionVerification();
  const entitlementValidation = useVerifyEntitlement();
  const [selectedId, setSelectedId] = useState('');
  const [activationKey, setActivationKey] = useState<string | null>(null);
  const [activationKeyForRotation, setActivationKeyForRotation] = useState('');
  const [deviceRef, setDeviceRef] = useState('');
  const [devicePublicKey, setDevicePublicKey] = useState('');
  const [deviceProof, setDeviceProof] = useState('');
  const [deviceChallenge, setDeviceChallenge] = useState('');
  const [revokeChallenge, setRevokeChallenge] = useState('');
  const [revokeProof, setRevokeProof] = useState('');
  const [actionToken, setActionToken] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [entitlementToken, setEntitlementToken] = useState('');
  const [activeCommand, setActiveCommand] = useState<{
    commandId: string;
    commandType: 'ACTIVATE_DEVICE' | 'REVOKE_DEVICE' | 'ROTATE_KEY';
    licenseId: string;
  } | null>(null);
  const handledCommand = useRef<string | null>(null);
  const commandStatus = usePhase6Command(activeCommand?.commandId);
  const rows = licenses.data ?? [];
  useEffect(() => {
    const linkedToken = searchParams.get('actionToken');
    if (!linkedToken) return;
    setActionToken(linkedToken);
    const sanitized = new URLSearchParams(searchParams);
    sanitized.delete('actionToken');
    setSearchParams(sanitized, { replace: true });
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }, [rows, selectedId]);
  const selected = rows.find((license) => license.id === selectedId) ?? rows[0];
  const devices = useLicenseDevices(selected?.id);
  useEffect(() => {
    const command = commandStatus.data;
    if (!command || command.status !== 'CONFIRMED' || handledCommand.current === command.commandId) return;
    handledCommand.current = command.commandId;
    void licenses.refetch();
    void devices.refetch();
    if (activeCommand?.commandType === 'ROTATE_KEY') {
      retrieval.mutate(
        { id: command.licenseId },
        {
          onSuccess: (value) => {
            setActivationKey(value.activationKey);
            setCopyStatus(`Đã nhận activation key phiên bản ${value.keyVersion} sau finality.`);
          },
        },
      );
    }
  }, [activeCommand?.commandType, commandStatus.data, devices, licenses, retrieval]);

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
          setActivationKeyForRotation('');
          setDeviceChallenge('');
          setDeviceProof('');
          setRevokeChallenge('');
           setRevokeProof('');
           setActionToken('');
          retrieval.reset();
          challenge.reset();
          activation.reset();
          revoke.reset();
          rotate.reset();
          entitlement.reset();
          entitlementRefresh.reset();
          entitlementValidation.reset();
          setEntitlementToken('');
          actionVerification.reset();
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
          <Input.Password
            aria-label="Activation key sử dụng trên thiết bị"
            onChange={(event) => setActivationKey(event.target.value || null)}
            placeholder="Dán activation key đã lưu hoặc nhận key lần đầu"
            value={activationKey ?? ''}
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
          <Button
            disabled={selected.status !== 'ACTIVE'}
            href={`/buyer/licenses/${encodeURIComponent(selected.id)}/renew`}
            type="primary"
          >
            Gia hạn License
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
          <div className="workspace-card phase6-device-card">
            <h3>Kích hoạt thiết bị</h3>
            <div aria-label="Danh sách thiết bị">
              <strong>Thiết bị đã đăng ký</strong>
              {devices.isPending ? <p>Đang tải thiết bị...</p> : null}
              {devices.data?.length === 0 ? <p>Chưa có thiết bị.</p> : null}
              {devices.data?.map((device) => (
                <div key={device.id}>
                  <p>
                    {device.deviceRef} · {device.status} · {
                      typeof device.finality === 'string' ? device.finality : 'PENDING'
                    }
                  </p>
                  {device.status === 'ACTIVE' ? (
                    <Button
                      loading={challenge.isPending}
                      onClick={() => {
                        challenge.mutate(
                          { deviceId: device.id, deviceRef: device.deviceRef, licenseId: selected.id },
                          { onSuccess: (value) => setRevokeChallenge(value.challenge) },
                        );
                      }}
                    >
                      Tạo challenge thu hồi
                    </Button>
                  ) : null}
                  {device.status === 'ACTIVE' && revokeChallenge ? (
                    <Button
                      disabled={!activationKey || !revokeProof || !actionToken}
                      loading={revoke.isPending}
                      onClick={() => {
                        if (!activationKey) return;
                        if (!actionToken) return;
                        revoke.mutate({
                          deviceId: device.id,
                          input: { actionToken, activationKey, challenge: revokeChallenge, proof: revokeProof },
                          licenseId: selected.id,
                        }, { onSuccess: (command) => setActiveCommand({
                          commandId: command.commandId,
                          commandType: 'REVOKE_DEVICE',
                          licenseId: command.licenseId,
                        }) });
                      }}
                    >
                      Thu hồi thiết bị
                    </Button>
                  ) : null}
                  {device.status === 'ACTIVE' &&
                  typeof device.finality === 'string' &&
                  device.finality === 'CONFIRMED' ? (
                    <>
                    <Button
                      loading={entitlement.isPending}
                      disabled={!deviceChallenge || !deviceProof}
                      onClick={() => entitlement.mutate(
                        { challenge: deviceChallenge, deviceId: device.id, licenseId: selected.id, proof: deviceProof },
                        { onSuccess: (value) => setEntitlementToken(value.token) },
                      )}
                    >
                      Cấp entitlement
                    </Button>
                    <Button
                      disabled={!deviceChallenge || !deviceProof}
                      loading={entitlementRefresh.isPending}
                      onClick={() => entitlementRefresh.mutate(
                        { challenge: deviceChallenge, deviceId: device.id, licenseId: selected.id, proof: deviceProof },
                        { onSuccess: (value) => setEntitlementToken(value.token) },
                      )}
                    >
                      Làm mới entitlement
                    </Button>
                    <Button
                      loading={challenge.isPending}
                      onClick={() => challenge.mutate({ deviceId: device.id, deviceRef: device.deviceRef, licenseId: selected.id }, { onSuccess: (value) => setDeviceChallenge(value.challenge) })}
                    >
                      Tạo challenge entitlement
                    </Button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
            {revokeChallenge ? <Input aria-label="Email action token thu hồi" onChange={(event) => setActionToken(event.target.value)} placeholder="Token xác nhận đã nhận qua email" value={actionToken} /> : null}
            {revokeChallenge ? <Button onClick={() => actionVerification.mutate({ action: 'REVOKE_DEVICE', licenseId: selected.id })}>Gửi email xác nhận thu hồi</Button> : null}
            <Input
              aria-label="Mã tham chiếu thiết bị"
              onChange={(event) => setDeviceRef(event.target.value)}
              placeholder="Mã tham chiếu thiết bị"
              value={deviceRef}
            />
            <Input
              aria-label="Địa chỉ khóa công khai thiết bị"
              onChange={(event) => setDevicePublicKey(event.target.value)}
              placeholder="Địa chỉ EVM của thiết bị"
              value={devicePublicKey}
            />
            <Button
              disabled={selected.status !== 'ACTIVE' || !deviceRef || !activationKey}
              loading={challenge.isPending}
              onClick={() =>
                challenge.mutate(
                  { deviceRef, licenseId: selected.id },
                  { onSuccess: (value) => setDeviceChallenge(value.challenge) },
                )
              }
            >
              Tạo challenge
            </Button>
            {deviceChallenge ? <code>{deviceChallenge}</code> : null}
            <Input
              aria-label="Chữ ký xác thực thiết bị"
              onChange={(event) => setDeviceProof(event.target.value)}
              placeholder="Chữ ký EIP-191 của thiết bị"
              value={deviceProof}
            />
            <Button
              disabled={!activationKey || !deviceChallenge || !devicePublicKey || !deviceProof}
              loading={activation.isPending}
              onClick={() =>
                activationKey &&
                activation.mutate({
                    activationKey,
                    challenge: deviceChallenge,
                    devicePublicKey,
                    deviceRef,
                    licenseId: selected.id,
                    proof: deviceProof,
                  }, { onSuccess: (command) => setActiveCommand({
                    commandId: command.commandId,
                    commandType: 'ACTIVATE_DEVICE',
                    licenseId: command.licenseId,
                  }) })
              }
            >
              Gửi yêu cầu kích hoạt
            </Button>
            {activation.data ? (
              <Alert
                type="info"
                message={`Command ${activation.data.status}: ${activation.data.commandId}`}
              />
            ) : null}
            {activation.error ? (
              <Alert type="warning" message="Không thể tạo yêu cầu kích hoạt thiết bị." />
            ) : null}
            {commandStatus.data ? (
              <Alert
                type={commandStatus.data.status === 'CONFIRMED' ? 'success' : commandStatus.data.status === 'DEAD_LETTER' ? 'error' : 'info'}
                message={`Command ${commandStatus.data.status}: ${commandStatus.data.commandId}`}
                description={commandStatus.data.transactionHash ? `Transaction: ${commandStatus.data.transactionHash}` : 'Đang chờ worker gửi transaction và đạt finality.'}
              />
            ) : null}
            {commandStatus.error ? <Alert type="error" message="Không thể theo dõi trạng thái blockchain command." /> : null}
            {revokeChallenge ? <code>{revokeChallenge}</code> : null}
            <Input.Password aria-label="Email action token" onChange={(event) => setActionToken(event.target.value)} placeholder="Token xác nhận đã nhận qua email" value={actionToken} />
            {revokeChallenge ? (
              <Input
                aria-label="Chữ ký thu hồi thiết bị"
                onChange={(event) => setRevokeProof(event.target.value)}
                placeholder="Chữ ký EIP-191 cho challenge thu hồi"
                value={revokeProof}
              />
            ) : null}
            {revoke.data ? <Alert type="info" message={`Revoke command: ${revoke.data.status}`} /> : null}
            {revoke.error ? <Alert type="warning" message="Không thể thu hồi thiết bị." /> : null}
            {entitlement.data ? (
              <Alert
                type="success"
                message="Entitlement đã được cấp."
                description={<code>{entitlement.data.token}</code>}
              />
            ) : null}
            {entitlementToken ? (
              <Button loading={entitlementValidation.isPending} onClick={() => entitlementValidation.mutate(entitlementToken)}>
                Kiểm tra entitlement hiện tại
              </Button>
            ) : null}
            {entitlementValidation.data ? <Alert type="success" message="Entitlement còn hiệu lực theo trạng thái on-chain hiện tại." /> : null}
            {entitlementValidation.error ? <Alert type="error" message="Entitlement đã hết hạn hoặc bị vô hiệu bởi thay đổi License." /> : null}
            {entitlement.error ? <Alert type="warning" message="License hoặc thiết bị chưa đạt finality." /> : null}
            <Input.Password
              aria-label="Activation key hiện tại để rotate"
              placeholder="Activation key hiện tại để đổi key"
              onChange={(event) => {
                rotate.reset();
                setActivationKeyForRotation(event.target.value);
              }}
            />
            <Button
              disabled={!activationKeyForRotation || !actionToken || selected.status !== 'ACTIVE'}
              loading={rotate.isPending}
              onClick={() => rotate.mutate(
                { input: { actionToken, currentKey: activationKeyForRotation }, licenseId: selected.id },
                { onSuccess: (command) => {
                  setActivationKey(null);
                  retrieval.reset();
                  setActivationKeyForRotation('');
                  setActiveCommand({
                    commandId: command.commandId,
                    commandType: 'ROTATE_KEY',
                    licenseId: command.licenseId,
                  });
                } },
              )}
            >
              Đổi activation key
            </Button>
            <Button onClick={() => actionVerification.mutate({ action: 'ROTATE_KEY', licenseId: selected.id })}>Gửi email xác nhận đổi key</Button>
            {revokeChallenge ? <Button onClick={() => actionVerification.mutate({ action: 'REVOKE_DEVICE', licenseId: selected.id })}>Gửi email xác nhận thu hồi</Button> : null}
            {actionVerification.isSuccess ? <Alert type="success" message="Đã gửi email xác nhận thao tác. Token có hiệu lực trong 15 phút." /> : null}
            {actionVerification.error ? <Alert type="warning" message="Không thể gửi email xác nhận thao tác." /> : null}
            {rotate.data ? <Alert type="info" message={`Rotate command: ${rotate.data.status}`} /> : null}
            {rotate.error ? <Alert type="warning" message="Không thể đổi activation key." /> : null}
          </div>
          <span aria-live="polite">{copyStatus}</span>
        </section>
      </div>
    </>
  );
}
