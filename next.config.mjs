/** @type {import('next').NextConfig} */
const config = {
  env: { NEXT_PUBLIC_BASE_PATH: process.env.GITHUB_PAGES === 'true' ? '/pdf-editor' : '' },
  ...(process.env.GITHUB_PAGES === 'true' ? { output: 'export', basePath: '/pdf-editor', trailingSlash: true } : {}),
};
export default config;
