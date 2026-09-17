#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const requireFromBackend = createRequire(
  new URL('./backend/package.json', import.meta.url),
);
const argon2 = requireFromBackend('argon2');
const { Client } = requireFromBackend('pg');
const { keccak256 } = requireFromBackend('viem');

const ACCOUNT_PASSWORD = 'Emu@1234';
const BUSINESS_ROW_COUNT = 40;
const SEED_NAMESPACE = 'emukey-root-demo-v1';
const IMAGE_URLS = Array.from(
  { length: BUSINESS_ROW_COUNT },
  (_, index) =>
    `https://picsum.photos/seed/emukey-product-${String(index + 1).padStart(2, '0')}/1200/800`,
);
const ACTIVATION_FIXTURES = Array.from(
  { length: BUSINESS_ROW_COUNT },
  (_, index) => {
    const i = index + 1;
    const activationKey = `0x${createHash('sha256')
      .update(`${SEED_NAMESPACE}:activation:${i}`)
      .digest('hex')}`;
    return {
      i,
      activation_key: activationKey,
      activation_commitment: keccak256(activationKey),
    };
  },
);
const TABLE_EXPECTATIONS = {
  audit_logs: BUSINESS_ROW_COUNT,
  chain_commands: BUSINESS_ROW_COUNT,
  chain_events: BUSINESS_ROW_COUNT,
  conversations: BUSINESS_ROW_COUNT,
  knowledge_chunks: BUSINESS_ROW_COUNT,
  knowledge_documents: BUSINESS_ROW_COUNT,
  license_devices: BUSINESS_ROW_COUNT,
  licenses: BUSINESS_ROW_COUNT,
  messages: BUSINESS_ROW_COUNT,
  mobile_push_tokens: BUSINESS_ROW_COUNT,
  notifications: BUSINESS_ROW_COUNT,
  orders: BUSINESS_ROW_COUNT,
  payment_attempts: BUSINESS_ROW_COUNT,
  payment_transactions: BUSINESS_ROW_COUNT,
  plans: BUSINESS_ROW_COUNT,
  products: BUSINESS_ROW_COUNT,
  users: BUSINESS_ROW_COUNT,
};

