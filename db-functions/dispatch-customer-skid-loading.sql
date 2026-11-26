CREATE OR REPLACE FUNCTION dispatch_customer_skid_loading(p_loading_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_loading customer_skid_loadings%ROWTYPE;
BEGIN
  SELECT * INTO v_loading
  FROM customer_skid_loadings
  WHERE id = p_loading_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer skid loading not found'
      USING ERRCODE = 'P1001';
  END IF;

  IF v_loading.dispatched_at IS NOT NULL THEN
    RAISE EXCEPTION 'Customer skid loading has already been dispatched'
      USING ERRCODE = 'P1002';
  END IF;

  IF v_loading.state <> 'loaded' THEN
    RAISE EXCEPTION 'Customer skid must be loaded before it can be dispatched'
      USING ERRCODE = 'P1003';
  END IF;

  UPDATE customer_skid_loadings
  SET dispatched_at = NOW()
  WHERE id = p_loading_id;
END;
$$;
