CREATE MATERIALIZED VIEW IF NOT EXISTS "agent_performance_daily" AS
SELECT
	c."workspace_id",
	c."assigned_agent_id" AS "agent_id",
	(c."created_at" AT TIME ZONE 'UTC')::date AS "day",
	count(*)::int AS "conversations_total",
	count(*) FILTER (
		WHERE c."status" IN ('resolved', 'closed')
	)::int AS "conversations_resolved",
	avg(c."first_response_sec") FILTER (
		WHERE c."first_response_sec" IS NOT NULL
	)::numeric AS "avg_first_response_sec"
FROM "conversations" c
WHERE c."assigned_agent_id" IS NOT NULL
GROUP BY c."workspace_id", c."assigned_agent_id", (c."created_at" AT TIME ZONE 'UTC')::date;

CREATE UNIQUE INDEX IF NOT EXISTS "agent_performance_daily_pk"
	ON "agent_performance_daily" ("workspace_id", "agent_id", "day");
