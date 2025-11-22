-- Create ticket_approvals table
CREATE TABLE IF NOT EXISTS ticket_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  level INTEGER NOT NULL, -- 1, 2, or 3
  approved_by UUID NOT NULL REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Audit Trail Fields
  ip_address INET,
  user_agent TEXT,
  browser_fingerprint TEXT,
  session_id TEXT,
  
  -- Metadata
  comments TEXT,
  status_before TEXT,
  status_after TEXT,
  
  -- Hash for verification (optional)
  approval_hash TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_approvals_ticket ON ticket_approvals(ticket_id);
CREATE INDEX IF NOT EXISTS idx_approvals_user ON ticket_approvals(approved_by);
CREATE INDEX IF NOT EXISTS idx_approvals_date ON ticket_approvals(approved_at);

-- Enable RLS
ALTER TABLE ticket_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view approvals
CREATE POLICY "Approvals are viewable by everyone" 
ON ticket_approvals FOR SELECT 
USING (true);

-- Only authenticated users can create approvals
CREATE POLICY "Authenticated users can create approvals" 
ON ticket_approvals FOR INSERT 
WITH CHECK (auth.uid() = approved_by);
