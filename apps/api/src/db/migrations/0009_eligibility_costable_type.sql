-- Migration 0009: Element eligibility costing type model.
--   costing_type  = 'EL' (fixed Oracle type code, like PAY / ORG / JOB on the other tables)
--   costable_type = Costed | Fixed | Distributed (what costing_type used to hold)
-- costing_type was the enum costsim_costing_type (Any/Costed/Fixed/Distributed), which cannot
-- hold 'EL', so it becomes plain text. The old enum type is left in place.
-- Re-runnable: every statement is conditional.

ALTER TABLE costsim_eligibility ALTER COLUMN costing_type TYPE TEXT USING costing_type::text;

UPDATE costsim_eligibility SET costable_type = CASE
    WHEN costing_type  IN ('Costed','Fixed','Distributed') THEN costing_type   -- carry over the old value
    WHEN costable_type IN ('Costed','Fixed','Distributed') THEN costable_type  -- already migrated
    ELSE 'Costed'                                                              -- 'Any', NULL, or the 'EL' placeholder from 0006
  END;

UPDATE costsim_eligibility SET costing_type = 'EL' WHERE costing_type IS DISTINCT FROM 'EL';
