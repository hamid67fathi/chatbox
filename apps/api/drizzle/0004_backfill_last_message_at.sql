-- Backfill last_message_at for conversations that have messages
UPDATE conversations c
SET last_message_at = sub.max_at,
    updated_at = now()
FROM (
  SELECT conversation_id, MAX(created_at) AS max_at
  FROM messages
  GROUP BY conversation_id
) sub
WHERE c.id = sub.conversation_id
  AND (c.last_message_at IS NULL OR c.last_message_at < sub.max_at);
