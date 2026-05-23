import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-root-fonts',
      configureServer(server) {
        // 开发时将 /fonts/* 请求映射到项目根目录的 fonts/
        server.middlewares.use('/fonts', (req, res, next) => {
          const filePath = path.resolve(__dirname, '../fonts', req.url!.replace(/^\//, ''));
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mime: Record<string, string> = {
              '.ttf': 'font/ttf', '.otf': 'font/otf',
              '.woff': 'font/woff', '.woff2': 'font/woff2',
            };
            res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
            fs.createReadStream(filePath).pipe(res);
          } else {
            next();
          }
        });
      },
    },
  ],
  publicDir: 'public',
});
