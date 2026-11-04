CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.suppliers (
  id TEXT PRIMARY KEY DEFAULT ('sup-' || substr(md5(random()::text), 1, 10)),
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

CREATE TABLE IF NOT EXISTS public.medicines (
  id TEXT PRIMARY KEY DEFAULT ('med-' || substr(md5(random()::text), 1, 10)),
  sku TEXT UNIQUE NOT NULL,
  brand_name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General Medicine',
  dosage_form TEXT NOT NULL DEFAULT 'Tablet',
  strength TEXT NOT NULL DEFAULT 'Standard',
  unit TEXT NOT NULL DEFAULT 'Strips',
  barcode TEXT,
  minimum_stock_level INT NOT NULL DEFAULT 20,
  selling_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medicine_batches (
  id TEXT PRIMARY KEY DEFAULT ('bat-' || substr(md5(random()::text), 1, 10)),
  medicine_id TEXT NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  manufacturing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  selling_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  initial_quantity INT NOT NULL DEFAULT 0,
  available_quantity INT NOT NULL DEFAULT 0,
  supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_batch_available_qty CHECK (available_quantity >= 0),
  UNIQUE(medicine_id, batch_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_records (
  id TEXT PRIMARY KEY DEFAULT ('pur-' || substr(md5(random()::text), 1, 10)),
  medicine_id TEXT NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  medicine_name TEXT,
  supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_purchased INT NOT NULL,
  purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_purchase_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  invoice_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id TEXT PRIMARY KEY DEFAULT ('mov-' || substr(md5(random()::text), 1, 10)),
  medicine_id TEXT NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES public.medicine_batches(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('Purchase', 'Dispensing', 'Stock Adjustment', 'Return', 'Expired Stock', 'Damaged Stock')),
  quantity INT NOT NULL,
  reference_number TEXT NOT NULL,
  responsible_user TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.csv_import_logs (
  id TEXT PRIMARY KEY DEFAULT ('csv-' || substr(md5(random()::text), 1, 10)),
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
CREATE INDEX IF NOT EXISTS idx_medicines_supplier ON public.medicines(supplier_id);
CREATE INDEX IF NOT EXISTS idx_batches_medicine ON public.medicine_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.medicine_batches(expiry_date ASC);
CREATE INDEX IF NOT EXISTS idx_batches_fefo ON public.medicine_batches(medicine_id, expiry_date ASC, available_quantity DESC);
CREATE INDEX IF NOT EXISTS idx_movements_med_date ON public.stock_movements(medicine_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_med_date ON public.purchase_records(medicine_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);

CREATE OR REPLACE VIEW public.v_medicine_inventory_summary AS
SELECT
  m.id,
  m.sku,
  m.brand_name,
  m.generic_name,
  m.manufacturer,
  m.category,
  m.dosage_form,
  m.strength,
  m.unit,
  m.barcode,
  m.minimum_stock_level,
  m.selling_price,
  m.supplier_id,
  s.name AS supplier_name,
  s.phone AS supplier_phone,
  COALESCE(SUM(b.available_quantity), 0)::INT AS total_stock,
  COUNT(b.id)::INT AS batch_count,
  MIN(CASE WHEN b.available_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.expiry_date END) AS earliest_valid_expiry,
  CASE
    WHEN COALESCE(SUM(b.available_quantity), 0) = 0 THEN 'Out of Stock'
    WHEN COALESCE(SUM(b.available_quantity), 0) <= m.minimum_stock_level THEN 'Low Stock'
    ELSE 'Available'
  END AS stock_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.medicine_batches bx
      WHERE bx.medicine_id = m.id AND bx.available_quantity > 0 AND bx.expiry_date < CURRENT_DATE
    ) THEN 'Expired'
    WHEN EXISTS (
      SELECT 1 FROM public.medicine_batches byx
      WHERE byx.medicine_id = m.id AND byx.available_quantity > 0 AND byx.expiry_date <= (CURRENT_DATE + INTERVAL '60 days')
    ) THEN 'Near Expiry'
    ELSE 'Valid'
  END AS expiry_status,
  MAX(pr.purchase_price) AS last_purchase_price,
  MAX(pr.purchase_date) AS last_purchase_date
FROM public.medicines m
LEFT JOIN public.suppliers s ON m.supplier_id = s.id
LEFT JOIN public.medicine_batches b ON m.id = b.medicine_id
LEFT JOIN public.purchase_records pr ON m.id = pr.medicine_id
GROUP BY m.id, s.id;

CREATE OR REPLACE FUNCTION public.procure_batch_atomic(
  p_medicine_id TEXT,
  p_batch_number TEXT,
  p_manufacturing_date DATE,
  p_expiry_date DATE,
  p_purchase_price NUMERIC,
  p_selling_price NUMERIC,
  p_quantity INT,
  p_supplier_id TEXT DEFAULT NULL,
  p_supplier_name TEXT DEFAULT NULL,
  p_invoice_number TEXT DEFAULT NULL,
  p_responsible_user TEXT DEFAULT 'Staff Pharmacist'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id TEXT;
  v_purchase_id TEXT;
  v_movement_id TEXT;
  v_med_name TEXT;
  v_sup_id TEXT := p_supplier_id;
  v_sup_name TEXT := p_supplier_name;
  v_invoice TEXT := COALESCE(p_invoice_number, 'INV-' || to_char(CURRENT_DATE, 'YYMM') || '-' || substr(md5(random()::text), 1, 5));
BEGIN
  SELECT brand_name INTO v_med_name FROM public.medicines WHERE id = p_medicine_id;
  IF v_med_name IS NULL THEN
    RAISE EXCEPTION 'Medicine with ID % does not exist.', p_medicine_id;
  END IF;

  IF v_sup_id IS NULL AND v_sup_name IS NOT NULL AND trim(v_sup_name) != '' THEN
    SELECT id INTO v_sup_id FROM public.suppliers WHERE lower(name) = lower(trim(v_sup_name)) LIMIT 1;
    IF v_sup_id IS NULL THEN
      v_sup_id := 'sup-' || substr(md5(random()::text), 1, 10);
      INSERT INTO public.suppliers (id, name, phone, last_purchase_date, last_purchase_price)
      VALUES (v_sup_id, trim(v_sup_name), '+91 00000 00000', CURRENT_DATE, p_purchase_price);
    END IF;
  END IF;

  IF v_sup_id IS NOT NULL AND (v_sup_name IS NULL OR trim(v_sup_name) = '') THEN
    SELECT name INTO v_sup_name FROM public.suppliers WHERE id = v_sup_id;
  END IF;

  v_batch_id := 'bat-' || substr(md5(random()::text), 1, 10);
  INSERT INTO public.medicine_batches (
    id, medicine_id, batch_number, manufacturing_date, expiry_date,
    purchase_price, selling_price, initial_quantity, available_quantity,
    supplier_id, supplier_name
  ) VALUES (
    v_batch_id, p_medicine_id, trim(p_batch_number), p_manufacturing_date, p_expiry_date,
    p_purchase_price, p_selling_price, p_quantity, p_quantity,
    v_sup_id, v_sup_name
  );

  v_purchase_id := 'pur-' || substr(md5(random()::text), 1, 10);
  INSERT INTO public.purchase_records (
    id, medicine_id, medicine_name, supplier_id, supplier_name,
    batch_number, purchase_date, quantity_purchased, purchase_price,
    total_purchase_amount, invoice_number
  ) VALUES (
    v_purchase_id, p_medicine_id, v_med_name, v_sup_id, COALESCE(v_sup_name, 'Self-Procured'),
    trim(p_batch_number), CURRENT_DATE, p_quantity, p_purchase_price,
    (p_quantity * p_purchase_price), v_invoice
  );

  v_movement_id := 'mov-' || substr(md5(random()::text), 1, 10);
  INSERT INTO public.stock_movements (
    id, medicine_id, batch_id, movement_type, quantity,
    reference_number, responsible_user, date, notes
  ) VALUES (
    v_movement_id, p_medicine_id, v_batch_id, 'Purchase', p_quantity,
    v_invoice, p_responsible_user, now(), 'Procurement intake for batch ' || trim(p_batch_number)
  );

  IF v_sup_id IS NOT NULL THEN
    UPDATE public.suppliers
    SET last_purchase_date = CURRENT_DATE,
        last_purchase_price = p_purchase_price
    WHERE id = v_sup_id;
  END IF;

  UPDATE public.medicines
  SET updated_at = now()
  WHERE id = p_medicine_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'batch_id', v_batch_id,
    'purchase_id', v_purchase_id,
    'movement_id', v_movement_id,
    'batch_number', trim(p_batch_number),
    'quantity', p_quantity
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dispense_fefo_atomic(
  p_medicine_id TEXT,
  p_required_quantity INT,
  p_reference_number TEXT,
  p_responsible_user TEXT DEFAULT 'Staff Pharmacist',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining_needed INT := p_required_quantity;
  v_batch RECORD;
  v_deduct INT;
  v_total_available INT;
  v_dispensed_batches JSONB := '[]'::jsonb;
BEGIN
  IF p_required_quantity <= 0 THEN
    RAISE EXCEPTION 'Dispensing quantity must be greater than zero.';
  END IF;

  SELECT COALESCE(SUM(available_quantity), 0)
  INTO v_total_available
  FROM public.medicine_batches
  WHERE medicine_id = p_medicine_id
    AND available_quantity > 0
    AND expiry_date >= CURRENT_DATE;

  IF v_total_available < p_required_quantity THEN
    RAISE EXCEPTION 'Insufficient unexpired stock. Required: %, Available: %', p_required_quantity, v_total_available;
  END IF;

  FOR v_batch IN
    SELECT id, batch_number, available_quantity, expiry_date, selling_price
    FROM public.medicine_batches
    WHERE medicine_id = p_medicine_id
      AND available_quantity > 0
      AND expiry_date >= CURRENT_DATE
    ORDER BY expiry_date ASC, created_at ASC
  LOOP
    EXIT WHEN v_remaining_needed <= 0;

    IF v_batch.available_quantity >= v_remaining_needed THEN
      v_deduct := v_remaining_needed;
    ELSE
      v_deduct := v_batch.available_quantity;
    END IF;

    UPDATE public.medicine_batches
    SET available_quantity = available_quantity - v_deduct
    WHERE id = v_batch.id;

    INSERT INTO public.stock_movements (
      medicine_id, batch_id, movement_type, quantity,
      reference_number, responsible_user, date, notes
    ) VALUES (
      p_medicine_id, v_batch.id, 'Dispensing', -v_deduct,
      p_reference_number, p_responsible_user, now(),
      COALESCE(p_notes, 'FEFO Patient Prescription Dispensing')
    );

    v_dispensed_batches := v_dispensed_batches || jsonb_build_object(
      'batch_id', v_batch.id,
      'batch_number', v_batch.batch_number,
      'expiry_date', v_batch.expiry_date,
      'dispensed_quantity', v_deduct,
      'selling_price', v_batch.selling_price
    );

    v_remaining_needed := v_remaining_needed - v_deduct;
  END LOOP;

  UPDATE public.medicines
  SET updated_at = now()
  WHERE id = p_medicine_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'medicine_id', p_medicine_id,
    'total_dispensed', p_required_quantity,
    'batches_used', v_dispensed_batches
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stock_adjustment_atomic(
  p_medicine_id TEXT,
  p_batch_id TEXT,
  p_movement_type TEXT,
  p_quantity_change INT,
  p_reference_number TEXT,
  p_responsible_user TEXT DEFAULT 'Staff Pharmacist',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_batch_id TEXT := p_batch_id;
  v_current_qty INT;
BEGIN
  IF v_target_batch_id IS NULL THEN
    SELECT id INTO v_target_batch_id
    FROM public.medicine_batches
    WHERE medicine_id = p_medicine_id
    ORDER BY expiry_date ASC
    LIMIT 1;
  END IF;

  IF v_target_batch_id IS NOT NULL THEN
    SELECT available_quantity INTO v_current_qty
    FROM public.medicine_batches
    WHERE id = v_target_batch_id;

    IF (v_current_qty + p_quantity_change) < 0 THEN
      RAISE EXCEPTION 'Adjustment would result in negative batch quantity (% available, change %)', v_current_qty, p_quantity_change;
    END IF;

    UPDATE public.medicine_batches
    SET available_quantity = available_quantity + p_quantity_change
    WHERE id = v_target_batch_id;
  END IF;

  INSERT INTO public.stock_movements (
    medicine_id, batch_id, movement_type, quantity,
    reference_number, responsible_user, date, notes
  ) VALUES (
    p_medicine_id, v_target_batch_id, p_movement_type, p_quantity_change,
    p_reference_number, p_responsible_user, now(), p_notes
  );

  UPDATE public.medicines
  SET updated_at = now()
  WHERE id = p_medicine_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'medicine_id', p_medicine_id,
    'batch_id', v_target_batch_id,
    'quantity_change', p_quantity_change
  );
END;
$$;

ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_logs DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
