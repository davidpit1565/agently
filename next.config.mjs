/** @type {import('next').NextConfig} */
const nextConfig = {
  // No CSP here on purpose — Stripe Checkout, Supabase Auth, and next/og all
  // need their own origins, and a wrong CSP fails silently (a blocked
  // request, not a build error) until someone hits it live. These four cost
  // nothing to get wrong and protect against real, common attacks.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
