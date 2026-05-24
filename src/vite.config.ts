import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

const MIME: Record<string, string> = {
  '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.js': 'application/javascript',
};

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-root-assets',
      configureServer(server) {
        server.middlewares.use('/fonts', (req, res, next) => {
          const fp = path.resolve(__dirname, '../fonts', req.url!.replace(/^\//, ''));
          if (fs.existsSync(fp)) {
            const ext = path.extname(fp).toLowerCase();
            res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
            fs.createReadStream(fp).pipe(res);
          } else { next(); }
        });
        server.middlewares.use('/CtoChin.js', (_req, res) => {
          const fp = path.resolve(__dirname, '../CtoChin.js');
          res.setHeader('Content-Type', 'application/javascript');
          fs.createReadStream(fp).pipe(res);
        });
      },
    },
  ],
  publicDir: 'public',
  server: {
    fs: { allow: ['..'] },
  },
});
