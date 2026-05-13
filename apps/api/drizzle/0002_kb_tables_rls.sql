-- Enable pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- RLS on KB tables
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tenant_isolation ON knowledge_bases
  USING (workspace_id = current_setting('app.current_workspace')::uuid);

CREATE POLICY tenant_isolation ON kb_documents
  USING (workspace_id = current_setting('app.current_workspace')::uuid);

CREATE POLICY tenant_isolation ON kb_chunks
  USING (workspace_id = current_setting('app.current_workspace')::uuid);

CREATE POLICY tenant_isolation ON ai_interactions
  USING (workspace_id = current_setting('app.current_workspace')::uuid);

-- HNSW index for ANN search (created after pgvector is enabled)
-- Note: index creation happens via db:push which creates the table;
-- the HNSW index is added here as a custom migration step.
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
  ON kb_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
