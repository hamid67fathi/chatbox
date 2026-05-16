-- Assign conversations that already have agent replies but no assignee.
UPDATE conversations c
SET assigned_agent_id = sub.agent_id
FROM (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.sender_user_id AS agent_id
  FROM messages m
  WHERE m.sender_type = 'agent'
    AND m.sender_user_id IS NOT NULL
  ORDER BY m.conversation_id, m.created_at ASC
) sub
WHERE c.id = sub.conversation_id
  AND c.assigned_agent_id IS NULL
  AND c.last_agent_reply_at IS NOT NULL;
