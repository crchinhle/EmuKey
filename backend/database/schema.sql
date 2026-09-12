-- License Management — account-linked buyer, relayer-only blockchain schema v7.1
-- PostgreSQL 15+
-- Target baseline 11/09/2026.
-- Current schema has 18 tables. Buyer accounts are retained; Customer Controller/KMS are removed.
-- Smart-contract policy/ABI is authoritative for License/Device rights.
-- PostgreSQL owns private identity/catalog/commerce/audit plus chain projection/evidence.
-- Global License Terms content is a versioned application artefact, not a DB table.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Login identity for internal users and Buyers.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    status VARCHAR(40) NOT NULL,
    customer_type VARCHAR(20),
    email_verified_at TIMESTAMPTZ,
    session_version INT NOT NULL DEFAULT 1,
    organization_name VARCHAR(255),
    representative_name VARCHAR(255),
    tax_code VARCHAR(50),
    phone VARCHAR(30),
    address TEXT,
    provider_chain_address VARCHAR(42),
    provider_chain_namespace VARCHAR(120),
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_users_role CHECK (
        role IN ('SYSTEM_ADMIN', 'PROVIDER_ADMIN', 'CUSTOMER', 'SUPPORT_STAFF')
    ),
    CONSTRAINT uq_users_id_role UNIQUE (id, role),
    CONSTRAINT ck_users_status CHECK (
        status IN ('PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED')
    ),
    CONSTRAINT ck_users_session_version CHECK (session_version > 0),
    CONSTRAINT ck_users_provider_fields CHECK (
        (role = 'PROVIDER_ADMIN' AND organization_name IS NOT NULL AND
            provider_chain_address IS NOT NULL AND provider_chain_namespace IS NOT NULL) OR
        (role <> 'PROVIDER_ADMIN' AND provider_chain_address IS NULL AND provider_chain_namespace IS NULL)
    ),
    CONSTRAINT ck_users_customer_fields CHECK (
        (role = 'CUSTOMER' AND customer_type IN ('INDIVIDUAL', 'STUDENT', 'BUSINESS')) OR
        (role <> 'CUSTOMER' AND customer_type IS NULL)
    ),
    CONSTRAINT ck_users_email_verification CHECK (
        (role = 'CUSTOMER' AND status = 'PENDING_EMAIL_VERIFICATION' AND email_verified_at IS NULL) OR
        (role = 'CUSTOMER' AND status <> 'PENDING_EMAIL_VERIFICATION' AND email_verified_at IS NOT NULL) OR
        role <> 'CUSTOMER'
    ),
    CONSTRAINT ck_users_provider_address CHECK (
        provider_chain_address IS NULL OR provider_chain_address ~ '^0x[0-9a-fA-F]{40}$'
    ),
    CONSTRAINT ck_users_login_counters CHECK (failed_login_count >= 0),
    CONSTRAINT uq_users_provider_identity UNIQUE (id, role, provider_chain_address, provider_chain_namespace)
);

CREATE UNIQUE INDEX uq_users_provider_chain_address
    ON users (provider_chain_address) WHERE provider_chain_address IS NOT NULL;
CREATE UNIQUE INDEX uq_users_provider_chain_namespace
    ON users (provider_chain_namespace) WHERE provider_chain_namespace IS NOT NULL;

-- 2. Provider-scoped Product.
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_user_id UUID NOT NULL,
    provider_role VARCHAR(30) GENERATED ALWAYS AS ('PROVIDER_ADMIN') STORED,
    code CITEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_products_provider
        FOREIGN KEY (provider_user_id, provider_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT uq_products_provider_code UNIQUE (provider_user_id, code),
    CONSTRAINT uq_products_id_provider UNIQUE (id, provider_user_id),
    CONSTRAINT ck_products_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT ck_products_publish CHECK (
        (status = 'PUBLISHED' AND published_at IS NOT NULL) OR status <> 'PUBLISHED'
    )
);

