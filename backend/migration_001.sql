-- New Liberia Restaurant & Bar — Migration 001
-- Run this once against your existing database to add everything needed
-- for Inventory, Staff & Drivers (with real accounts), Reservations,
-- Notifications, and driver delivery-assignment.
--
-- Safe to run more than once — every statement is written to skip
-- anything that already exists.

-- Add 'driver' as a valid user role (users table already covers
-- customer/staff/admin; drivers are just another role on the same table)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum WHERE enumlabel = 'driver'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'driver';
    END IF;
END$$;

-- Staff/driver profile fields, added directly to users so Staff & Drivers
-- accounts are real logins from day one (no more separately-generated
-- passwords living only in the browser)
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_role VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_status VARCHAR(30) NOT NULL DEFAULT 'Active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) NOT NULL DEFAULT 5.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deliveries_count INTEGER NOT NULL DEFAULT 0;

-- Delivery assignment lives directly on the order — which driver has it,
-- and where it is in the delivery lifecycle
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(30) NOT NULL DEFAULT 'unassigned';

-- =========================
-- INVENTORY
-- =========================
CREATE TABLE IF NOT EXISTS inventory_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(150) NOT NULL,
    qty         INTEGER NOT NULL DEFAULT 0,
    unit        VARCHAR(30) NOT NULL,
    threshold   INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- RESERVATIONS
-- =========================
CREATE TABLE IF NOT EXISTS reservations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID REFERENCES users(id),
    reservation_type  VARCHAR(50) NOT NULL DEFAULT 'table',
    customer_name     VARCHAR(150) NOT NULL,
    phone             VARCHAR(20),
    party_size        INTEGER NOT NULL DEFAULT 1,
    reservation_time  TIMESTAMPTZ NOT NULL,
    status            VARCHAR(30) NOT NULL DEFAULT 'pending',
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- NOTIFICATIONS (sent by admin to customers/staff/drivers)
-- =========================
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       VARCHAR(200) NOT NULL,
    message     TEXT NOT NULL,
    audience    VARCHAR(30) NOT NULL DEFAULT 'all',
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(reservation_time);