const SEED_SQL = String.raw`
CREATE TEMP TABLE _demo_providers ON COMMIT DROP AS
SELECT
  i,
  md5(current_setting('emukey.seed_namespace') || ':provider:' || i)::uuid AS id,
  'provider.' || substr(md5(current_setting('emukey.seed_namespace') || ':provider-email:' || i), 1, 12) || '@demo.emukey.local' AS email
FROM generate_series(1, 5) AS series(i);

CREATE TEMP TABLE _demo_support ON COMMIT DROP AS
SELECT
  i,
  md5(current_setting('emukey.seed_namespace') || ':support:' || i)::uuid AS id,
  'support.' || substr(md5(current_setting('emukey.seed_namespace') || ':support-email:' || i), 1, 12) || '@demo.emukey.local' AS email
FROM generate_series(1, 3) AS series(i);

CREATE TEMP TABLE _demo_admins ON COMMIT DROP AS
SELECT
  i,
  md5(current_setting('emukey.seed_namespace') || ':admin:' || i)::uuid AS id,
  'admin.' || substr(md5(current_setting('emukey.seed_namespace') || ':admin-email:' || i), 1, 12) || '@demo.emukey.local' AS email
FROM generate_series(1, 2) AS series(i);

CREATE TEMP TABLE _demo_customers ON COMMIT DROP AS
SELECT
  i,
  md5(current_setting('emukey.seed_namespace') || ':customer:' || i)::uuid AS id,
  'customer.' || substr(md5(current_setting('emukey.seed_namespace') || ':customer-email:' || i), 1, 12) || '@demo.emukey.local' AS email,
  (ARRAY['INDIVIDUAL', 'STUDENT', 'BUSINESS'])[((i - 1) % 3) + 1] AS customer_type
FROM generate_series(1, 30) AS series(i);

INSERT INTO users (
  id, email, password_hash, display_name, role, status,
  organization_name, representative_name, tax_code, phone, address,
  provider_chain_address, provider_chain_namespace, customer_type,
  email_verified_at
)
SELECT id, email, current_setting('emukey.seed_password_hash'),
       'Nhà cung cấp ' || upper(substr(md5(email), 1, 8)), 'PROVIDER_ADMIN', 'ACTIVE',
       'Công ty Công nghệ Demo ' || i, 'Đại diện ' || i,
       'DEMO-TAX-' || lpad(i::text, 3, '0'), '028' || lpad((1000000 + i)::text, 7, '0'),
       'TP. Hồ Chí Minh',
       '0x' || substr(md5(current_setting('emukey.seed_namespace') || ':provider-address-a:' || i) || md5(current_setting('emukey.seed_namespace') || ':provider-address-b:' || i), 1, 40),
       'demo-provider-' || substr(md5(current_setting('emukey.seed_namespace') || ':provider-namespace:' || i), 1, 12),
       NULL::varchar, NULL::timestamptz
FROM _demo_providers
UNION ALL
SELECT id, email, current_setting('emukey.seed_password_hash'),
       'Hỗ trợ viên ' || upper(substr(md5(email), 1, 8)), 'SUPPORT_STAFF', 'ACTIVE',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM _demo_support
UNION ALL
SELECT id, email, current_setting('emukey.seed_password_hash'),
       'Quản trị viên ' || upper(substr(md5(email), 1, 8)), 'SYSTEM_ADMIN', 'ACTIVE',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM _demo_admins
UNION ALL
SELECT id, email, current_setting('emukey.seed_password_hash'),
       'Khách hàng ' || upper(substr(md5(email), 1, 8)), 'CUSTOMER', 'ACTIVE',
       NULL, NULL, NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL,
       customer_type, now() - interval '30 days'
FROM _demo_customers
ON CONFLICT (id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  status = 'ACTIVE',
  failed_login_count = 0,
  locked_until = NULL,
  updated_at = now();

CREATE TEMP TABLE _demo_products ON COMMIT DROP AS
SELECT
  i,
  md5(current_setting('emukey.seed_namespace') || ':product:' || i)::uuid AS id,
  ((i - 1) % 5) + 1 AS provider_index,
  'DEMO_' || upper(substr(md5(current_setting('emukey.seed_namespace') || ':product-code:' || i), 1, 10)) AS code,
  (ARRAY[
    'SecureDesk', 'CloudStudio', 'DataGuard', 'Classroom Hub', 'DevShield',
    'RetailFlow', 'ClinicDesk', 'SmartFactory', 'EduAnalytics', 'TeamVault'
  ])[((i - 1) % 10) + 1] || ' ' || lpad(i::text, 2, '0') AS name
FROM generate_series(1, 40) AS series(i);

INSERT INTO products (
  id, provider_user_id, code, name, description, image_url, status, published_at
)
SELECT
  product.id,
  provider.id,
  product.code,
  product.name,
  'Sản phẩm minh họa số ' || product.i || ' dành cho quản lý bản quyền, thiết bị và quyền sử dụng phần mềm.',
  'https://picsum.photos/seed/emukey-product-' || lpad(product.i::text, 2, '0') || '/1200/800',
  'PUBLISHED',
  now() - make_interval(days => 50 - product.i)
FROM _demo_products AS product
JOIN _demo_providers AS provider ON provider.i = product.provider_index
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  status = 'PUBLISHED',
  published_at = EXCLUDED.published_at,
  updated_at = now();

CREATE TEMP TABLE _demo_plans ON COMMIT DROP AS
SELECT
  product.i,
  md5(current_setting('emukey.seed_namespace') || ':plan:' || product.i)::uuid AS id,
  product.id AS product_id,
  provider.id AS provider_user_id,
  'DEMO_PLAN_' || lpad(product.i::text, 2, '0') AS code,
  CASE WHEN product.i % 2 = 0 THEN 'YEARLY' ELSE 'MONTHLY' END AS billing_cycle,
  CASE WHEN product.i % 2 = 0 THEN 12 ELSE 1 END AS duration_months,
  (99000 + product.i * 25000)::bigint AS price_vnd,
  ((product.i - 1) % 5) + 1 AS max_active_devices,
  digest(current_setting('emukey.seed_namespace') || ':terms:' || product.i, 'sha256') AS terms_hash,
  digest(current_setting('emukey.seed_namespace') || ':plan-commitment:' || product.i, 'sha256') AS plan_commitment
FROM _demo_products AS product
JOIN _demo_providers AS provider ON provider.i = product.provider_index;

INSERT INTO plans (
  id, product_id, provider_user_id, code, version, name, billing_cycle,
  duration_months, price_vnd, max_active_devices, entitlements,
  terms_version, terms_hash, plan_commitment, status, published_at
)
SELECT
  id, product_id, provider_user_id, code, 1,
  CASE WHEN billing_cycle = 'YEARLY' THEN 'Gói năm' ELSE 'Gói tháng' END,
  billing_cycle, duration_months, price_vnd, max_active_devices,
  jsonb_build_object('desktop', true, 'cloudSync', i % 2 = 0, 'demoSeed', current_setting('emukey.seed_namespace')),
  1, terms_hash, plan_commitment, 'PUBLISHED', now() - make_interval(days => 40 - i)
FROM _demo_plans
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_orders ON COMMIT DROP AS
SELECT
  product.i,
  md5(current_setting('emukey.seed_namespace') || ':order:' || product.i)::uuid AS id,
  md5(current_setting('emukey.seed_namespace') || ':order-idempotency:' || product.i)::uuid AS idempotency_key,
  customer.id AS customer_user_id,
  plan.provider_user_id,
  plan.product_id,
  plan.id AS plan_id,
  plan.billing_cycle,
  plan.duration_months,
  plan.price_vnd,
  plan.max_active_devices,
  plan.terms_hash,
  plan.plan_commitment,
  product.name AS product_name,
  provider_name.organization_name AS provider_name
FROM _demo_products AS product
JOIN _demo_plans AS plan ON plan.i = product.i
JOIN _demo_customers AS customer ON customer.i = ((product.i - 1) % 30) + 1
JOIN users AS provider_name ON provider_name.id = plan.provider_user_id;

INSERT INTO orders (
  id, order_number, idempotency_key, customer_user_id, provider_user_id,
  product_id, plan_id, order_type, order_status, provider_name_snapshot,
  product_name_snapshot, plan_name_snapshot, plan_version_snapshot,
  price_vnd_snapshot, currency, billing_cycle_snapshot,
  duration_months_snapshot, max_active_devices_snapshot,
  entitlements_snapshot, terms_version_snapshot, terms_hash_snapshot,
  plan_commitment_snapshot, payment_due_at, terms_accepted_at, payment_accepted_at
)
SELECT
  id, 'DEMO-' || upper(substr(md5(id::text), 1, 16)), idempotency_key,
  customer_user_id, provider_user_id, product_id, plan_id,
  'NEW_PURCHASE', 'PAYMENT_ACCEPTED', provider_name, product_name,
  CASE WHEN billing_cycle = 'YEARLY' THEN 'Gói năm' ELSE 'Gói tháng' END,
  1, price_vnd, 'VND', billing_cycle, duration_months, max_active_devices,
  jsonb_build_object('desktop', true, 'demoSeed', current_setting('emukey.seed_namespace')),
  1, terms_hash, plan_commitment, now() + interval '7 days', now() - interval '2 days', now() - interval '1 day'
FROM _demo_orders
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_attempts ON COMMIT DROP AS
SELECT
  orders.i,
  md5(current_setting('emukey.seed_namespace') || ':payment-attempt:' || orders.i)::uuid AS id,
  orders.id AS order_id,
  orders.price_vnd
FROM _demo_orders AS orders;

INSERT INTO payment_attempts (
  id, order_id, attempt_no, provider_reference, amount_vnd, status,
  expires_at, succeeded_at
)
SELECT
  id, order_id, 1, 'DEMO-PAY-' || upper(substr(md5(id::text), 1, 18)),
  price_vnd, 'SUCCEEDED', now() + interval '1 day', now() - interval '1 day'
FROM _demo_attempts
ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_transactions (
  id, provider_event_id, provider_transaction_ref, order_id,
  payment_attempt_id, amount_vnd, classification, raw_payload, received_at
)
SELECT
  md5(current_setting('emukey.seed_namespace') || ':payment-transaction:' || attempt.i)::uuid,
  'DEMO-EVENT-' || upper(substr(md5(attempt.id::text), 1, 18)),
  'DEMO-TXN-' || upper(substr(md5(attempt.order_id::text), 1, 18)),
  attempt.order_id, attempt.id, attempt.price_vnd, 'MATCHED',
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'demo', true),
  now() - interval '1 day'
FROM _demo_attempts AS attempt
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_licenses ON COMMIT DROP AS
SELECT
  orders.i,
  md5(current_setting('emukey.seed_namespace') || ':license:' || orders.i)::uuid AS id,
  orders.id AS origin_order_id,
  orders.provider_user_id,
  orders.customer_user_id,
  orders.product_id,
  orders.plan_id,
  orders.plan_commitment,
  orders.duration_months,
  orders.max_active_devices,
  activation.activation_key,
  decode(substr(activation.activation_commitment, 3), 'hex') AS activation_commitment
FROM _demo_orders AS orders
JOIN jsonb_to_recordset(current_setting('emukey.seed_activations')::jsonb)
  AS activation(i integer, activation_key text, activation_commitment text)
  ON activation.i = orders.i;

INSERT INTO licenses (
  id, public_license_id, origin_order_id, provider_user_id, customer_user_id,
  product_id, plan_id, plan_commitment, status, period_start,
  expires_at, max_active_devices, activation_commitment,
  activation_key_version, activation_key_last4, entitlement_version
)
SELECT
  id, 'EMU-DEMO-' || upper(substr(md5(id::text), 1, 20)), origin_order_id,
  provider_user_id, customer_user_id, product_id, plan_id,
  plan_commitment, 'ACTIVE', now() - interval '1 day',
  now() - interval '1 day' + make_interval(months => duration_months),
  max_active_devices,
  activation_commitment,
  1, upper(substr(md5(id::text), 1, 4)), 1
FROM _demo_licenses
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_devices ON COMMIT DROP AS
SELECT
  license.i,
  md5(current_setting('emukey.seed_namespace') || ':device:' || license.i)::uuid AS id,
  license.id AS license_id
FROM _demo_licenses AS license;

INSERT INTO license_devices (
  id, license_id, device_ref, device_public_key,
  status, binding_generation, activated_at
)
SELECT
  id, license_id,
  encode(digest(current_setting('emukey.seed_namespace') || ':device-ref:' || id::text, 'sha256'), 'hex'),
  '0x' || substr(encode(digest(current_setting('emukey.seed_namespace') || ':device-key:' || id::text, 'sha256'), 'hex'), 1, 40),
  'ACTIVE', 1, now() - interval '12 hours'
FROM _demo_devices
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_commands ON COMMIT DROP AS
SELECT
  license.i,
  md5(current_setting('emukey.seed_namespace') || ':chain-command:' || license.i)::uuid AS id,
  license.id AS license_id,
  license.provider_user_id,
  license.origin_order_id
FROM _demo_licenses AS license;

INSERT INTO chain_commands (
  id, idempotency_key, command_type, provider_user_id, order_id, license_id,
  network, chain_id, contract_address, payload, payload_hash, status,
  nonce, transaction_hash, attempt_count, submitted_at, confirmed_at
)
SELECT
  id,
  md5(current_setting('emukey.seed_namespace') || ':chain-idempotency:' || i)::uuid,
  'ISSUE_LICENSE', provider_user_id, origin_order_id, license_id,
  'demo-local', 31337,
  '0x' || substr(md5(current_setting('emukey.seed_namespace') || ':contract-a') || md5(current_setting('emukey.seed_namespace') || ':contract-b'), 1, 40),
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'licenseId', license_id),
  digest(current_setting('emukey.seed_namespace') || ':payload:' || i, 'sha256'),
  'CONFIRMED', i,
  '0x' || encode(digest(current_setting('emukey.seed_namespace') || ':transaction:' || i, 'sha256'), 'hex'),
  1, now() - interval '10 hours', now() - interval '9 hours'
FROM _demo_commands
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_events ON COMMIT DROP AS
SELECT
  command.i,
  md5(current_setting('emukey.seed_namespace') || ':chain-event:' || command.i)::uuid AS id,
  command.id AS chain_command_id,
  command.provider_user_id,
  command.license_id
FROM _demo_commands AS command;

INSERT INTO chain_events (
  id, chain_command_id, event_type, provider_user_id, license_id, network,
  chain_id, contract_address, transaction_hash, log_index, block_number,
  block_hash, confirmation_count, finality_status, payload, observed_at,
  finalized_at
)
SELECT
  id, chain_command_id, 'LICENSE_ISSUED', provider_user_id, license_id,
  'demo-local', 31337,
  '0x' || substr(md5(current_setting('emukey.seed_namespace') || ':contract-a') || md5(current_setting('emukey.seed_namespace') || ':contract-b'), 1, 40),
  '0x' || encode(digest(current_setting('emukey.seed_namespace') || ':transaction:' || i, 'sha256'), 'hex'),
  0, 1000 + i,
  '0x' || encode(digest(current_setting('emukey.seed_namespace') || ':block:' || i, 'sha256'), 'hex'),
  12, 'CONFIRMED',
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'licenseId', license_id),
  now() - interval '9 hours', now() - interval '8 hours'
FROM _demo_events
ON CONFLICT (id) DO NOTHING;

UPDATE licenses AS license
SET last_applied_chain_event_id = event.id, updated_at = now()
FROM _demo_events AS event
WHERE license.id = event.license_id;

CREATE TEMP TABLE _demo_documents ON COMMIT DROP AS
SELECT
  product.i,
  md5(current_setting('emukey.seed_namespace') || ':knowledge-document:' || product.i)::uuid AS id,
  product.id AS product_id,
  provider.id AS provider_user_id,
  product.name AS product_name
FROM _demo_products AS product
JOIN _demo_providers AS provider ON provider.i = product.provider_index;

INSERT INTO knowledge_documents (
  id, provider_user_id, product_id, logical_document_key, version,
  source_type, title, storage_key, storage_mime_type, storage_size_bytes,
  checksum, status, is_current
)
SELECT
  id, provider_user_id, product_id,
  'demo-guide-' || lpad(i::text, 2, '0'), 1, 'TXT',
  'Hướng dẫn sử dụng ' || product_name,
  'demo/knowledge/' || id || '.txt', 'text/plain', 2048 + i,
  digest(current_setting('emukey.seed_namespace') || ':document:' || i, 'sha256'),
  'READY', true
FROM _demo_documents
ON CONFLICT (id) DO NOTHING;

INSERT INTO knowledge_chunks (
  id, document_id, chunk_index, content, token_count, source_metadata
)
SELECT
  md5(current_setting('emukey.seed_namespace') || ':knowledge-chunk:' || i)::uuid,
  id, 0,
  'Nội dung minh họa cho ' || product_name || ': cài đặt, kích hoạt và quản lý license.',
  24,
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'page', 1)
FROM _demo_documents
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _demo_conversations ON COMMIT DROP AS
SELECT
  series.i,
  md5(current_setting('emukey.seed_namespace') || ':conversation:' || series.i)::uuid AS id,
  customer.id AS customer_user_id
FROM generate_series(1, 40) AS series(i)
JOIN _demo_customers AS customer ON customer.i = ((series.i - 1) % 30) + 1;

INSERT INTO conversations (
  id, customer_user_id, status, version, title, context_type, last_message_at
)
SELECT
  id, customer_user_id, 'AI_ACTIVE', 1,
  'Trao đổi minh họa ' || lpad(i::text, 2, '0'), 'GENERAL', now() - make_interval(hours => i)
FROM _demo_conversations
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (
  id, conversation_id, sender_user_id, sender_type, client_message_id,
  server_sequence, content, sources
)
SELECT
  md5(current_setting('emukey.seed_namespace') || ':message:' || i)::uuid,
  id, customer_user_id, 'CUSTOMER',
  md5(current_setting('emukey.seed_namespace') || ':client-message:' || i)::uuid,
  1, 'Tôi cần hướng dẫn kích hoạt sản phẩm minh họa số ' || i || '.',
  jsonb_build_array(jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace')))
FROM _demo_conversations
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (
  id, user_id, event_key, type, title, content, data, channel,
  delivery_status, attempt_count, is_read, sent_at
)
SELECT
  md5(current_setting('emukey.seed_namespace') || ':notification:' || i)::uuid,
  id, 'demo-notification-' || lpad(i::text, 2, '0'), 'LICENSE_ACTIVE',
  'License đã sẵn sàng', 'License minh họa của bạn đã được kích hoạt.',
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'index', i),
  'IN_APP', 'SENT', 1, i % 3 = 0, now() - make_interval(hours => i)
FROM (
  SELECT row_number() OVER (ORDER BY id)::int AS i, id
  FROM users WHERE email::text LIKE '%@demo.emukey.local'
) AS demo_users
ON CONFLICT (id) DO NOTHING;

INSERT INTO mobile_push_tokens (
  id, user_id, token, provider, status, last_seen_at
)
SELECT
  md5(current_setting('emukey.seed_namespace') || ':push-token:' || i)::uuid,
  id, 'demo-push-' || encode(digest(current_setting('emukey.seed_namespace') || ':push:' || i, 'sha256'), 'hex'),
  'EXPO', 'ACTIVE', now() - make_interval(hours => i)
FROM (
  SELECT row_number() OVER (ORDER BY id)::int AS i, id
  FROM users WHERE email::text LIKE '%@demo.emukey.local'
) AS demo_users
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit_logs (
  actor_user_id, actor_role, action, target_type,
  target_id, outcome, metadata
)
SELECT
  customer.id, 'CUSTOMER', 'DEMO_DATA_CREATED', 'ORDER',
  md5(current_setting('emukey.seed_namespace') || ':order:' || demo_row.i)::uuid, 'SUCCESS',
  jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace'), 'index', demo_row.i)
FROM generate_series(1, 40) AS demo_row(i)
JOIN _demo_customers AS customer ON customer.i = ((demo_row.i - 1) % 30) + 1
WHERE NOT EXISTS (
  SELECT 1 FROM audit_logs AS audit
  WHERE audit.metadata ->> 'seedNamespace' = current_setting('emukey.seed_namespace')
    AND audit.metadata ->> 'index' = demo_row.i::text
);
`;

