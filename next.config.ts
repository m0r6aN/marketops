import type { NextConfig } from "next";

import { SECURITY_HEADERS } from "./src/lib/security/headers";

const securityHeaderEntries = Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
  key,
  value,
}));

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaderEntries,
      },
    ];
  },
};

export default nextConfig;
