import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El agente investigador puede tardar minutos: no cortar la respuesta del server action.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  // Cabeceras de seguridad básicas para todas las rutas.
  async headers() {
    const cabeceras = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    if (process.env.NODE_ENV === "production") {
      cabeceras.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default nextConfig;
