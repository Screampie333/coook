import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas (untuk menempel caption) memakai file native, jadi dijalankan langsung oleh Node,
  // tidak digabung ke bundle Next.js.
  serverExternalPackages: ["@napi-rs/canvas"],

  // Font meme dibaca dari disk saat server berjalan. Pastikan file-nya ikut ter-deploy ke Vercel.
  outputFileTracingIncludes: {
    "/api/cook": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
