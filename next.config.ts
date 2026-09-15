import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use threads for build workers in Windows environments that restrict child processes.
  experimental: { workerThreads: true, useTypeScriptCli: false },
};

export default nextConfig;
