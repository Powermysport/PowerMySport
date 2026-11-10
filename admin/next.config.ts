import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // @powermysport/shared-types ships raw .ts with no build step — Next
  // doesn't compile workspace packages by default, so this is required.
  transpilePackages: ["@powermysport/shared-types", "@powermysport/rich-text"],
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
  // Pages that were folded into other screens. Kept as redirects so old
  // bookmarks and emailed links still land somewhere useful.
  async redirects() {
    return [
      {
        source: "/admin/venue-approval",
        destination: "/admin/review-queue?kind=venue",
        permanent: true,
      },
      {
        source: "/admin/academy-onboarding",
        destination: "/admin/review-queue?kind=academy",
        permanent: true,
      },
      { source: "/admin/disputes", destination: "/admin/refunds", permanent: true },
      {
        source: "/admin/provider-changes",
        destination: "/admin/review-queue?tab=changes",
        permanent: true,
      },
      { source: "/admin/user-safety", destination: "/admin/users?tab=status", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "powermysport-images.s3.ap-south-1.amazonaws.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
