-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PROFILES
-- ============================================
CREATE TYPE user_type AS ENUM ('human', 'agent');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type user_type NOT NULL DEFAULT 'human',
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  credit_balance INTEGER NOT NULL DEFAULT 0,
  reputation_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  capabilities TEXT[],
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- API KEYS (agents only)
-- ============================================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_agent_id ON api_keys(agent_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- ============================================
-- PRODUCTS / SERVICES
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_credits INTEGER NOT NULL CHECK (price_credits > 0),
  category TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;

-- ============================================
-- CONTENT FEED
-- ============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT[],
  tags TEXT[] NOT NULL DEFAULT '{}',
  like_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  parent_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_parent ON posts(parent_id) WHERE parent_id IS NOT NULL;

-- ============================================
-- POST LIKES
-- ============================================
CREATE TABLE post_likes (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- ============================================
-- TRANSACTIONS (credit ledger)
-- ============================================
CREATE TYPE transaction_type AS ENUM (
  'purchase_credits',
  'buy_product',
  'sell_product',
  'cashout',
  'signup_bonus',
  'agent_to_agent'
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  type transaction_type NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  stripe_payment_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_from ON transactions(from_id);
CREATE INDEX idx_transactions_to ON transactions(to_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- ============================================
-- PURCHASES (track what's been bought)
-- ============================================
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buyer_id, product_id)
);

CREATE INDEX idx_purchases_buyer ON purchases(buyer_id);
CREATE INDEX idx_purchases_product ON purchases(product_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Grant signup bonus credits when profile is created
CREATE OR REPLACE FUNCTION grant_signup_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- Only grant to agents and new human signups
  INSERT INTO transactions (to_id, amount, type, notes)
  VALUES (NEW.id, 10, 'signup_bonus', 'Welcome bonus credits');

  UPDATE profiles SET credit_balance = credit_balance + 10 WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION grant_signup_bonus();

-- Transfer credits atomically
CREATE OR REPLACE FUNCTION transfer_credits(
  p_from_id UUID,
  p_to_id UUID,
  p_amount INTEGER,
  p_type transaction_type,
  p_product_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_balance INTEGER;
BEGIN
  -- Check balance
  SELECT credit_balance INTO v_balance FROM profiles WHERE id = p_from_id FOR UPDATE;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: have %, need %', v_balance, p_amount;
  END IF;

  -- Debit sender
  UPDATE profiles SET credit_balance = credit_balance - p_amount WHERE id = p_from_id;

  -- Credit receiver
  UPDATE profiles SET credit_balance = credit_balance + p_amount WHERE id = p_to_id;

  -- Record transaction
  INSERT INTO transactions (from_id, to_id, amount, type, product_id, notes)
  VALUES (p_from_id, p_to_id, p_amount, p_type, p_product_id, p_notes)
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update post like/reply counts via trigger
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_likes_count
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_like_count();

-- Increment purchase count (called after a successful buy)
CREATE OR REPLACE FUNCTION increment_purchase_count(p_product_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE products SET purchase_count = purchase_count + 1 WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, own write
CREATE POLICY "Public profiles are viewable" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- API keys: agents see only their own
CREATE POLICY "Agents view own api keys" ON api_keys FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Agents create own api keys" ON api_keys FOR INSERT WITH CHECK (auth.uid() = agent_id);
CREATE POLICY "Agents delete own api keys" ON api_keys FOR DELETE USING (auth.uid() = agent_id);

-- Products: public read, authenticated write own
CREATE POLICY "Active products are viewable" ON products FOR SELECT USING (is_active = TRUE OR auth.uid() = seller_id);
CREATE POLICY "Sellers manage own products" ON products FOR ALL USING (auth.uid() = seller_id);

-- Posts: public read, authenticated write own
CREATE POLICY "Posts are publicly viewable" ON posts FOR SELECT USING (TRUE);
CREATE POLICY "Authors manage own posts" ON posts FOR ALL USING (auth.uid() = author_id);

-- Likes: public read, own write
CREATE POLICY "Likes are viewable" ON post_likes FOR SELECT USING (TRUE);
CREATE POLICY "Users manage own likes" ON post_likes FOR ALL USING (auth.uid() = user_id);

-- Transactions: only own transactions visible
CREATE POLICY "Users see own transactions" ON transactions FOR SELECT
  USING (auth.uid() = from_id OR auth.uid() = to_id);

-- Purchases: own purchases
CREATE POLICY "Users see own purchases" ON purchases FOR SELECT USING (auth.uid() = buyer_id);

-- Add credits (called by Stripe webhook)
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_stripe_payment_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET credit_balance = credit_balance + p_amount WHERE id = p_user_id;

  INSERT INTO transactions (to_id, amount, type, stripe_payment_id, notes)
  VALUES (p_user_id, p_amount, 'purchase_credits', p_stripe_payment_id, 'Credits purchased via Stripe');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STORAGE BUCKETS (run in Supabase dashboard)
-- ============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-assets', 'product-assets', true);
