# Coook (coook.ink)
Web app AI untuk generate meme koin pump.fun, dengan opsi mint meme langsung jadi koin di pump.fun.
Tidak ada integrasi X atau Telegram. Semua terjadi di coook.ink.
Tagline: "Let it coook." Tombol generate = "Cook". Tombol mint = "Serve".
Warna brand: oranye #FF6B1A (aksen utama), krem #F6EFE4, hijau #3DDC84 (status sukses).

## Desain
Tampilan mengikuti project Alphet saya di folder design-reference/ (index.html + styles.css). Baca dulu sebelum membuat UI.
Yang diikuti: layout sidebar kiri + area utama, top bar dan menu hamburger dengan backdrop di mobile,
grup navigasi berlabel kecil, kartu dengan header ikon + judul + info di kanan, judul section + subjudul,
tombol copy contract address, indikator status bertitik, blok CTA, footer.
Font: Shrikhand (judul/brand, sama dengan wordmark di logo), Space Grotesk (teks), JetBrains Mono (angka, alamat wallet, ticker).
Gaya ikon garis seperti di referensi (Lucide).
Yang diganti: aksen lime Alphet diganti oranye Coook, background gelap tetap, logo dan teks diganti Coook.

Jangan copy konten Alphet (gauge, metrics, Robinhood Chain), cukup gaya visual dan komponennya.

Logo: Madre (maskot nenek) + wordmark "coook", di public/images/coook-logo.png.
File asli dari desainer ada di folder yang sama dengan awalan coook-madre-final__.
Versi yang dipakai aplikasi sudah dipotong latarnya jadi transparan, jangan ditimpa dengan yang asli.
Ikon tab: src/app/icon.png (avatar Madre).

## Tentang saya
Saya pemula coding. Jelaskan dalam Bahasa Indonesia yang sederhana.
Setiap selesai, kasih tahu: file apa yang berubah, perintah apa yang harus saya jalankan, dan cara mengetesnya.

## Stack
Next.js (App Router) + TypeScript + Tailwind. Supabase untuk database dan storage.
AI gratis: Groq untuk teks, Cloudflare Workers AI FLUX.1 schnell untuk gambar,
Groq (gpt-oss-safeguard-20b) untuk filter isi — gratis, tapi hanya membaca teks.
OpenAI Moderation tersedia lewat AI_MODERATION_PROVIDER=openai kalau nanti gambar juga mau diperiksa.
Semua panggilan AI lewat satu lapisan provider (lib/ai) supaya provider bisa diganti lewat env tanpa menulis ulang fitur.
Model gambar tidak pernah disuruh menulis teks. Caption selalu ditempel di atas gambar pakai kode.
Privy untuk login (Solana only, wallet eksternal seperti Phantom, Solflare, Backpack).
Pembuatan koin juga lewat lapisan provider sendiri (lib/launch), dipilih lewat LAUNCH_PROVIDER:
pumpportal (default, mainnet), pumpfun (API resmi), devnet (latihan gratis).
Pinata untuk menaruh gambar dan metadata koin di IPFS.
Deploy ke Vercel.

## Aturan keras
- Semua API key dan secret di .env.local, tidak pernah ditulis di kode, tidak pernah di-commit.
- Panggilan AI (Groq, Cloudflare, OpenAI), Supabase service key, Privy App Secret, Pinata JWT, dan RPC hanya dari server (API route).
- Server selalu memverifikasi access token Privy. Alamat wallet diambil dari data user Privy yang terverifikasi, tidak dipercaya dari browser.
- Token Privy HANYA dibaca dari header Authorization, tidak pernah dari cookie. Cookie dikirim browser otomatis ke lintas situs, jadi menerimanya membuka celah CSRF.
- Tidak pernah menyimpan atau meminta private key / seed phrase user. User selalu sign transaksi di wallet sendiri.
- Tidak ada fitur bundling, sniping, atau multi-wallet buy.
- Sebelum menulis kode besar, jelaskan rencananya dulu dan tunggu persetujuan saya.
- Setelah setiap step berhasil, commit ke git dengan pesan yang jelas.
- Kalau ragu soal API pihak ketiga (Groq, Cloudflare Workers AI, OpenAI, Privy, PumpPortal, pump.fun, Pinata), cek dokumentasi resminya dulu, jangan menebak.
- Sebelum menerbitkan apa pun yang permanen (IPFS, koin di blockchain), teksnya harus lolos filter isi dulu. Keduanya tidak bisa ditarik kembali.