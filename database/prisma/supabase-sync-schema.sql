-- Run in Supabase SQL Editor to provision sync tables used by server/routes/sync.js
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('CASH', 'CREDIT', 'BANK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_module AS ENUM ('CHEMICAL', 'REXINE', 'MATERIAL', 'LABOR', 'MISC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_source AS ENUM ('MANUAL', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS expense_entry (
  id uuid PRIMARY KEY,
  date timestamptz NOT NULL,
  party_id uuid,
  labor_id uuid,
  module expense_module NOT NULL DEFAULT 'MISC',
  payment_type payment_method NOT NULL DEFAULT 'CASH',
  amount numeric(18,4) NOT NULL,
  description text,
  chemical_purchase_id uuid,
  rexine_purchase_id uuid,
  material_purchase_id uuid,
  labor_advance_id uuid,
  source expense_source NOT NULL DEFAULT 'MANUAL',
  source_system text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS labor_advance (
  id uuid PRIMARY KEY,
  labor_id uuid NOT NULL,
  date timestamptz NOT NULL,
  amount numeric(18,4) NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chemical_purchase (
  id uuid PRIMARY KEY,
  date timestamptz NOT NULL,
  party_id uuid,
  quantity_kg numeric(18,4) NOT NULL,
  rate_per_kg numeric(18,4) NOT NULL,
  total_amount numeric(18,4) NOT NULL,
  payment_type payment_method NOT NULL DEFAULT 'CASH',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rexine_purchase (
  id uuid PRIMARY KEY,
  date timestamptz NOT NULL,
  party_id uuid,
  quantity_meter numeric(18,4) NOT NULL,
  rate_per_meter numeric(18,4) NOT NULL,
  total_amount numeric(18,4) NOT NULL,
  payment_type payment_method NOT NULL DEFAULT 'CASH',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_purchase (
  id uuid PRIMARY KEY,
  date timestamptz NOT NULL,
  party_id uuid,
  article_id uuid,
  unit_id uuid,
  quantity numeric(18,4) NOT NULL,
  price_per_unit numeric(18,4) NOT NULL,
  total_amount numeric(18,4) NOT NULL,
  payment_type payment_method NOT NULL DEFAULT 'CASH',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_log (
  id uuid PRIMARY KEY,
  entity text NOT NULL,
  entity_id text NOT NULL,
  operation text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced boolean NOT NULL DEFAULT true,
  device_id text NOT NULL
);

CREATE INDEX IF NOT EXISTS expense_entry_updated_at_idx ON expense_entry(updated_at);
CREATE INDEX IF NOT EXISTS labor_advance_updated_at_idx ON labor_advance(updated_at);
CREATE INDEX IF NOT EXISTS chemical_purchase_updated_at_idx ON chemical_purchase(updated_at);
CREATE INDEX IF NOT EXISTS rexine_purchase_updated_at_idx ON rexine_purchase(updated_at);
CREATE INDEX IF NOT EXISTS material_purchase_updated_at_idx ON material_purchase(updated_at);
CREATE INDEX IF NOT EXISTS change_log_created_at_idx ON change_log(created_at);
CREATE INDEX IF NOT EXISTS change_log_entity_entity_id_idx ON change_log(entity, entity_id);
