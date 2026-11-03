CREATE TABLE rbs_portal_members (
  id uuid PRIMARY KEY,
  identity_id text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT 'RBS Geschäftsführung',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rbs_portal_cases (
  id uuid PRIMARY KEY,
  source_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('project', 'partner', 'cooperation', 'contact')),
  title text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  project_key text NOT NULL DEFAULT '',
  original_data jsonb NOT NULL,
  summary text NOT NULL,
  missing jsonb NOT NULL DEFAULT '[]',
  next_step text NOT NULL,
  draft text NOT NULL DEFAULT '',
  draft_state text NOT NULL DEFAULT 'suggested' CHECK (draft_state IN ('suggested', 'edited', 'reviewed')),
  preparation_kind text NOT NULL DEFAULT 'rules' CHECK (preparation_kind IN ('rules', 'ai')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'waiting', 'done')),
  owner_id uuid REFERENCES rbs_portal_members(id),
  due_on date,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rbs_portal_cases_inbox ON rbs_portal_cases (created_at DESC, id DESC);
CREATE INDEX rbs_portal_cases_owner ON rbs_portal_cases (owner_id, status);
CREATE INDEX rbs_portal_cases_due ON rbs_portal_cases (due_on) WHERE status <> 'done';

CREATE TABLE rbs_portal_events (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES rbs_portal_cases(id),
  actor_id uuid REFERENCES rbs_portal_members(id),
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rbs_portal_events_case ON rbs_portal_events (case_id, created_at);
