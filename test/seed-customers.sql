BEGIN;

CREATE TEMP TABLE seed_customer_geofences (
  geofence_name TEXT PRIMARY KEY,
  zone_type geofence_zone_type NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_customer_geofences (geofence_name, zone_type) VALUES
  ('QUANTUM', 'customer'),
  ('SUMAL', 'customer'),
  ('GASTECH PLANT', 'plant'),
  ('TOLL GATE', 'customer'),
  ('INTERCHANGE', 'customer'),
  ('MTN IBADAN', 'customer'),
  ('JASON UTILITY', 'customer'),
  ('GOVT OFFICE', 'customer'),
  ('PACIFIC GENERATION', 'customer'),
  ('AIRPORT', 'customer'),
  ('PEOPL', 'customer'),
  ('NEFM', 'customer'),
  ('SIRUS', 'customer'),
  ('KARAMEH', 'customer'),
  ('JASON JUNCTION', 'customer'),
  ('MBH LAGOS CUSTOMER', 'customer'),
  ('M R S', 'customer'),
  ('G Z I AGBARA', 'customer'),
  ('CWAY OTA', 'customer'),
  ('PRIORITY  ALUMINIUM', 'customer'),
  ('FIRS ABUJA FIRS', 'customer'),
  ('passron cng plant obajana', 'customer'),
  ('PROAERO AGBARA', 'customer'),
  ('NIPCO CNG PLANT AJAOKUTA', 'customer'),
  ('ZEENAB OIL ILISHAN', 'customer'),
  ('FAW WORKSHOP', 'customer'),
  ('SINOMA TRAILER WORKSHOP', 'customer'),
  ('ALARO CITY LEKKI', 'customer'),
  ('ZETA GAS PLANT AJAOKUTA', 'customer'),
  ('OLAK GAS', 'customer'),
  ('POWER GAS IKORODU', 'customer'),
  ('ZETA GAS PAPALANTO', 'customer'),
  ('MTN IKEJA  LAGOS', 'customer'),
  ('FOUANI', 'customer'),
  ('THLD - ABUJA', 'customer'),
  ('OGBOMOSHO', 'customer'),
  ('OLOHUNWA PANEL SHOP', 'customer'),
  ('ME', 'other');

INSERT INTO geofence_zones (geofence_name, type)
SELECT geofence_name, zone_type
FROM seed_customer_geofences
ON CONFLICT (geofence_name) DO UPDATE
SET type = EXCLUDED.type;

INSERT INTO customers (name, geofence_name, customer_type)
SELECT geofence_name, geofence_name, 'waybill'::customer_type
FROM seed_customer_geofences
WHERE zone_type = 'customer'
ON CONFLICT DO NOTHING;

SELECT c.id, c.name, c.geofence_name, z.type AS geofence_type
FROM customers c
JOIN geofence_zones z
  ON z.geofence_name = c.geofence_name
WHERE c.geofence_name IN (
  SELECT geofence_name
  FROM seed_customer_geofences
)
ORDER BY c.geofence_name
LIMIT 2;

COMMIT;