const COUNT_SQL = String.raw`
SELECT table_name, row_count::int
FROM (
  SELECT 'users' AS table_name, count(*) AS row_count FROM users WHERE email::text LIKE '%@demo.emukey.local'
  UNION ALL SELECT 'products', count(*) FROM products WHERE code::text LIKE 'DEMO_%'
  UNION ALL SELECT 'plans', count(*) FROM plans WHERE code::text LIKE 'DEMO_PLAN_%'
  UNION ALL SELECT 'orders', count(*) FROM orders WHERE order_number LIKE 'DEMO-%'
  UNION ALL SELECT 'payment_attempts', count(*) FROM payment_attempts WHERE provider_reference LIKE 'DEMO-PAY-%'
  UNION ALL SELECT 'payment_transactions', count(*) FROM payment_transactions WHERE provider_event_id LIKE 'DEMO-EVENT-%'
  UNION ALL SELECT 'licenses', count(*) FROM licenses WHERE public_license_id LIKE 'EMU-DEMO-%'
  UNION ALL SELECT 'license_devices', count(*) FROM license_devices d JOIN licenses l ON l.id=d.license_id WHERE l.public_license_id LIKE 'EMU-DEMO-%'
  UNION ALL SELECT 'chain_commands', count(*) FROM chain_commands WHERE payload ->> 'seedNamespace' = current_setting('emukey.seed_namespace')
  UNION ALL SELECT 'chain_events', count(*) FROM chain_events WHERE payload ->> 'seedNamespace' = current_setting('emukey.seed_namespace')
  UNION ALL SELECT 'knowledge_documents', count(*) FROM knowledge_documents WHERE logical_document_key LIKE 'demo-guide-%'
  UNION ALL SELECT 'knowledge_chunks', count(*) FROM knowledge_chunks WHERE source_metadata ->> 'seedNamespace' = current_setting('emukey.seed_namespace')
  UNION ALL SELECT 'conversations', count(*) FROM conversations WHERE title LIKE 'Trao đổi minh họa %'
  UNION ALL SELECT 'messages', count(*) FROM messages WHERE sources @> jsonb_build_array(jsonb_build_object('seedNamespace', current_setting('emukey.seed_namespace')))
  UNION ALL SELECT 'notifications', count(*) FROM notifications WHERE event_key LIKE 'demo-notification-%'
  UNION ALL SELECT 'mobile_push_tokens', count(*) FROM mobile_push_tokens WHERE token LIKE 'demo-push-%'
  UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs WHERE metadata ->> 'seedNamespace' = current_setting('emukey.seed_namespace')
) AS counts
ORDER BY table_name;
`;

