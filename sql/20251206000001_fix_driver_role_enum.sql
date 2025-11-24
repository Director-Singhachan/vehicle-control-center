-- Fix: Add 'driver' to the app_role ENUM type
-- The previous script tried to add a check constraint, but the column is actually an ENUM type.
-- We need to add the value to the enum itself.

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'driver';
