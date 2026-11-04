CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  gstin TEXT,
  last_purchase_date DATE,
  last_purchase_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medicine_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  contact_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  brand_name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  category TEXT NOT NULL,
  dosage_form TEXT NOT NULL,
  strength TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Units',
  barcode TEXT,
  minimum_stock_level INT NOT NULL DEFAULT 20,
  selling_price NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medicine_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  manufacturing_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  initial_quantity INT NOT NULL DEFAULT 0,
  available_quantity INT NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_batch_qty CHECK (available_quantity >= 0),
  UNIQUE(medicine_id, batch_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  batch_number TEXT NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_purchased INT NOT NULL,
  purchase_price NUMERIC(10, 2) NOT NULL,
  total_purchase_amount NUMERIC(12, 2) NOT NULL,
  invoice_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.medicine_batches(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL,
  quantity INT NOT NULL,
  reference_number TEXT NOT NULL,
  responsible_user TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.csv_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Success',
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medicines_sku ON public.medicines(sku);
CREATE INDEX IF NOT EXISTS idx_medicines_brand ON public.medicines(brand_name);
CREATE INDEX IF NOT EXISTS idx_medicines_generic ON public.medicines(generic_name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON public.medicines(category);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.medicine_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_medicine ON public.medicine_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_movements_medicine ON public.stock_movements(medicine_id);
CREATE INDEX IF NOT EXISTS idx_purchases_medicine ON public.purchase_records(medicine_id);

ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_logs DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

