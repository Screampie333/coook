-- Coook — struktur database awal.
-- Cara pakai: buka Supabase Dashboard → SQL Editor → New query → tempel SELURUH file ini → Run.
-- Aman dijalankan ulang (memakai "if not exists" / "on conflict").
--
-- Keamanan singkatnya:
-- - Row Level Security aktif di semua tabel, TANPA policy sama sekali.
-- - Hak akses role publik (anon, authenticated) dicabut.
-- - Hanya server Coook (secret key = role service_role) yang bisa membaca dan menulis.
-- - Bucket gambar bersifat publik untuk DIBACA saja; upload/hapus hanya lewat server.

-- ============================================================
-- 1. USERS — satu baris per wallet yang pernah login
-- ============================================================
create table if not exists public.users (
  wallet_address text primary key,
  privy_user_id  text not null,
  created_at     timestamptz not null default now()
);

create index if not exists users_privy_user_id_idx on public.users (privy_user_id);

-- ============================================================
-- 2. LORES — "lore brain" tiap koin (pindahan dari src/config/lores.json)
-- ============================================================
create table if not exists public.lores (
  id              text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  name            text not null check (char_length(name) between 1 and 32),
  -- ticker ditulis TANPA tanda $
  ticker          text not null check (ticker ~ '^[A-Z0-9]{1,10}$'),
  lore            text not null check (char_length(lore) between 20 and 600),
  -- deskripsi visual maskot; dilarang memuat # $ atau tanda kutip (model gambar bisa menuliskannya)
  mascot_name     text not null,
  mascot_body     text not null,
  mascot_colors   text not null,
  mascot_outfit   text not null,
  mascot_face     text not null,
  mascot_details  text not null,
  art_style       text not null,
  humor           text not null check (char_length(humor) between 10 and 300),
  -- [{ "name": "bright orange", "hex": "#FF6B1A" }]
  colors          jsonb not null default '[]'::jsonb,
  required_words  text[] not null default '{}',
  forbidden_words text[] not null default '{}',
  -- false = lore disembunyikan dari dropdown tanpa dihapus
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 3. MEMES — setiap meme yang berhasil dibuat
-- ============================================================
create table if not exists public.memes (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references public.users (wallet_address) on delete cascade,
  idea           text not null check (char_length(idea) between 1 and 200),
  lore_id        text references public.lores (id) on delete set null,
  -- lokasi file di bucket "memes", misalnya "WaLLet.../uuid.jpg"
  image_path     text not null,
  -- 3 caption dari AI
  captions       text[] not null,
  -- caption yang dipilih user saat Download (0-2). null = tanpa caption / caption tulisan sendiri.
  caption_index  smallint check (caption_index between 0 and 2),
  created_at     timestamptz not null default now()
);

create index if not exists memes_created_at_idx on public.memes (created_at desc);
create index if not exists memes_wallet_created_idx on public.memes (wallet_address, created_at desc);
create index if not exists memes_lore_created_idx on public.memes (lore_id, created_at desc);

-- ============================================================
-- 4. USAGE — jatah gambar harian per wallet (hari dihitung UTC)
-- ============================================================
create table if not exists public.usage (
  wallet_address text not null references public.users (wallet_address) on delete cascade,
  day            date not null,
  images_used    integer not null default 0 check (images_used >= 0),
  updated_at     timestamptz not null default now(),
  primary key (wallet_address, day)
);

-- ============================================================
-- 5. LAUNCHES — koin yang di-mint dari meme (dipakai mulai Step 9)
-- ============================================================
create table if not exists public.launches (
  id             uuid primary key default gen_random_uuid(),
  mint_address   text not null unique,
  meme_id        uuid not null references public.memes (id) on delete restrict,
  wallet_address text not null references public.users (wallet_address) on delete cascade,
  name           text not null,
  ticker         text not null,
  created_at     timestamptz not null default now()
);

create index if not exists launches_wallet_created_idx on public.launches (wallet_address, created_at desc);

-- ============================================================
-- 6. FUNGSI JATAH HARIAN
-- Memotong jatah dalam satu perintah, jadi dua klik bersamaan tidak bisa menembus batas.
-- ============================================================

-- Mengembalikan jumlah pemakaian setelah dipotong, atau NULL kalau jatah sudah habis.
create or replace function public.reserve_image(p_wallet text, p_limit integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_used integer;
begin
  insert into public.usage (wallet_address, day, images_used, updated_at)
  values (p_wallet, (now() at time zone 'utc')::date, 1, now())
  on conflict (wallet_address, day) do update
     set images_used = usage.images_used + 1,
         updated_at  = now()
   where usage.images_used < p_limit
  returning images_used into v_used;

  return v_used;
end;
$$;

-- Mengembalikan jatah kalau pembuatan meme gagal.
create or replace function public.refund_image(p_wallet text, p_day date)
returns integer
language sql
security invoker
set search_path = ''
as $$
  update public.usage
     set images_used = greatest(images_used - 1, 0),
         updated_at  = now()
   where wallet_address = p_wallet
     and day = p_day
  returning images_used;
$$;

-- ============================================================
-- 7. ROW LEVEL SECURITY + HAK AKSES
-- RLS aktif tanpa policy = tidak ada yang bisa lewat key publik.
-- Server memakai secret key (service_role) yang memang melewati RLS.
-- ============================================================
alter table public.users    enable row level security;
alter table public.lores    enable row level security;
alter table public.memes    enable row level security;
alter table public.usage    enable row level security;
alter table public.launches enable row level security;

revoke all on table public.users, public.lores, public.memes, public.usage, public.launches
  from anon, authenticated;

grant select, insert, update, delete
  on table public.users, public.lores, public.memes, public.usage, public.launches
  to service_role;

revoke all on function public.reserve_image(text, integer) from public, anon, authenticated;
revoke all on function public.refund_image(text, date)     from public, anon, authenticated;
grant execute on function public.reserve_image(text, integer) to service_role;
grant execute on function public.refund_image(text, date)     to service_role;

-- ============================================================
-- 8. STORAGE — bucket gambar meme
-- public = true: gambar bisa dibuka lewat URL (dibutuhkan galeri /menu).
-- Upload/ubah/hapus tetap tertutup karena tidak ada policy di storage.objects.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memes', 'memes', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- 9. ISI AWAL — lore Coook (pindahan dari src/config/lores.json)
-- ============================================================
insert into public.lores (
  id, name, ticker, lore,
  mascot_name, mascot_body, mascot_colors, mascot_outfit, mascot_face, mascot_details,
  art_style, humor, colors, required_words, forbidden_words
)
values (
  'coook',
  'Coook',
  'COOOK',
  'Coook is the degen kitchen of Solana. Raw ideas go in, fully cooked memes come out, and the best ones get served on pump.fun. The kitchen never sleeps: Chef Coook keeps the stove hot, tastes every chart and refuses to serve anything undercooked. Holders are the kitchen crew, and the motto is simple: let it coook.',
  'Chef Coook',
  'a chubby round orange cooking pot with a thick cream rim, two small black side handles, stubby arms and short legs',
  'glossy bright orange pot, cream rim, black handles',
  'tall white chef hat tilted to one side, mint green neckerchief',
  'big round eyes on the front of the pot, thick dark eyebrows, wide confident grin',
  'holds a wooden spoon, three small round white steam puffs float above the hat',
  'flat 2D cartoon illustration, thick uniform black outlines, simple cel shading, bold solid colors, no gradients',
  'Self-aware kitchen puns mixed with degen slang: overcooked bags, served hot, chef''s kiss, kitchen''s closed, still cooking. Confident and playful, never mean.',
  '[{"name": "bright orange", "hex": "#FF6B1A"}, {"name": "cream", "hex": "#F6EFE4"}, {"name": "mint green", "hex": "#3DDC84"}]'::jsonb,
  array['coook', '$COOOK', 'kitchen', 'chef'],
  array['guaranteed', '100x', 'rug', 'scam', 'financial advice', 'risk-free']
)
on conflict (id) do nothing;
