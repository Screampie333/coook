import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * @napi-rs/canvas berisi file biner (.node), bukan JavaScript, jadi tidak bisa
   * ikut dibundel. Didaftarkan di sini supaya dipakai langsung dari node_modules
   * saat server jalan. Dipakai src/lib/cook/render-server.ts untuk menggambar
   * caption ke gambar koin.
   */
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