function usage() {
  console.log(`Usage:
  node --env-file-if-exists=backend/.env seed-demo-data.mjs --yes

Options:
  --yes               Confirm writing demo data to DATABASE_URL.
  --skip-image-check  Skip the live image URL check (intended for automated tests).
  --print-accounts    Print every generated demo login email.

Safety:
  NODE_ENV must be development. The script is idempotent and does not delete rows.
  All generated accounts use the password ${ACCOUNT_PASSWORD}.`);
}

async function checkImage(url) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });
  const contentType = response.headers.get('content-type') ?? '';
  await response.body?.cancel();
  if (!response.ok || !contentType.startsWith('image/')) {
    throw new Error(
      `Image check failed (${response.status}, ${contentType || 'unknown type'}): ${url}`,
    );
  }
}

async function checkImages() {
  for (let offset = 0; offset < IMAGE_URLS.length; offset += 8) {
    await Promise.all(IMAGE_URLS.slice(offset, offset + 8).map(checkImage));
  }
}

async function run() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    usage();
    return;
  }
  if (!args.has('--yes')) {
    usage();
    throw new Error('Refusing to write without --yes');
  }
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Demo seed is allowed only when NODE_ENV=development');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  if (!args.has('--skip-image-check')) {
    await checkImages();
    console.log(`Verified ${IMAGE_URLS.length} live product image URLs.`);
  }

  const passwordHash = await argon2.hash(ACCOUNT_PASSWORD, {
    memoryCost: 19_456,
    parallelism: 1,
    timeCost: 2,
  });
  const database = new Client({
    application_name: 'emukey-demo-seed',
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await database.connect();
    const preflight = await database.query(`
      SELECT
        current_database() AS database,
        (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public') AS tables,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_url'
        ) AS has_image_url
    `);
    const target = preflight.rows[0];
    if (Number(target?.tables) !== 18 || target?.has_image_url !== true) {
      throw new Error('Database does not match the current EmuKey schema; run db:verify first');
    }

    await database.query('BEGIN');
    try {
      await database.query(
        `SELECT pg_advisory_xact_lock(hashtext($1)),
                 set_config('emukey.seed_namespace', $1, true),
                 set_config('emukey.seed_password_hash', $2, true),
                 set_config('emukey.seed_activations', $3, true)`,
        [SEED_NAMESPACE, passwordHash, JSON.stringify(ACTIVATION_FIXTURES)],
      );
      await database.query(SEED_SQL);
      const countsResult = await database.query(COUNT_SQL);
      const counts = Object.fromEntries(
        countsResult.rows.map((row) => [row.table_name, Number(row.row_count)]),
      );
      for (const [table, expected] of Object.entries(TABLE_EXPECTATIONS)) {
        if (counts[table] !== expected) {
          throw new Error(
            `Seed verification failed for ${table}: expected ${expected}, received ${counts[table] ?? 0}`,
          );
        }
      }

      const loginResult = await database.query(`
        SELECT DISTINCT ON (role) role, email::text AS email, password_hash
        FROM users
        WHERE email::text LIKE '%@demo.emukey.local'
        ORDER BY role, email
      `);
      const passwordStats = await database.query(`
        SELECT count(*)::int AS accounts,
               count(DISTINCT password_hash)::int AS distinct_hashes
        FROM users
        WHERE email::text LIKE '%@demo.emukey.local'
      `);
      if (
        loginResult.rows.length !== 4 ||
        passwordStats.rows[0]?.accounts !== TABLE_EXPECTATIONS.users ||
        passwordStats.rows[0]?.distinct_hashes !== 1 ||
        !(await argon2.verify(loginResult.rows[0].password_hash, ACCOUNT_PASSWORD))
      ) {
        throw new Error('Generated account password verification failed');
      }

      const customerLicenses = await database.query(`
        SELECT order_row.id AS "orderId",
               order_row.order_number AS "orderNumber",
               customer.email::text AS "customerEmail",
               activation.activation_key AS "activationKey"
        FROM _demo_orders AS demo
        JOIN orders AS order_row ON order_row.id = demo.id
        JOIN users AS customer ON customer.id = demo.customer_user_id
        JOIN jsonb_to_recordset(current_setting('emukey.seed_activations')::jsonb)
          AS activation(i integer, activation_key text, activation_commitment text)
          ON activation.i = demo.i
        ORDER BY demo.i
        LIMIT 3
      `);

      await database.query('COMMIT');
      console.log(
        JSON.stringify(
          {
            database: target.database,
            password: ACCOUNT_PASSWORD,
            sampleAccounts: loginResult.rows.map(({ email, role }) => ({
              email,
              role,
            })),
            sampleCustomerLicenses: customerLicenses.rows,
            seededRows: counts,
          },
          null,
          2,
        ),
      );

      if (args.has('--print-accounts')) {
        const accounts = await database.query(`
          SELECT role, email::text AS email
          FROM users
          WHERE email::text LIKE '%@demo.emukey.local'
          ORDER BY role, email
        `);
        console.table(accounts.rows);
      }
    } catch (error) {
      await database.query('ROLLBACK');
      throw error;
    }
  } finally {
    await database.end();
  }
}

await run();
