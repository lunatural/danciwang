#!/usr/bin/env node

/**
 * 简单的进度查看服务器
 * 提供 progress.html 页面和 fetch-progress.txt 日志文件
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8899;

const server = http.createServer((req, res) => {
  // CORS 允许
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/' || req.url === '/progress.html') {
    // 提供进度页面
    const htmlPath = path.join(__dirname, 'progress.html');
    fs.readFile(htmlPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('无法读取进度页面');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  } else if (req.url === '/fetch-progress.txt') {
    // 提供日志文件
    const logPath = path.join(__dirname, '../public/fetch-progress.txt');
    fs.readFile(logPath, (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n📊 进度查看页面已启动！`);
  console.log(`   请在浏览器打开: http://localhost:${PORT}\n`);
});
