import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  env: {
    NEXT_PUBLIC_EMR_BACKEND: process.env.EMR_BACKEND || "medplum",
  },
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
