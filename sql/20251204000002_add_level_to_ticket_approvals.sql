-- Add level column to ticket_approvals table
-- This column tracks the approval level (1 = Inspector, 2 = Manager, 3 = Executive)

-- Add level column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_approvals' AND column_name = 'level'
    ) THEN
        ALTER TABLE ticket_approvals 
        ADD COLUMN level INTEGER;
        
        -- Set default level based on role_at_approval if it exists
        UPDATE ticket_approvals 
        SET level = CASE 
            WHEN role_at_approval = 'inspector' THEN 1
            WHEN role_at_approval = 'manager' THEN 2
            WHEN role_at_approval = 'executive' THEN 3
            ELSE 1
        END
        WHERE level IS NULL;
        
        -- Make level NOT NULL after setting defaults
        ALTER TABLE ticket_approvals 
        ALTER COLUMN level SET NOT NULL;
        
        -- Add check constraint to ensure level is between 1 and 3
        ALTER TABLE ticket_approvals 
        ADD CONSTRAINT ticket_approvals_level_check 
        CHECK (level >= 1 AND level <= 3);
        
        -- Add index for better query performance
        CREATE INDEX IF NOT EXISTS idx_ticket_approvals_level 
        ON ticket_approvals(level);
        
        -- Add index for ticket_id and level combination
        CREATE INDEX IF NOT EXISTS idx_ticket_approvals_ticket_level 
        ON ticket_approvals(ticket_id, level);
    END IF;
END $$;

-- Add approved_by column if it doesn't exist (for backward compatibility)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_approvals' AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE ticket_approvals 
        ADD COLUMN approved_by UUID REFERENCES auth.users(id);
        
        -- Copy approver_id to approved_by if approver_id exists
        UPDATE ticket_approvals 
        SET approved_by = approver_id::UUID
        WHERE approved_by IS NULL AND approver_id IS NOT NULL;
    END IF;
END $$;

-- Add user_agent column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_approvals' AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE ticket_approvals 
        ADD COLUMN user_agent TEXT;
    END IF;
END $$;

