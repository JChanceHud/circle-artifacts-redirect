// @flow

const http = require('http');
const https = require('https');
const url = require('url');

function isObject(obj): %checks {
  return typeof obj === 'object';
}

type BuildStatus = 'success' | 'fixed' | 'failed';

type CircleBuild = {
  compare: string,
  previous_successful_build: {
    build_num: number,
    status: BuildStatus,
    build_time_millis: number
  },
  build_parameters: {
    CIRCLE_JOB: string,
    [key: any]: string
  },
  oss: boolean,
  fail_reason?: any,
  reponame: string,
  failed: boolean,
  branch: string,
  build_num: number,
  has_artifacts: boolean,
  status: BuildStatus,
  workflows: {
    job_name: string,
    job_id: string,
    workflow_id: string,
    workspace_id: string,
    upstream_job_ids: string[],
    upstream_concurrency_map: any,
    workflow_name: string
  }
};

http.createServer((req, _res) => {
  const path = req.url;
  const queryParams = url.parse(req.url, true).query;
  if (!isObject(queryParams)) {
    _res.writeHead(400);
    _res.end(`Bad query parameters received`);
    return;
  }
  if (path === '/healthcheck') {
    _res.writeHead(204);
    _res.end();
    return;
  }
  if (!queryParams.project) {
    _res.writeHead(400);
    _res.end(`No 'project' query parameter supplied`);
  } else if (!queryParams.token) {
    _res.writeHead(400);
    _res.end(`No 'token' query parameter supplied`);
  }
  getArtifacts(queryParams.project, queryParams.token, {
    filename: queryParams.filename,
    branch: queryParams.branch,
    hasArtifacts: queryParams.hasArtifacts,
    jobName: queryParams.jobName
  })
    .then(artifactsUrl => {
      _res.writeHead(302, {
        'Location': artifactsUrl
      });
      _res.end();
    })
    .catch(err => {
      _res.writeHead(500);
      _res.end(`Error parsing circleci response: ${err}`);
    });
}).listen(3000);

async function getArtifacts(project, token, options: {
  filename?: string,
  branch?: string,
  hasArtifacts?: boolean,
  jobName?: string
} = {}) {
  const latestBuildNum = await getLatestBuilds(project, token, options);
  const result = await getUrl({
    hostname: 'circleci.com',
    path: `/api/v1.1/project/github/${project}/${latestBuildNum}/artifacts?circle-token=${token}`
  });
  if (!result.length) throw new Error(`0 length artifacts response received`);
  for (var item of result) {
    if (!options.filename) break;
    if (item.path.indexOf(options.filename) === -1) continue;
    return Promise.resolve(item.url);
  }
  return Promise.resolve(result[0].url);
}

async function getLatestBuilds(project, token, options: {
  branch?: string,
  hasArtifacts?: boolean,
  jobName?: string
} = {}) {
  const result: CircleBuild[] = await getUrl({
    hostname: 'circleci.com',
    path: `/api/v1.1/project/github/${project}?circle-token=${token}`,
  });
  if (!result.length) throw new Error('Empty build list received from circle api');
  for (var item of result) {
    if (item.status !== 'success' && item.status !== 'fixed') continue;
    if (options.branch && item.branch !== options.branch) continue;
    if (typeof options.hasArtifacts === 'boolean' && options.hasArtifacts !== item.has_artifacts) continue;
    if (options.jobName && item.workflows && options.jobName !== item.workflows.job_name) continue;
    return Promise.resolve(item.build_num);
  }
  throw new Error('Unable to find build matching parameters');
}

async function getUrl(options) {
  return new Promise((resolve, reject) => {
    https.get({
      ...options,
      headers: {
        'Accept': 'application/json'
      }
    }, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Non-200 status code received: ${res.statusCode}, ${res.statusMessage}`));
      }
      res.setEncoding('utf8');
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        try {
          const received = data.join('');
          if (!received.length) throw new Error('0 length response received');
          const result = JSON.parse(received);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });
  });
}
