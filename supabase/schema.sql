-- 单词大师 - 数据库表结构
-- 在 Supabase SQL Editor 中运行此文件

-- 单词本
CREATE TABLE public.words (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word        TEXT NOT NULL,
  "group"     TEXT NOT NULL DEFAULT '手动添加',
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, word)
);

CREATE INDEX idx_words_user_id ON public.words(user_id);

-- 待学习队列
CREATE TABLE public.learning (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word        TEXT NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, word)
);

CREATE INDEX idx_learning_user_id ON public.learning(user_id);

-- 复习安排 (SM-2 算法)
CREATE TABLE public.review_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word            TEXT NOT NULL,
  ease_factor     DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  interval_days   INTEGER NOT NULL DEFAULT 0,
  repetitions     INTEGER NOT NULL DEFAULT 0,
  next_review_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_review_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, word)
);

CREATE INDEX idx_review_schedule_user_id ON public.review_schedule(user_id);
CREATE INDEX idx_review_schedule_due ON public.review_schedule(user_id, next_review_at);

-- 启用行级安全
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_schedule ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据

-- words
CREATE POLICY "Users can view own words"
  ON public.words FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own words"
  ON public.words FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own words"
  ON public.words FOR DELETE
  USING (auth.uid() = user_id);

-- learning
CREATE POLICY "Users can view own learning"
  ON public.learning FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning"
  ON public.learning FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning"
  ON public.learning FOR DELETE
  USING (auth.uid() = user_id);

-- review_schedule
CREATE POLICY "Users can view own review schedule"
  ON public.review_schedule FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own review schedule"
  ON public.review_schedule FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own review schedule"
  ON public.review_schedule FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own review schedule"
  ON public.review_schedule FOR DELETE
  USING (auth.uid() = user_id);
