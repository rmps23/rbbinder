/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cmsassets.rgpub.io",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
