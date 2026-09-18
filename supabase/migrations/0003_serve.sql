-- Coook — Step 9: fitur Serve (meme jadi koin).
-- Cara pakai: buka Supabase Dashboard → SQL Editor → New query → tempel SELURUH file ini → Run.
-- Aman dijalankan ulang (memakai "if not exists").
--
-- Tabel launches sudah dibuat di 0001_init.sql. File ini menambah kolom yang dibutuhkan
-- untuk mencatat proses pembuatan koin dari awal sampai selesai.

-- ============================================================
-- 1. KOLOM BARU
-- ============================================================
alter table public.launches
  -- pending   = transaksi sudah disiapkan, menunggu user tanda tangan
  -- confirmed = koin benar-benar sudah jadi di blockchain
  -- failed    = dibatalkan atau gagal
  add column if not exists status        text not null default 'pending',
  -- mainnet = koin sungguhan di pump.fun, devnet = token latihan yang tidak bernilai
  add column if not exists cluster       text not null default 'mainnet',
  add column if not exists description   text,
  -- caption yang benar-benar digambar ke gambar koin (null = tanpa caption)
  add column if not exists caption       text,
  -- alamat metadata JSON di IPFS, dan alamat gambarnya
  add column if not exists metadata_uri  text,
  add column if not exists image_cid     text,
  -- tanda tangan transaksi Solana, diisi setelah koin jadi
  add column if not exists signature     text,
  add column if not exists updated_at    timestamptz not null default now();

-- ============================================================
-- 2. ATURAN ISI KOLOM
-- Postgres tidak punya "add constraint if not exists", jadi dicek dulu.
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'launches_status_check') then
    alter table public.launches
      add constraint launches_status_check check (status in ('pending', 'confirmed', 'failed'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'launches_cluster_check') then
    alter table public.launches
      add constraint launches_cluster_check check (cluster in ('mainnet', 'devnet'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'launches_caption_length_check') then
    alter table public.launches
      add constraint launches_caption_length_check check (caption is null or char_length(caption) <= 200);
  end if;
end $$;

-- ============================================================
-- 3. SATU MEME HANYA BOLEH JADI SATU KOIN
-- Dijaga database, bukan cuma tampilan. Yang dihitung hanya koin yang benar-benar jadi,
-- jadi percobaan yang gagal tidak memblokir user mencoba lagi.
-- ============================================================
create unique index if not exists launches_meme_confirmed_idx
  on public.launches (meme_id)
  where status = 'confirmed';

-- Untuk mencari percobaan yang masih berjalan milik seorang user.
create index if not exists launches_wallet_status_idx
  on public.launches (wallet_address, status);

-- ============================================================
-- 4. HAK AKSES
-- Sama seperti tabel lain: hanya server Coook (service_role) yang boleh membaca dan menulis.
-- Kolom baru otomatis mengikuti hak akses tabelnya, ini cuma penegasan.
-- ============================================================
alter table public.launches enable row level security;
revoke all on table public.launches from anon, authenticated;
grant select, insert, update, delete on table public.launches to service_role;