-- 4. Published Plan is immutable at application level. A changed rights/Terms set
-- creates a new version row. Terms content itself is a versioned application artefact.
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    provider_user_id UUID NOT NULL,
    provider_role VARCHAR(30) GENERATED ALWAYS AS ('PROVIDER_ADMIN') STORED,
    code CITEXT NOT NULL,
    version INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL,
    duration_months INT NOT NULL,
    price_vnd BIGINT NOT NULL,
    max_active_devices INT NOT NULL,
    entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
    terms_version INT NOT NULL,
    terms_hash BYTEA NOT NULL,
    plan_commitment BYTEA NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_plans_product
        FOREIGN KEY (product_id, provider_user_id)
        REFERENCES products(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_plans_provider
        FOREIGN KEY (provider_user_id, provider_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT uq_plans_product_code_version UNIQUE (product_id, code, version),
    CONSTRAINT uq_plans_id_provider UNIQUE (id, provider_user_id),
    CONSTRAINT uq_plans_id_product_provider_commitment
        UNIQUE (id, product_id, provider_user_id, plan_commitment),
    CONSTRAINT ck_plans_version CHECK (version > 0 AND terms_version > 0),
    CONSTRAINT ck_plans_billing_cycle CHECK (billing_cycle IN ('MONTHLY', 'YEARLY')),
    CONSTRAINT ck_plans_duration CHECK (
        (billing_cycle = 'MONTHLY' AND duration_months = 1) OR
        (billing_cycle = 'YEARLY' AND duration_months = 12)
    ),
    CONSTRAINT ck_plans_values CHECK (price_vnd > 0 AND max_active_devices > 0),
    CONSTRAINT ck_plans_hashes CHECK (
        octet_length(terms_hash) = 32 AND octet_length(plan_commitment) = 32
    ),
    CONSTRAINT ck_plans_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT ck_plans_publish CHECK (
        (status = 'PUBLISHED' AND published_at IS NOT NULL) OR status <> 'PUBLISHED'
    )
);

-- 4. Buyer-owned commerce order.
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    idempotency_key UUID NOT NULL,
    customer_user_id UUID NOT NULL,
    customer_role VARCHAR(30) GENERATED ALWAYS AS ('CUSTOMER') STORED,
    provider_user_id UUID NOT NULL,
    provider_role VARCHAR(30) GENERATED ALWAYS AS ('PROVIDER_ADMIN') STORED,
    product_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    target_license_id UUID,
    order_type VARCHAR(20) NOT NULL,
    order_status VARCHAR(40) NOT NULL DEFAULT 'WAITING_TERMS_ACCEPTANCE',
    provider_name_snapshot VARCHAR(255) NOT NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    plan_name_snapshot VARCHAR(255) NOT NULL,
    plan_version_snapshot INT NOT NULL,
    price_vnd_snapshot BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    billing_cycle_snapshot VARCHAR(20) NOT NULL,
    duration_months_snapshot INT NOT NULL,
    max_active_devices_snapshot INT NOT NULL,
    entitlements_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    terms_version_snapshot INT NOT NULL,
    terms_hash_snapshot BYTEA NOT NULL,
    plan_commitment_snapshot BYTEA NOT NULL,
    payment_due_at TIMESTAMPTZ NOT NULL,
    terms_accepted_at TIMESTAMPTZ,
    payment_accepted_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_orders_provider
        FOREIGN KEY (provider_user_id, provider_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_user_id, customer_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_product
        FOREIGN KEY (product_id, provider_user_id)
        REFERENCES products(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_plan
        FOREIGN KEY (plan_id, product_id, provider_user_id, plan_commitment_snapshot)
        REFERENCES plans(id, product_id, provider_user_id, plan_commitment) ON DELETE RESTRICT,
    CONSTRAINT uq_orders_id_provider UNIQUE (id, provider_user_id),
    CONSTRAINT uq_orders_id_customer UNIQUE (id, customer_user_id),
    CONSTRAINT uq_orders_customer_idempotency UNIQUE (customer_user_id, idempotency_key),
    CONSTRAINT uq_orders_id_provider_customer_target_type
        UNIQUE (id, provider_user_id, customer_user_id, target_license_id, order_type),
    CONSTRAINT uq_orders_id_provider_target_type
        UNIQUE (id, provider_user_id, target_license_id, order_type),
    CONSTRAINT ck_orders_type CHECK (order_type IN ('NEW_PURCHASE', 'RENEWAL')),
    CONSTRAINT ck_orders_status CHECK (
        order_status IN ('WAITING_TERMS_ACCEPTANCE', 'WAITING_PAYMENT', 'PAYMENT_ACCEPTED', 'CANCELLED', 'EXPIRED')
    ),
    CONSTRAINT ck_orders_snapshots CHECK (
        plan_version_snapshot > 0 AND price_vnd_snapshot > 0 AND currency = 'VND' AND
        duration_months_snapshot > 0 AND max_active_devices_snapshot > 0 AND
        terms_version_snapshot > 0 AND octet_length(terms_hash_snapshot) = 32 AND
        octet_length(plan_commitment_snapshot) = 32
    ),
    CONSTRAINT ck_orders_terms_gate CHECK (
        (order_status = 'WAITING_TERMS_ACCEPTANCE' AND terms_accepted_at IS NULL) OR
        (order_status <> 'WAITING_TERMS_ACCEPTANCE' AND terms_accepted_at IS NOT NULL)
    ),
    CONSTRAINT ck_orders_payment_gate CHECK (
        (order_status = 'PAYMENT_ACCEPTED' AND payment_accepted_at IS NOT NULL) OR
        order_status <> 'PAYMENT_ACCEPTED'
    ),
    CONSTRAINT ck_orders_cancelled CHECK (
        (order_status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR order_status <> 'CANCELLED'
    ),
    CONSTRAINT ck_orders_renewal_shape CHECK (
        (order_type = 'NEW_PURCHASE' AND target_license_id IS NULL) OR
        (order_type = 'RENEWAL' AND target_license_id IS NOT NULL)
    )
);

-- 6. Checkout attempts are independent from durable provider transaction events.
CREATE TABLE payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    attempt_no INT NOT NULL,
    provider_reference VARCHAR(160) NOT NULL UNIQUE,
    amount_vnd BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    succeeded_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_payment_attempts_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    CONSTRAINT uq_payment_attempts_id_order UNIQUE (id, order_id),
    CONSTRAINT uq_payment_attempts_order_no UNIQUE (order_id, attempt_no),
    CONSTRAINT ck_payment_attempts_values CHECK (attempt_no > 0 AND amount_vnd > 0),
    CONSTRAINT ck_payment_attempts_status CHECK (
        status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'SUPERSEDED')
    ),
    CONSTRAINT ck_payment_attempts_success CHECK (
        (status = 'SUCCEEDED' AND succeeded_at IS NOT NULL) OR status <> 'SUCCEEDED'
    )
);

-- 7. Every SePay/IPN event is durable and idempotent; abnormal events can be reviewed.
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_event_id VARCHAR(180) NOT NULL UNIQUE,
    provider_transaction_ref VARCHAR(180),
    order_id UUID,
    payment_attempt_id UUID,
    amount_vnd BIGINT NOT NULL,
    classification VARCHAR(40) NOT NULL,
    review_status VARCHAR(30),
    review_reason TEXT,
    raw_payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    reviewed_by_user_id UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_payment_transactions_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_transactions_attempt_order
        FOREIGN KEY (payment_attempt_id, order_id)
        REFERENCES payment_attempts(id, order_id) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_transactions_reviewer
        FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_payment_transactions_amount CHECK (amount_vnd > 0),
    CONSTRAINT ck_payment_transactions_classification CHECK (
        classification IN ('MATCHED', 'DUPLICATE', 'UNMATCHED', 'AMOUNT_MISMATCH', 'INVALID')
    ),
    CONSTRAINT ck_payment_transactions_review CHECK (
        review_status IS NULL OR review_status IN ('OPEN', 'RESOLVED', 'CLOSED_NO_ACTION')
    ),
    CONSTRAINT ck_payment_transactions_matched CHECK (
        classification <> 'MATCHED' OR (order_id IS NOT NULL AND payment_attempt_id IS NOT NULL)
    ),
    CONSTRAINT ck_payment_transactions_attempt_order CHECK (
        payment_attempt_id IS NULL OR order_id IS NOT NULL
    )
);

