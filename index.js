#!/usr/bin/env node

'use strict';

const http = require('http');
const https = require('https');
const url = require('url');

http.createServer((req, _res) => {
  const path = req.url;
  const queryParams = url.parse(req.url, true).query;
  if (path === '/healthcheck') {
    _res.writeHead(204);
    _res.end();
    return;
  }
  https.get({
    hostname: 'circleci.com',
    path: `/api/v1.1${path}`,
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
        for (var item of result) {
          if (!queryParams.filename) break;
          if (item.path.indexOf(queryParams.filename) === -1) continue;
          _res.writeHead(301, {
            'Location': item.url
          });
          _res.end();
          return;
        }
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
