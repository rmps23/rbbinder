/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
  },
  images: {
    // Next 16 only serves the qualities listed here (default: 75 only), so 90/95 used to fall back to 75.
    qualities: [75, 90, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cmsassets.rgpub.io",
        pathname: "/**",
      },
      {
        // pictures of promo printings TCGplayer has no image for (see cardImageFixes.json)
        protocol: "https",
        hostname: "static.dotgg.gg",
        pathname: "/riftbound/**",
      },
      {
        // runes Riot's gallery doesn't list come from TCGplayer (see extraCards.ts)
        protocol: "https",
        hostname: "tcgplayer-cdn.tcgplayer.com",
        pathname: "/product/**",
      },
    ],
  },
};

export default nextConfig;
