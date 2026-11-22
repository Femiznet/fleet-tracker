CREATE OR REPLACE FUNCTION prevent_customer_skid_maintenance()
RETURNS trigger AS $$
BEGIN
  IF (NEW.is_on_maintenance OR NULLIF(TRIM(NEW.maintenance_note), '') IS NOT NULL) AND EXISTS (
    SELECT 1
    FROM skids
    WHERE id = NEW.skid_id
      AND (owner = 'customer' OR customer_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Maintenance tracking is only available for Gastech-owned skids'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER plant_skid_customer_maintenance_guard
BEFORE INSERT OR UPDATE OF is_on_maintenance, maintenance_note, skid_id ON plant_skid_statuses
FOR EACH ROW
EXECUTE FUNCTION prevent_customer_skid_maintenance();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_customer_assignment_with_maintenance()
RETURNS trigger AS $$
BEGIN
  IF (NEW.owner = 'customer' OR NEW.customer_id IS NOT NULL) AND EXISTS (
    SELECT 1
    FROM plant_skid_statuses
    WHERE skid_id = NEW.id
      AND (
        is_on_maintenance
        OR NULLIF(TRIM(maintenance_note), '') IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'A skid in maintenance cannot be assigned to a customer'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER skid_customer_assignment_maintenance_guard
BEFORE UPDATE OF owner, customer_id ON skids
FOR EACH ROW
EXECUTE FUNCTION prevent_customer_assignment_with_maintenance();
--> statement-breakpoint
UPDATE plant_skid_statuses
SET is_on_maintenance = FALSE,
    maintenance_note = NULL
WHERE (is_on_maintenance OR maintenance_note IS NOT NULL)
  AND EXISTS (
    SELECT 1
    FROM skids
    WHERE skids.id = plant_skid_statuses.skid_id
      AND (owner = 'customer' OR customer_id IS NOT NULL)
  );
--> statement-breakpoint
UPDATE skids
SET current_loc = 'pending'
WHERE owner = 'customer' OR customer_id IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_customer_skid_location_tracking()
RETURNS trigger AS $$
BEGIN
  IF NEW.owner = 'customer' OR NEW.customer_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.current_loc IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Customer skid locations are not tracked; location must remain pending'
          USING ERRCODE = '23514';
      END IF;
    ELSIF OLD.owner != 'customer' AND OLD.customer_id IS NULL THEN
      IF NEW.current_loc IS DISTINCT FROM OLD.current_loc
        AND NEW.current_loc IS DISTINCT FROM 'pending'
      THEN
        RAISE EXCEPTION 'Customer skid locations are not tracked; location must remain pending'
          USING ERRCODE = '23514';
      END IF;
      NEW.current_loc := 'pending';
    ELSIF NEW.current_loc IS DISTINCT FROM OLD.current_loc THEN
      RAISE EXCEPTION 'Customer skid locations are not tracked; location must remain pending'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER skid_customer_location_guard
BEFORE INSERT OR UPDATE OF current_loc, owner, customer_id ON skids
FOR EACH ROW
EXECUTE FUNCTION prevent_customer_skid_location_tracking();
