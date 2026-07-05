import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Upload de documents (Drive) : jusqu'à 25 Mo par fichier.
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
