import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeRequest, sendNodeResponse } from 'srvx/node';
import handler from './dist/server/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, 'dist', 'client');

// Common mime types for static assets
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
};

const server = http.createServer(async (req, res) => {
  try {
    // Parse URL to check for static assets
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    
    // Prevent directory traversal attacks
    const safePathname = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(CLIENT_DIR, safePathname);

    // Double check that the resolved path is indeed inside the CLIENT_DIR
    if (!filePath.startsWith(CLIENT_DIR)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        return;
      }
    } catch (e) {
      // File does not exist, fall through to SSR handler
    }

    // SSR request handler forwarding
    const webReq = new NodeRequest({ req, res });
    const webRes = await handler.fetch(webReq);

    // Set response headers from SSR response
    for (const [key, value] of webRes.headers.entries()) {
      res.setHeader(key, value);
    }

    res.writeHead(webRes.status, webRes.statusText);
    await sendNodeResponse(res, webRes);
  } catch (error) {
    console.error('Error handling request:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
