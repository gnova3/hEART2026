import type { NextConfig } from 'next';

const onGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const basePath = onGitHubPages ? '/hEART2026' : '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  assetPrefix: basePath ? `${basePath}/` : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: { unoptimized: true },
};

export default nextConfig;
