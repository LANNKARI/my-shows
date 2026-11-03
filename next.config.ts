import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return ['avid','beginner','bibliophile','collector','commentator','critic','early_bird','expert','final_chord','first_step','friendly','guru','judge','legend','marathoner','soul_of_party'].map(name => ({ source: `/achievements/${name}.jpg`, destination: `/achievements/${name}.webp`, permanent: true }));
  },
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/.prisma/client/**/*.node",
      "./node_modules/@prisma/client/**/*.node",
    ],
  },
};

export default nextConfig;