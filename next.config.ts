import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El agente investigador puede tardar minutos: no cortar la respuesta del server action.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
