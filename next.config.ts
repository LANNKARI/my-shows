import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/.prisma/client/**/*.node",
      "./node_modules/@prisma/client/**/*.node",
    ],
  },
};

export default nextConfig;