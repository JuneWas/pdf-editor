/** @type {import('next').NextConfig} */
const config = {
  ...(process.env.GITHUB_PAGES === 'true' ? { output: 'export', basePath: '/pdf-editor', trailingSlash: true } : {}),
};
export default config;
