// pm2 process definition for okultedarigim (production VPS).
// 4-core VPS shared with an unrelated app (master-education) + MySQL on the same box —
// instances is deliberately conservative (half the cores) to leave headroom for MySQL/nginx/OS.
// Bump instances only after confirming CPU headroom under real load, and re-checking that
// instances * DATABASE_URL connection_limit stays well under MySQL max_connections.
module.exports = {
  apps: [
    {
      name: 'okultedarigim',
      cwd: '/opt/okultedarigim',
      script: 'node_modules/.bin/next',
      args: 'start',
      exec_mode: 'cluster',
      instances: 2,
      max_memory_restart: '768M',
      watch: false,
      autorestart: true,
      min_uptime: '30s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
}
