import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Test Configuration for 1000 Concurrent Users generating OTP
export const options = {
  scenarios: {
    otp_spike_test: {
      executor: 'per-vu-iterations',
      vus: 1000,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'], // Expect < 5% failure rate
    http_req_duration: ['p(95)<2000'], // 95% of requests should complete under 2s
  },
};

export default function () {
  const url = 'http://localhost:5000/api/auth/send-otp';
  const vuId = __VU;
  const email = `loadtest_user_${vuId}_${Date.now()}@example.com`;

  const payload = JSON.stringify({ email });
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'status is 429 (rate limited)': (r) => r.status === 429,
    'response has message or devOtp': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.message !== undefined || body.devOtp !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
}
