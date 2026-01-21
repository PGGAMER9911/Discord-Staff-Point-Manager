-- ==========================================
-- DROP OLD PROFILE SYSTEM
-- ==========================================
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ==========================================
-- NEW PREMIUM PROFILE SYSTEM
-- ==========================================
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 13 AND age <= 100),
  dob DATE NOT NULL,
  bio TEXT DEFAULT 'Hey there! I''m new to the staff team. Looking forward to contributing! 🚀',
  tags TEXT[] DEFAULT ARRAY['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
  avatar_url TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Non-binary', 'Prefer not to say')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- BOT UPDATES SYSTEM
-- ==========================================
CREATE TABLE IF NOT EXISTS bot_updates (
  id SERIAL PRIMARY KEY,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  changes TEXT[] NOT NULL,
  category TEXT DEFAULT 'update',
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_updates_created_at ON bot_updates(created_at DESC);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_updates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can view updates" ON bot_updates;

-- Allow anyone to read profiles
CREATE POLICY "Anyone can view profiles"
  ON user_profiles FOR SELECT
  USING (true);

-- Users can only update their own profile (via service_role in production)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (user_id = current_setting('request.jwt.claim.sub', true));

-- Users can insert their own profile (via service_role in production)
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

-- Allow anyone to read updates
CREATE POLICY "Anyone can view updates"
  ON bot_updates FOR SELECT
  USING (true);

-- ==========================================
-- SAMPLE DATA (OPTIONAL)
-- ==========================================
-- Insert initial bot updates
INSERT INTO bot_updates (version, title, description, changes) VALUES
('2.0.0', 'Major Profile System Overhaul', 'Complete rebuild of profile and update systems with premium embeds', 
 ARRAY[
   'Premium embed-based profile cards',
   'Age-DOB validation system',
   'Customizable tags (up to 5)',
   'Gender field support',
   'Enhanced privacy controls',
   'Animated loading states'
 ]),
('1.5.0', 'Points System Enhancement', 'Improved points management with better audit logging',
 ARRAY[
   'Transaction history export',
   'Enhanced audit logging',
   'Rate limiting improvements',
   'Better error messages'
 ])
ON CONFLICT DO NOTHING;
