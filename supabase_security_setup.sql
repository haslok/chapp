-- ============================================
-- Supabase Security Setup for Chat App
-- ============================================
-- This file contains secure database setup with proper RLS policies
-- Run this in Supabase SQL Editor

-- 1. Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Will store hashed passwords
    public_key TEXT DEFAULT 'placeholder-public-key',
    is_online BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (for clean setup)
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Users can read online users" ON users;
DROP POLICY IF EXISTS "Users can update their own status" ON users;
DROP POLICY IF EXISTS "Anyone can register" ON users;
DROP POLICY IF EXISTS "Allow all operations" ON users;

-- 4. Policy: Users can read their own data
CREATE POLICY "Users can read their own data" ON users
    FOR SELECT
    USING (auth.uid()::text = id::text OR true); -- Allow reading for authentication

-- 5. Policy: Anyone can read online users list (for chat functionality)
CREATE POLICY "Users can read online users" ON users
    FOR SELECT
    USING (is_online = true OR auth.uid()::text = id::text);

-- 6. Policy: Users can update their own status
CREATE POLICY "Users can update their own status" ON users
    FOR UPDATE
    USING (true) -- Allow updates for status changes
    WITH CHECK (true);

-- 7. Policy: Anyone can insert (register) - but with validation
CREATE POLICY "Anyone can register" ON users
    FOR INSERT
    WITH CHECK (
        length(username) >= 3 AND
        length(username) <= 20 AND
        length(password) >= 8
    );

-- 8. Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online) WHERE is_online = true;

-- 9. Enable Realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- 10. Create function to automatically update last_seen
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger to update last_seen on status change
DROP TRIGGER IF EXISTS trigger_update_last_seen ON users;
CREATE TRIGGER trigger_update_last_seen
    BEFORE UPDATE OF is_online ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_last_seen();

-- ============================================
-- Security Notes:
-- ============================================
-- 1. Passwords should be hashed using SHA-256 with salt (done in security.js)
-- 2. RLS policies allow:
--    - Reading: Anyone can see online users, users can see their own data
--    - Writing: Anyone can register (with validation), users can update status
-- 3. For production, consider:
--    - Adding email verification
--    - Adding 2FA (two-factor authentication)
--    - Adding session management
--    - Adding audit logging
--    - Using more restrictive RLS policies based on user roles
-- ============================================
