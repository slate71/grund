import { claimSetupToken, saveSimpleFinCredentials } from './simplefin'
import { log } from './logger'

// One-time setup: exchange a SimpleFIN setup token for a long-lived access URL
// and store it. Get a setup token from your SimpleFIN Bridge account.
//
//   bun run src/setup-simplefin.ts <setup-token>
//   SIMPLEFIN_SETUP_TOKEN=... bun run src/setup-simplefin.ts
async function main() {
  const setupToken = process.argv[2] || process.env.SIMPLEFIN_SETUP_TOKEN

  if (!setupToken) {
    log.error('Usage: bun run src/setup-simplefin.ts <setup-token>')
    log.error('Or set SIMPLEFIN_SETUP_TOKEN in the environment.')
    log.error('Generate a setup token at https://bridge.simplefin.org/')
    process.exit(1)
  }

  log.info('Claiming SimpleFIN setup token...')
  const accessUrl = await claimSetupToken(setupToken)

  saveSimpleFinCredentials({ access_url: accessUrl })
  log.info('SimpleFIN access URL saved. Setup complete.')
  process.exit(0)
}

main().catch((err) => {
  log.error({ err }, 'SimpleFIN setup failed')
  process.exit(1)
})
