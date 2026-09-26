const path = require('path');

/** Candidate .env locations on EC2 (inventort-seznik is the live dev/staging clone). */
function getEc2BackendEnvPaths() {
  const backendDir = path.resolve(__dirname, '..');
  return [
    path.join(backendDir, '.env'),
    path.join(backendDir, '..', '.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env'),
    '/home/ubuntu/inventort-seznik/backend/.env',
    '/home/ubuntu/inventort-seznik/.env',
    '/home/ubuntu/Seznik-web/backend/.env',
    '/home/ubuntu/Seznik-web/.env',
  ];
}

function loadEc2Env(dotenv) {
  for (const p of getEc2BackendEnvPaths()) {
    dotenv.config({ path: p });
  }
}

module.exports = { getEc2BackendEnvPaths, loadEc2Env };
