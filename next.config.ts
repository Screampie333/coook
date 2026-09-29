import type { NextConfig } from "next";

/**
 * Header keamanan untuk semua halaman dan API.
 *
 * Yang paling penting di sini: frame-ancestors dan X-Frame-Options.
 * Tanpa keduanya, situs mana pun bisa memasang Kuk di dalam iframe,
 * menutupinya dengan tombol palsu, lalu menipu user agar menandatangani
 * transaksi di wallet-nya. Untuk aplikasi yang menyuruh orang tanda tangan,
 * itu risiko nyata.
 *
 * CSP untuk script SENGAJA belum dipasang. Privy, ekstensi wallet, dan Next.js
 * sama-sama menyuntik script, jadi CSP yang salah akan mematikan login total.
 * Itu perlu dikerjakan dan diuji terpisah.
 */
const securityHeaders = [
  // Larang siapa pun memasang situs ini di dalam iframe. Versi modern.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Hal yang sama untuk browser lama yang belum paham frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Browser harus menghormati Content-Type dari server, tidak boleh menebak sendiri.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Jangan bocorkan alamat halaman kita ke situs lain saat user mengeklik tautan keluar.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Matikan kemampuan browser yang tidak dipakai aplikasi ini sama sekali.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/**
 * Wajibkan HTTPS. Hanya di production: di localhost aplikasi berjalan lewat HTTP,
 * dan header ini bisa membuat browser menolak membukanya.
 */
const productionOnlyHeaders =
  process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : [];

const nextConfig: NextConfig = {
  /**
   * @napi-rs/canvas berisi file biner (.node), bukan JavaScript, jadi tidak bisa
   * ikut dibundel. Didaftarkan di sini supaya dipakai langsung dari node_modules
   * saat server jalan. Dipakai src/lib/cook/render-server.ts untuk menggambar
   * caption ke gambar koin.
   */
  serverExternalPackages: ["@napi-rs/canvas"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders, ...productionOnlyHeaders],
      },
    ];
  },
};

export default nextConfig;
