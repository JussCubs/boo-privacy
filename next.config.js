/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enable WebAssembly support
  webpack: (config, { isServer, webpack }) => {
    // Enable WASM
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files as assets
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[name][ext]',
      },
    });

    // Resolve WASM files from hasher.rs package
    const hasherPkgDir = path.dirname(require.resolve('@lightprotocol/hasher.rs/package.json'));

    config.resolve.alias = {
      ...config.resolve.alias,
      'light_wasm_hasher_bg.wasm': path.join(hasherPkgDir, 'dist/light_wasm_hasher_bg.wasm'),
      'hasher_wasm_simd_bg.wasm': path.join(hasherPkgDir, 'dist/hasher_wasm_simd_bg.wasm'),
    };

    // Exclude Node.js modules from browser bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        os: false,
        net: false,
        tls: false,
        child_process: false,
        'node-localstorage': false,
      };

      // Ignore Node.js only imports
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(node-localstorage|node:path)$/,
        })
      );
    }

    return config;
  },
  // Transpile Privacy Cash SDK packages
  transpilePackages: [
    'privacycash',
    '@lightprotocol/hasher.rs',
    'snarkjs',
  ],
  // Allow images from our domain
  images: {
    domains: ['booprivacy.com'],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
