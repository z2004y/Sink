import { spawnSync } from 'node:child_process'

// Runs the remote D1 migration on Cloudflare Pages production builds only.
// Previously this was an inline shell test in package.json, which aborted the
// whole build when the deployment variables were missing. Missing
// configuration now only skips the migration with a warning, so a Pages
// deployment still goes live (the runtime bindings decide what the app uses).

const isPagesProductionBuild = process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH === 'master'

if (!isPagesProductionBuild) {
  console.info('[pages-postbuild] Not a Pages production build, skipping remote D1 migration.')
  process.exit(0)
}

const requiredVariables = [
  'DEPLOY_D1_DATABASE_ID',
  'DEPLOY_KV_NAMESPACE_ID',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
]

const missingVariables = requiredVariables.filter(name => !process.env[name]?.trim())

if (missingVariables.length > 0) {
  console.warn(`[pages-postbuild] Missing ${missingVariables.join(', ')}; skipping remote D1 migration.`)
  console.warn('[pages-postbuild] Add these build variables in Pages - Settings - Variables and Secrets to enable automatic migrations. See docs/deployment/pages.')
  process.exit(0)
}

const steps = [
  ['pnpm', ['run', 'deploy:config']],
  ['pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', 'wrangler.deploy.jsonc']],
]

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error)
    throw result.error

  if (result.status !== 0) {
    console.error(`[pages-postbuild] "${[command, ...args].join(' ')}" exited with code ${result.status}`)
    process.exit(result.status ?? 1)
  }
}
