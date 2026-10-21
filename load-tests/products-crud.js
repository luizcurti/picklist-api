import http from 'k6/http';
import { check, sleep } from 'k6';

// Realistic mixed CRUD load against /api/v1/products. Not part of npm
// test/CI — a standalone k6 script, run on demand against a live server:
//
//   docker compose up -d --build
//   k6 run load-tests/products-crud.js
//
// Paste the real summary k6 prints (RPS, p50/p95/p99, error rate) into
// the README — never fabricated numbers.
export const options = {
  scenarios: {
    products_crud: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3005';
// Matches env.ts's DEFAULT_DEV_API_KEY — override with API_KEY for a
// non-default deployment.
const API_KEY = __ENV.API_KEY || 'dev-local-key';

export default function () {
  const productCode = `LOAD-${__VU}-${__ITER}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  };
  const params = { headers };

  const createRes = http.post(
    `${BASE_URL}/api/v1/products`,
    JSON.stringify({
      product_code: productCode,
      quantity: 10,
      pick_location: 'A1',
    }),
    params
  );
  check(createRes, { 'create: status 201': (r) => r.status === 201 });

  const listRes = http.get(`${BASE_URL}/api/v1/products?limit=20`, params);
  check(listRes, { 'list: status 200': (r) => r.status === 200 });

  const getRes = http.get(`${BASE_URL}/api/v1/products/${productCode}`, params);
  check(getRes, { 'get: status 200': (r) => r.status === 200 });

  const updateRes = http.put(
    `${BASE_URL}/api/v1/products/${productCode}`,
    JSON.stringify({ quantity: 5, pick_location: 'B2' }),
    params
  );
  check(updateRes, { 'update: status 200': (r) => r.status === 200 });

  const deleteRes = http.del(
    `${BASE_URL}/api/v1/products/${productCode}`,
    null,
    params
  );
  check(deleteRes, { 'delete: status 200': (r) => r.status === 200 });

  sleep(0.1);
}