-- 8. Business License projection. Technical chain retry/finality metadata lives in chain_commands/events.
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_license_id VARCHAR(80) NOT NULL UNIQUE,
    origin_order_id UUID NOT NULL UNIQUE,
    provider_user_id UUID NOT NULL,
    provider_role VARCHAR(30) GENERATED ALWAYS AS ('PROVIDER_ADMIN') STORED,
    customer_user_id UUID NOT NULL,
    customer_role VARCHAR(30) GENERATED ALWAYS AS ('CUSTOMER') STORED,
    product_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    plan_commitment BYTEA NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_ONCHAIN',
    period_start TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    max_active_devices INT NOT NULL,
    activation_commitment BYTEA NOT NULL,
    activation_key_version INT NOT NULL DEFAULT 1,
    activation_key_last4 VARCHAR(4),
    entitlement_version INT NOT NULL DEFAULT 1,
    last_applied_chain_event_id UUID,
    suspended_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    status_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_licenses_origin_order
        FOREIGN KEY (origin_order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_licenses_provider
        FOREIGN KEY (provider_user_id, provider_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_licenses_customer
        FOREIGN KEY (customer_user_id, customer_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_licenses_product
        FOREIGN KEY (product_id, provider_user_id)
        REFERENCES products(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_licenses_plan
        FOREIGN KEY (plan_id, product_id, provider_user_id, plan_commitment)
        REFERENCES plans(id, product_id, provider_user_id, plan_commitment) ON DELETE RESTRICT,
    CONSTRAINT uq_licenses_id_provider UNIQUE (id, provider_user_id),
    CONSTRAINT uq_licenses_id_customer UNIQUE (id, customer_user_id),
    CONSTRAINT uq_licenses_id_provider_customer UNIQUE (id, provider_user_id, customer_user_id),
    CONSTRAINT uq_licenses_id_provider_origin_order
        UNIQUE (id, provider_user_id, origin_order_id),
    CONSTRAINT ck_licenses_status CHECK (
        status IN ('PENDING_ONCHAIN', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED')
    ),
    CONSTRAINT ck_licenses_values CHECK (
        expires_at > period_start AND max_active_devices > 0 AND
        activation_key_version > 0 AND entitlement_version > 0 AND
        octet_length(plan_commitment) = 32 AND octet_length(activation_commitment) = 32
    ),
    CONSTRAINT ck_licenses_last4 CHECK (
        activation_key_last4 IS NULL OR activation_key_last4 ~ '^[A-Za-z0-9]{4}$'
    ),
    CONSTRAINT ck_licenses_suspend_stamp CHECK (
        (status = 'SUSPENDED' AND suspended_at IS NOT NULL) OR status <> 'SUSPENDED'
    ),
    CONSTRAINT ck_licenses_revoke_stamp CHECK (
        (status = 'REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED'
    )
);

-- Renewal order target FK can be declared after License exists.
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_target_license
    FOREIGN KEY (target_license_id, provider_user_id, customer_user_id)
    REFERENCES licenses(id, provider_user_id, customer_user_id) ON DELETE RESTRICT;

-- 9. Device projection; raw hardware identifiers are prohibited.
CREATE TABLE license_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL,
    device_ref VARCHAR(128) NOT NULL,
    device_public_key TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_ONCHAIN',
    binding_generation INT NOT NULL DEFAULT 1,
    last_applied_chain_event_id UUID,
    activated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_license_devices_license
        FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE RESTRICT,
    CONSTRAINT uq_license_devices_ref UNIQUE (license_id, device_ref),
    CONSTRAINT uq_license_devices_id_license UNIQUE (id, license_id),
    CONSTRAINT ck_license_devices_status CHECK (
        status IN ('PENDING_ONCHAIN', 'ACTIVE', 'REVOKED')
    ),
    CONSTRAINT ck_license_devices_generation CHECK (binding_generation > 0),
    CONSTRAINT ck_license_devices_active_stamp CHECK (
        status <> 'ACTIVE' OR activated_at IS NOT NULL
    ),
    CONSTRAINT ck_license_devices_revoke_stamp CHECK (
        (status = 'REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED'
    )
);

-- 10. Durable command owner for relayer submit/retry/uncertain broadcast.
CREATE TABLE chain_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID NOT NULL UNIQUE,
    command_type VARCHAR(40) NOT NULL,
    provider_user_id UUID NOT NULL,
    order_id UUID,
    license_id UUID NOT NULL,
    license_device_id UUID,
    issue_order_id UUID GENERATED ALWAYS AS (
        CASE WHEN command_type = 'ISSUE_LICENSE' THEN order_id END
    ) STORED,
    renewal_order_id UUID GENERATED ALWAYS AS (
        CASE WHEN command_type = 'RENEW_LICENSE' THEN order_id END
    ) STORED,
    renewal_order_type VARCHAR(30) GENERATED ALWAYS AS (
        CASE WHEN command_type = 'RENEW_LICENSE' THEN 'RENEWAL' END
    ) STORED,
    network VARCHAR(40) NOT NULL,
    chain_id BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    payload JSONB NOT NULL,
    payload_hash BYTEA NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    relayer_address VARCHAR(42),
    nonce BIGINT,
    signed_transaction TEXT,
    transaction_hash VARCHAR(66),
    receipt_status VARCHAR(20),
    receipt_block_number BIGINT,
    receipt_block_hash VARCHAR(66),
    receipt_checked_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    locked_by VARCHAR(120),
    locked_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_chain_commands_provider
        FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_order_provider
        FOREIGN KEY (order_id, provider_user_id)
        REFERENCES orders(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_license_provider
        FOREIGN KEY (license_id, provider_user_id)
        REFERENCES licenses(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_device_license
        FOREIGN KEY (license_device_id, license_id)
        REFERENCES license_devices(id, license_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_issue_order_license
        FOREIGN KEY (license_id, provider_user_id, issue_order_id)
        REFERENCES licenses(id, provider_user_id, origin_order_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_renewal_order_license
        FOREIGN KEY (renewal_order_id, provider_user_id, license_id, renewal_order_type)
        REFERENCES orders(id, provider_user_id, target_license_id, order_type) ON DELETE RESTRICT,
    CONSTRAINT uq_chain_commands_id_provider_license UNIQUE (id, provider_user_id, license_id),
    CONSTRAINT uq_chain_commands_id_license_device UNIQUE (id, license_id, license_device_id),
    CONSTRAINT ck_chain_commands_type CHECK (
        command_type IN ('ISSUE_LICENSE', 'RENEW_LICENSE', 'SUSPEND_LICENSE', 'RESUME_LICENSE',
                         'REVOKE_LICENSE', 'ROTATE_KEY', 'ACTIVATE_DEVICE', 'REVOKE_DEVICE')
    ),
    CONSTRAINT ck_chain_commands_status CHECK (
        status IN ('PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN', 'CONFIRMED', 'RETRYABLE_FAILED', 'DEAD_LETTER')
    ),
    CONSTRAINT ck_chain_commands_values CHECK (
        chain_id > 0 AND attempt_count >= 0 AND octet_length(payload_hash) = 32 AND
        contract_address ~ '^0x[0-9a-fA-F]{40}$' AND
        (nonce IS NULL OR nonce >= 0) AND
        (relayer_address IS NULL OR relayer_address ~ '^0x[0-9a-fA-F]{40}$') AND
        (signed_transaction IS NULL OR signed_transaction ~ '^0x[0-9a-fA-F]+$') AND
        (receipt_status IS NULL OR receipt_status IN ('PENDING', 'SUCCESS', 'REVERTED')) AND
        (receipt_block_number IS NULL OR receipt_block_number >= 0) AND
        (receipt_block_hash IS NULL OR receipt_block_hash ~ '^0x[0-9a-fA-F]{64}$')
    ),
    CONSTRAINT ck_chain_commands_tx_hash CHECK (
        transaction_hash IS NULL OR transaction_hash ~ '^0x[0-9a-fA-F]{64}$'
    ),
    CONSTRAINT ck_chain_commands_subject CHECK (
        (command_type = 'ISSUE_LICENSE' AND order_id IS NOT NULL AND license_id IS NOT NULL AND license_device_id IS NULL) OR
        (command_type = 'RENEW_LICENSE' AND order_id IS NOT NULL AND license_device_id IS NULL) OR
        (command_type IN ('SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE', 'ROTATE_KEY')
            AND order_id IS NULL AND license_device_id IS NULL) OR
        (command_type IN ('ACTIVATE_DEVICE', 'REVOKE_DEVICE')
            AND order_id IS NULL AND license_device_id IS NOT NULL)
    ),
    CONSTRAINT ck_chain_commands_confirmed CHECK (
        (status = 'CONFIRMED' AND confirmed_at IS NOT NULL) OR status <> 'CONFIRMED'
    )
);

CREATE UNIQUE INDEX uq_chain_commands_tx_hash
    ON chain_commands (network, chain_id, transaction_hash)
    WHERE transaction_hash IS NOT NULL;

CREATE UNIQUE INDEX uq_chain_commands_relayer_nonce
    ON chain_commands (network, chain_id, relayer_address, nonce)
    WHERE relayer_address IS NOT NULL AND nonce IS NOT NULL;

-- 11. Durable RPC scan cursor and lease; Redis/BullMQ only trigger the scan.
CREATE TABLE chain_indexer_checkpoints (
    network VARCHAR(40) NOT NULL,
    chain_id BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    next_block BIGINT NOT NULL,
    last_scanned_block BIGINT,
    last_scanned_block_hash VARCHAR(66),
    locked_by VARCHAR(180),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (network, chain_id, contract_address),
    CONSTRAINT ck_chain_indexer_checkpoint_values CHECK (
        chain_id > 0 AND next_block >= 0 AND
        (last_scanned_block IS NULL OR last_scanned_block >= 0)
    ),
    CONSTRAINT ck_chain_indexer_checkpoint_shapes CHECK (
        contract_address ~ '^0x[0-9a-fA-F]{40}$' AND
        (last_scanned_block_hash IS NULL OR last_scanned_block_hash ~ '^0x[0-9a-fA-F]{64}$')
    )
);

-- 12. Indexed on-chain evidence. One command may have multiple observed events over time/reorg.
CREATE TABLE chain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_command_id UUID,
    event_type VARCHAR(40) NOT NULL,
    provider_user_id UUID NOT NULL,
    license_id UUID NOT NULL,
    license_device_id UUID,
    network VARCHAR(40) NOT NULL,
    chain_id BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(66) NOT NULL,
    confirmation_count INT NOT NULL DEFAULT 0,
    finality_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payload JSONB NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    finalized_at TIMESTAMPTZ,
    reorged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_chain_events_command_subject
        FOREIGN KEY (chain_command_id, provider_user_id, license_id)
        REFERENCES chain_commands(id, provider_user_id, license_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_events_command_device
        FOREIGN KEY (chain_command_id, license_id, license_device_id)
        REFERENCES chain_commands(id, license_id, license_device_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_events_provider
        FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_events_license_provider
        FOREIGN KEY (license_id, provider_user_id)
        REFERENCES licenses(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_events_device_license
        FOREIGN KEY (license_device_id, license_id)
        REFERENCES license_devices(id, license_id) ON DELETE RESTRICT,
    CONSTRAINT uq_chain_events_identity UNIQUE (
        network, chain_id, contract_address, transaction_hash, log_index
    ),
    CONSTRAINT uq_chain_events_id_license UNIQUE (id, license_id),
    CONSTRAINT uq_chain_events_id_device_license UNIQUE (id, license_device_id, license_id),
    CONSTRAINT ck_chain_events_type CHECK (
        event_type IN ('LICENSE_ISSUED', 'LICENSE_RENEWED', 'LICENSE_SUSPENDED', 'LICENSE_RESUMED',
                       'LICENSE_REVOKED', 'KEY_ROTATED', 'DEVICE_ACTIVATED', 'DEVICE_REVOKED')
    ),
    CONSTRAINT ck_chain_events_finality CHECK (
        finality_status IN ('PENDING', 'CONFIRMED', 'REORGED')
    ),
    CONSTRAINT ck_chain_events_values CHECK (
        chain_id > 0 AND log_index >= 0 AND block_number >= 0 AND confirmation_count >= 0 AND
        contract_address ~ '^0x[0-9a-fA-F]{40}$' AND
        transaction_hash ~ '^0x[0-9a-fA-F]{64}$' AND
        block_hash ~ '^0x[0-9a-fA-F]{64}$'
    ),
    CONSTRAINT ck_chain_events_device_shape CHECK (
        (event_type IN ('DEVICE_ACTIVATED', 'DEVICE_REVOKED') AND license_device_id IS NOT NULL) OR
        (event_type NOT IN ('DEVICE_ACTIVATED', 'DEVICE_REVOKED') AND license_device_id IS NULL)
    ),
    CONSTRAINT ck_chain_events_finalized_stamp CHECK (
        (finality_status = 'CONFIRMED' AND finalized_at IS NOT NULL) OR finality_status <> 'CONFIRMED'
    ),
    CONSTRAINT ck_chain_events_reorg_stamp CHECK (
        (finality_status = 'REORGED' AND reorged_at IS NOT NULL) OR finality_status <> 'REORGED'
    )
);

ALTER TABLE licenses
    ADD CONSTRAINT fk_licenses_last_chain_event
    FOREIGN KEY (last_applied_chain_event_id, id)
    REFERENCES chain_events(id, license_id) ON DELETE RESTRICT;

ALTER TABLE license_devices
    ADD CONSTRAINT fk_license_devices_last_chain_event
    FOREIGN KEY (last_applied_chain_event_id, id, license_id)
    REFERENCES chain_events(id, license_device_id, license_id) ON DELETE RESTRICT;

-- 12. Provider knowledge document; private storage metadata only.
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_user_id UUID NOT NULL,
    product_id UUID NOT NULL,
    logical_document_key VARCHAR(180) NOT NULL,
    version INT NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    storage_key TEXT,
    storage_mime_type VARCHAR(120),
    storage_size_bytes BIGINT,
    checksum BYTEA,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_knowledge_documents_provider
        FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_knowledge_documents_product
        FOREIGN KEY (product_id, provider_user_id)
        REFERENCES products(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT uq_knowledge_documents_version UNIQUE (provider_user_id, logical_document_key, version),
    CONSTRAINT ck_knowledge_documents_version CHECK (version > 0),
    CONSTRAINT ck_knowledge_documents_source CHECK (source_type IN ('FAQ', 'PDF', 'TXT')),
    CONSTRAINT ck_knowledge_documents_status CHECK (
        status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED')
    ),
    CONSTRAINT ck_knowledge_documents_current CHECK (NOT is_current OR status = 'READY'),
    CONSTRAINT ck_knowledge_documents_file_size CHECK (storage_size_bytes IS NULL OR storage_size_bytes > 0)
);

CREATE UNIQUE INDEX uq_knowledge_documents_one_current
    ON knowledge_documents (provider_user_id, logical_document_key)
    WHERE is_current;

-- 13. RAG chunks. Embedding dimension remains configuration-gated.
CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    token_count INT,
    embedding VECTOR,
    embedding_model VARCHAR(120),
    embedding_dimension INT,
    source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_knowledge_chunks_document
        FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    CONSTRAINT uq_knowledge_chunks_position UNIQUE (document_id, chunk_index),
    CONSTRAINT ck_knowledge_chunks_index CHECK (chunk_index >= 0),
    CONSTRAINT ck_knowledge_chunks_tokens CHECK (token_count IS NULL OR token_count >= 0),
    CONSTRAINT ck_knowledge_chunks_embedding CHECK (
        (embedding IS NULL AND embedding_model IS NULL AND embedding_dimension IS NULL) OR
        (embedding IS NOT NULL AND embedding_model IS NOT NULL AND embedding_dimension > 0 AND
            vector_dims(embedding) = embedding_dimension)
    )
);

-- 14. Unified AI/Support conversation lifecycle.
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_user_id UUID NOT NULL,
    customer_role VARCHAR(30) GENERATED ALWAYS AS ('CUSTOMER') STORED,
    assigned_support_user_id UUID,
    status VARCHAR(30) NOT NULL DEFAULT 'AI_ACTIVE',
    version INT NOT NULL DEFAULT 1,
    title VARCHAR(255),
    context_type VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
    context_id UUID,
    last_message_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_conversations_support
        FOREIGN KEY (assigned_support_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_conversations_customer
        FOREIGN KEY (customer_user_id, customer_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT ck_conversations_status CHECK (
        status IN ('AI_ACTIVE', 'WAITING_SUPPORT', 'SUPPORT_ACTIVE', 'CLOSED')
    ),
    CONSTRAINT ck_conversations_version CHECK (version > 0),
    CONSTRAINT ck_conversations_context CHECK (
        context_type IN ('GENERAL', 'PRODUCT', 'PLAN', 'ORDER', 'LICENSE') AND
        ((context_type = 'GENERAL' AND context_id IS NULL) OR
         (context_type <> 'GENERAL' AND context_id IS NOT NULL))
    ),
    CONSTRAINT ck_conversations_assignment CHECK (
        (status = 'SUPPORT_ACTIVE' AND assigned_support_user_id IS NOT NULL AND claimed_at IS NOT NULL) OR
        (status IN ('AI_ACTIVE', 'WAITING_SUPPORT') AND assigned_support_user_id IS NULL) OR
        status = 'CLOSED'
    )
);

-- 15. AI and Support share one ordered/idempotent timeline.
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_user_id UUID,
    sender_type VARCHAR(20) NOT NULL,
    client_message_id UUID,
    server_sequence BIGINT NOT NULL,
    content TEXT NOT NULL,
    model_name VARCHAR(120),
    grounded BOOLEAN,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT uq_messages_client_id UNIQUE (conversation_id, client_message_id),
    CONSTRAINT uq_messages_sequence UNIQUE (conversation_id, server_sequence),
    CONSTRAINT ck_messages_sender CHECK (sender_type IN ('BUYER', 'SUPPORT', 'AI', 'SYSTEM')),
    CONSTRAINT ck_messages_sequence CHECK (server_sequence > 0),
    CONSTRAINT ck_messages_sender_identity CHECK (
        (sender_type IN ('BUYER', 'SUPPORT') AND sender_user_id IS NOT NULL) OR
        (sender_type IN ('AI', 'SYSTEM') AND sender_user_id IS NULL)
    )
);

-- 16. Durable per-channel notification owner.
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_key VARCHAR(180) NOT NULL,
    type VARCHAR(60) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    channel VARCHAR(20) NOT NULL,
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_notifications_event_channel UNIQUE (event_key, channel),
    CONSTRAINT ck_notifications_channel CHECK (channel IN ('IN_APP', 'EMAIL', 'PUSH')),
    CONSTRAINT ck_notifications_delivery CHECK (
        delivery_status IN ('PENDING', 'SENT', 'RETRYABLE_FAILED', 'DEAD_LETTER')
    ),
    CONSTRAINT ck_notifications_attempts CHECK (attempt_count >= 0)
);

-- 17. Android push registration.
CREATE TABLE mobile_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    provider VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_seen_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_mobile_push_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ck_mobile_push_tokens_status CHECK (status IN ('ACTIVE', 'INVALID'))
);

-- 18. Append-only audit. Message body, secrets and private keys must be redacted.
CREATE TABLE audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id UUID,
    actor_role VARCHAR(30),
    actor_email_snapshot CITEXT,
    action VARCHAR(120) NOT NULL,
    target_type VARCHAR(80),
    target_id UUID,
    reason TEXT,
    outcome VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_audit_logs_actor_role CHECK (
        actor_role IS NULL OR actor_role IN ('SYSTEM_ADMIN', 'PROVIDER_ADMIN', 'CUSTOMER', 'SUPPORT_STAFF')
    ),
    CONSTRAINT ck_audit_logs_outcome CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED'))
);

-- Query and durable worker indexes.
CREATE INDEX ix_users_role_status ON users (role, status);
CREATE INDEX ix_products_provider_status ON products (provider_user_id, status, updated_at DESC);
CREATE INDEX ix_products_catalog ON products (status, published_at DESC);
CREATE INDEX ix_plans_product_catalog ON plans (product_id, status, price_vnd);
CREATE INDEX ix_plans_provider ON plans (provider_user_id, status, updated_at DESC);
CREATE INDEX ix_orders_customer_status ON orders (customer_user_id, order_status, created_at DESC);
CREATE INDEX ix_orders_provider_history ON orders (provider_user_id, created_at DESC);
CREATE INDEX ix_orders_status_due ON orders (order_status, payment_due_at);
CREATE INDEX ix_payment_attempts_order ON payment_attempts (order_id, created_at DESC);
CREATE INDEX ix_payment_transactions_review ON payment_transactions (review_status, received_at)
    WHERE review_status = 'OPEN';
CREATE INDEX ix_licenses_provider ON licenses (provider_user_id, status, expires_at);
CREATE INDEX ix_licenses_expiry ON licenses (status, expires_at);
CREATE INDEX ix_license_devices_license_status ON license_devices (license_id, status);
CREATE INDEX ix_chain_commands_retry ON chain_commands (status, next_attempt_at, created_at)
    WHERE status IN ('PENDING', 'SUBMITTED_UNKNOWN', 'RETRYABLE_FAILED');
CREATE INDEX ix_chain_commands_subject ON chain_commands (license_id, license_device_id, created_at DESC);
CREATE INDEX ix_chain_events_finality ON chain_events (network, chain_id, contract_address, finality_status, block_number);
CREATE INDEX ix_chain_events_license ON chain_events (license_id, block_number DESC, log_index DESC);
CREATE INDEX ix_knowledge_documents_product ON knowledge_documents (provider_user_id, product_id, status, is_current);
CREATE INDEX ix_conversations_customer ON conversations (customer_user_id, updated_at DESC);
CREATE INDEX ix_conversations_support_queue ON conversations (status, created_at)
    WHERE status IN ('WAITING_SUPPORT', 'SUPPORT_ACTIVE');
CREATE INDEX ix_messages_timeline ON messages (conversation_id, server_sequence);
CREATE INDEX ix_notifications_delivery ON notifications (delivery_status, next_attempt_at, created_at)
    WHERE delivery_status IN ('PENDING', 'RETRYABLE_FAILED');
CREATE INDEX ix_notifications_inbox ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX ix_mobile_push_tokens_user ON mobile_push_tokens (user_id, status);
CREATE INDEX ix_audit_logs_search ON audit_logs (created_at DESC, action, target_type);

COMMIT;
