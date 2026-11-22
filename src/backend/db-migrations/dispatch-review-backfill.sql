WITH dispatch_messages AS (
	SELECT
		p."message_id",
		CASE
			WHEN NULLIF(TRIM(p."data" ->> 'truckNumber'), '') IS NOT NULL
				AND NULLIF(TRIM(p."data" ->> 'skidNumber'), '') IS NOT NULL
				AND NULLIF(TRIM(p."data" ->> 'dateOut'), '') IS NOT NULL
			THEN CONCAT(
				p."customer_id"::text, ':',
				UPPER(REGEXP_REPLACE(TRIM(p."data" ->> 'truckNumber'), '\s+', '', 'g')), ':',
				UPPER(REGEXP_REPLACE(TRIM(p."data" ->> 'skidNumber'), '\s+', '', 'g')), ':',
				TRIM(p."data" ->> 'dateOut')
			)
			ELSE NULL
		END AS fingerprint,
		p."processed_at"
	FROM "processed_messages" p
	INNER JOIN "messages" m ON m."id" = p."message_id"
	WHERE m."type" = 'dispatch'
),
ranked_dispatches AS (
	SELECT
		"message_id",
		fingerprint,
		ROW_NUMBER() OVER (PARTITION BY fingerprint ORDER BY "processed_at", "message_id") AS duplicate_rank,
		FIRST_VALUE("message_id") OVER (PARTITION BY fingerprint ORDER BY "processed_at", "message_id") AS first_message_id
	FROM dispatch_messages
)
UPDATE "processed_messages" p
SET
	"review_status" = CASE
		WHEN ranked.fingerprint IS NOT NULL AND ranked.duplicate_rank > 1 THEN 'duplicate'
		ELSE 'pending'
	END,
	"dispatch_fingerprint" = ranked.fingerprint,
	"duplicate_of_message_id" = CASE
		WHEN ranked.fingerprint IS NOT NULL AND ranked.duplicate_rank > 1 THEN ranked.first_message_id
		ELSE NULL
	END
FROM ranked_dispatches ranked
WHERE p."message_id" = ranked."message_id";
