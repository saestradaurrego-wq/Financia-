CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  ease TEXT NOT NULL CHECK (ease IN ('easy', 'medium', 'hard')),
  feature TEXT,
  message TEXT NOT NULL,
  email TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
