/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@chronoviet/shared-spec',
    '@chronoviet/rag-engine',
    '@chronoviet/agent-orchestrator',
  ],
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis'],
  },
  reactStrictMode: true,
  poweredByHeader: false,
};

module.exports = nextConfig;
