-- Coook — jatah harian direset 00:00 WIB (UTC+7), bukan 00:00 UTC.
-- Cara pakai: Supabase Dashboard → SQL Editor → New query → tempel SELURUH file ini → Run.
-- Aman dijalankan ulang.
--
-- Angka "7 hours" di bawah harus sama dengan resetUtcOffsetHours di src/config/quota.ts.
-- Baris lama di tabel usage (yang memakai hari UTC) dibiarkan; paling banter satu hari terlihat
-- terpisah, lalu hitungan berjalan normal.

-- Memotong jatah dalam satu perintah, jadi dua klik bersamaan tidak bisa menembus batas.
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
  values (p_wallet, ((now() at time zone 'utc') + interval '7 hours')::date, 1, now())
  on conflict (wallet_address, day) do update
     set images_used = usage.images_used + 1,
         updated_at  = now()
   where usage.images_used < p_limit
  returning images_used into v_used;

  return v_used;
end;
$$;

-- refund_image tetap menerima tanggal dari server, jadi isinya tidak berubah.
-- Ditulis ulang di sini supaya satu file ini cukup untuk menyamakan kedua fungsi.
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

-- Hak akses diulang karena "create or replace function" mengembalikan izin bawaan.
revoke all on function public.reserve_image(text, integer) from public, anon, authenticated;
revoke all on function public.refund_image(text, date)     from public, anon, authenticated;
grant execute on function public.reserve_image(text, integer) to service_role;
grant execute on function public.refund_image(text, date)     to service_role;
