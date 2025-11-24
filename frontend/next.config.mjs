/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const rawBasePath = process.env.BASE_PATH || '';
// Next.js 要求未设置 basePath 时应省略该字段；当仓库不是 username.github.io 时，workflow 会传入形如 "/repo" 的 BASE_PATH。
const computedBasePath = rawBasePath && rawBasePath !== '/' ? rawBasePath : undefined;

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    esmExternals: true,
  },
  // 为 GitHub Pages 进行静态导出
  output: 'export',
  trailingSlash: true,
  images: {
    // GitHub Pages 无法使用 Next Image 优化服务
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
      {
        source: '/:path*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
  ...(isProd && computedBasePath
    ? {
        basePath: computedBasePath,
        assetPrefix: computedBasePath,
      }
    : {}),
};

export default nextConfig;


