ALTER TABLE products ADD COLUMN IF NOT EXISTS base_price_minor integer CHECK (base_price_minor >= 0);
ALTER TABLE price_bands ADD COLUMN IF NOT EXISTS uplift_minor integer NOT NULL DEFAULT 0 CHECK (uplift_minor >= 0);
