#!/usr/bin/env node

'use strict';

const http = require('http');
const https = require('https');

http.createServer((req, _res) => {
  const url = req.url;
  if (url === '/healthcheck') {
    _res.writeHead(204);
    _res.end();
    return;
  }
  https.get({
    hostname: 'circleci.com',
    path: `/api/v1.1${url}`,
    headers: {
      'Accept': 'application/json'
    }
  }, res => {
    if (res.statusCode !== 200) {
      _res.writeHead(500);
      return _res.end(`Non-200 status code received from circleci: ${res.statusCode}`);
    }
    res.setEncoding('utf8');
    const data = [];
    res.on('data', chunk => data.push(chunk));
    res.on('end', () => {
      try {
        const resString = data.join('');
        if (!resString.length) throw new Error('0 length string received');
        const result = JSON.parse(resString);
        _res.writeHead(301, {
          'Location': result[0].url
        });
        _res.end();
      } catch (e) {
        _res.writeHead(500);
        _res.end(`Error parsing circleci response: ${e}`);
      }
    });
  });
}).listen(3000);
