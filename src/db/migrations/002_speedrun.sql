-- Speedrun tables for multi-agent project scaffolding

CREATE TABLE IF NOT EXISTS speedruns (
  id TEXT PRIMARY KEY,
  scaffold_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  final_output TEXT,
  files_created_json TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS speedrun_tasks (
  id TEXT PRIMARY KEY,
  speedrun_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  status TEXT NOT NULL,
  output TEXT,
  files_created_json TEXT,
  error TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  FOREIGN KEY (speedrun_id) REFERENCES speedruns(id)
);

CREATE INDEX IF NOT EXISTS idx_speedrun_tasks_speedrun_id ON speedrun_tasks(speedrun_id);
