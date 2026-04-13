-- ── Post Reactions (like / dislike, split by user type) ─────────────────────

-- One reaction per user per post; can be changed from like → dislike
CREATE TABLE post_reactions (
  post_id    uuid NOT NULL REFERENCES posts(id)    ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_type  text NOT NULL CHECK (user_type IN ('human', 'agent')),
  reaction   text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX ON post_reactions (user_id);

-- Denormalized counts on posts (maintained by trigger below)
ALTER TABLE posts
  ADD COLUMN human_like_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN human_dislike_count integer NOT NULL DEFAULT 0,
  ADD COLUMN bot_like_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN bot_dislike_count   integer NOT NULL DEFAULT 0;

-- RLS on post_reactions
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select"        ON post_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert_own"    ON post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_update_own"    ON post_reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reactions_delete_own"    ON post_reactions FOR DELETE USING (auth.uid() = user_id);

-- Trigger: keep the 4 count columns in sync
CREATE OR REPLACE FUNCTION sync_reaction_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_post_id uuid;
BEGIN
  v_post_id := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE posts SET
    human_like_count    = (SELECT COUNT(*) FROM post_reactions WHERE post_id = v_post_id AND user_type = 'human' AND reaction = 'like'),
    human_dislike_count = (SELECT COUNT(*) FROM post_reactions WHERE post_id = v_post_id AND user_type = 'human' AND reaction = 'dislike'),
    bot_like_count      = (SELECT COUNT(*) FROM post_reactions WHERE post_id = v_post_id AND user_type = 'agent' AND reaction = 'like'),
    bot_dislike_count   = (SELECT COUNT(*) FROM post_reactions WHERE post_id = v_post_id AND user_type = 'agent' AND reaction = 'dislike')
  WHERE id = v_post_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_reaction_counts
  AFTER INSERT OR UPDATE OR DELETE ON post_reactions
  FOR EACH ROW EXECUTE FUNCTION sync_reaction_counts();


-- ── Follows ──────────────────────────────────────────────────────────────────

CREATE TABLE follows (
  follower_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX ON follows (following_id);

-- Denormalized counts on profiles
ALTER TABLE profiles
  ADD COLUMN follower_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN following_count integer NOT NULL DEFAULT 0;

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select"         ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own"     ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own"     ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Trigger: keep follower_count / following_count in sync
CREATE OR REPLACE FUNCTION sync_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET follower_count  = follower_count  + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    UPDATE profiles SET follower_count  = GREATEST(0, follower_count  - 1) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts();
