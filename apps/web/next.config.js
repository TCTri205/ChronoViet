/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@chronoviet/shared-spec',
    '@chronoviet/infra',
    '@chronoviet/rag-engine',
    '@chronoviet/agent-orchestrator',
  ],
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis', 'sharp', '@chronoviet/vlm-inspector'],
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  reactStrictMode: true,
  poweredByHeader: false,
};

module.exports = nextConfig;
