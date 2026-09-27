-- ==============================================================================
-- KRISHNA ENGINEERING - DELIVERY CHALLAN DATABASE MIGRATION SCRIPT
-- ==============================================================================
-- Delivery Challans are used to document goods dispatch without GST/tax
-- (common for job-work, returnable items, or advance delivery before final invoicing).

-- 1. Create delivery_challans table
CREATE TABLE IF NOT EXISTS delivery_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_no text NOT NULL,
  challan_date date NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  buyer_order_no text,
  dispatch_through text DEFAULT 'ROAD',
  destination text DEFAULT 'COIMBATORE',
  vehicle_no text,
  purpose text DEFAULT 'Job Work', -- e.g. 'Job Work', 'Returnable', 'Sale on Approval', 'Sample'
  status text DEFAULT 'pending',   -- 'pending', 'delivered', 'converted'
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Create delivery_challan_items table
CREATE TABLE IF NOT EXISTS delivery_challan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id uuid REFERENCES delivery_challans(id) ON DELETE CASCADE,
  description text NOT NULL,
  hsn_sac text,
  quantity numeric NOT NULL DEFAULT 1,
  per text DEFAULT 'NOS',
  remarks text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Link invoices to delivery_challans (for "Convert to Invoice" feature)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS challan_id uuid REFERENCES delivery_challans(id) ON DELETE SET NULL;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challan_items ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'delivery_challans' AND policyname = 'authenticated_full_access'
  ) THEN
    CREATE POLICY "authenticated_full_access" 
    ON delivery_challans 
    FOR ALL 
    USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'delivery_challan_items' AND policyname = 'authenticated_full_access'
  ) THEN
    CREATE POLICY "authenticated_full_access" 
    ON delivery_challan_items 
    FOR ALL 
    USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_challans_client_id ON delivery_challans(client_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_created_at ON delivery_challans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_challan_items_challan_id ON delivery_challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_invoices_challan_id ON invoices(challan_id);
