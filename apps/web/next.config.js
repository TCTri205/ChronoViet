/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@chronoviet/shared-spec',
    '@chronoviet/rag-engine',
    '@chronoviet/agent-orchestrator',
    '@chronoviet/vieneu-tts',
  ],
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis', 'sharp', '@chronoviet/vlm-inspector'],
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  reactStrictMode: true,
  poweredByHeader: false,
};

module.exports = nextConfig;
