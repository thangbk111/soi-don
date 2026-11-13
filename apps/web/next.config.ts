import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Docker: chỉ chép server + phụ thuộc đã trace; gốc trace là monorepo để kéo cả packages/shared.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Vercel + Railway: web và API khác site nên cookie SameSite=Lax không đi kèm request
  // cross-site. Chuyển tiếp /api/* sang API để trình duyệt chỉ thấy một origin.
  // (VPS không cần: Caddy đã làm việc này.)
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    return target ? [{ source: "/api/:path*", destination: `${target}/:path*` }] : [];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
