-- Coook — menghapus fitur "lore brain".
-- Cara pakai: buka Supabase Dashboard → SQL Editor → New query → tempel SELURUH file ini → Run.
--
-- PERHATIAN: file ini MENGHAPUS data dan tidak bisa dibatalkan.
-- Aman dijalankan karena saat dibuat: 0 dari 7 meme memakai lore, dan satu-satunya
-- baris di tabel lores adalah contoh bawaan. Tidak ada karya user yang hilang.
--
-- Kode aplikasi sudah tidak membaca kolom-kolom ini, jadi boleh dijalankan kapan saja.
-- Sebelum dijalankan pun aplikasi tetap berfungsi; kolomnya hanya jadi tidak terpakai.

-- Index yang menyertakan lore_id tidak ada gunanya lagi.
drop index if exists public.memes_lore_created_idx;

-- Foreign key memes.lore_id -> lores.id ikut terhapus bersama kolomnya.
alter table public.memes drop column if exists lore_id;

drop table if exists public.lores;
