-- Custom migration: RLS policies + updated_at trigger
-- Aligned with docs/04-DATABASE-SCHEMA.md §9 and §10

----- 1. updated_at trigger function -----

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

----- 2. conversation.last_message_at from message insert -----

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
     SET last_message_at = NEW.created_at,
         last_agent_reply_at = CASE
           WHEN NEW.sender_type = 'agent' THEN NEW.created_at
           ELSE last_agent_reply_at
         END,
         updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_msg_update_conv AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

----- 3. Row-Level Security -----

ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members    ENABLE ROW LEVEL SECURITY;

-- Application sets: SET app.current_workspace = '<workspace_id>';

CREATE POLICY tenant_isolation ON contacts
  USING (workspace_id = current_setting('app.current_workspace')::uuid);

CREATE POLICY tenant_isolation ON conversations
  USING (workspace_id = current_setting('app.current_workspace')::uuid);

CREATE POLICY tenant_isolation ON conversation_tags
  USING (conversation_id IN (
    SELECT id FROM conversations
    WHERE workspace_id = current_setting('app.current_workspace')::uuid
  ));

CREATE POLICY tenant_isolation ON conversation_notes
  USING (conversation_id IN (
    SELECT id FROM conversations
    WHERE workspace_id = current_setting('app.current_workspace')::uuid
  ));

CREATE POLICY tenant_isolation ON messages
  USING (workspace_id = current_setting('app.current_workspace')::uuid);

CREATE POLICY tenant_isolation ON canned_responses
  USING (workspace_id = current_setting('app.current_workspace')::uuid);

CREATE POLICY tenant_isolation ON workspace_members
  USING (workspace_id = current_setting('app.current_workspace')::uuid);
