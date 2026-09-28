-- Migration 0005: Eligibility — rename accountType → costingSubType, new enum, new columns
--
-- The old costsim_account_type enum ("Cost Account", "Offset Account") is replaced
-- by costsim_costing_sub_type ("COST", "BAL", "OVERRIDE").
-- Three new columns added: ldg, sub_type_sequence, percentage.
-- Run this migration BEFORE redeploying the API.

-- 1. Create the new enum type
CREATE TYPE costsim_costing_sub_type AS ENUM ('COST', 'BAL', 'OVERRIDE');

-- 2. Add the new costing_sub_type column (nullable during migration)
ALTER TABLE costsim_eligibility
  ADD COLUMN IF NOT EXISTS costing_sub_type costsim_costing_sub_type;

-- 3. Back-fill from the old account_type column
UPDATE costsim_eligibility
  SET costing_sub_type = CASE
    WHEN account_type = 'Cost Account'   THEN 'COST'::costsim_costing_sub_type
    WHEN account_type = 'Offset Account' THEN 'BAL'::costsim_costing_sub_type
    ELSE 'COST'::costsim_costing_sub_type
  END;

-- 4. Add NOT NULL constraint now that all rows have a value
ALTER TABLE costsim_eligibility
  ALTER COLUMN costing_sub_type SET NOT NULL;

-- 5. Add new columns
ALTER TABLE costsim_eligibility
  ADD COLUMN IF NOT EXISTS ldg               TEXT,
  ADD COLUMN IF NOT EXISTS sub_type_sequence TEXT,
  ADD COLUMN IF NOT EXISTS percentage        REAL;

-- 6. Drop the old column (keep the old enum type in case a rollback is needed)
ALTER TABLE costsim_eligibility
  DROP COLUMN IF EXISTS account_type;

-- NOTE: The old costsim_account_type enum is intentionally left in place.
-- Drop it manually after confirming the migration is stable:
--   DROP TYPE IF EXISTS costsim_account_type;
