CREATE OR REPLACE FUNCTION dispatch_customer_skid_visit(p_visit_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_visit customer_skid_visits%ROWTYPE;
BEGIN
  SELECT * INTO v_visit
  FROM customer_skid_visits
  WHERE id = p_visit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer skid visit not found'
      USING ERRCODE = 'P1001';
  END IF;

  IF v_visit.dispatched_at IS NOT NULL THEN
    RAISE EXCEPTION 'Customer skid visit has already been dispatched'
      USING ERRCODE = 'P1002';
  END IF;

  IF v_visit.state <> 'loaded' THEN
    RAISE EXCEPTION 'Customer skid must be loaded before it can be dispatched'
      USING ERRCODE = 'P1003';
  END IF;

  UPDATE customer_skid_visits
  SET dispatched_at = NOW()
  WHERE id = p_visit_id;
END;
$$;
