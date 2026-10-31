import type { NextConfig } from 'next';

const config: NextConfig = {
  // The pg driver and the generated client must load from node_modules at
  // runtime rather than being bundled into each route.
  serverExternalPackages: ['pg'],
};

export default config;
