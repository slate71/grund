import { claimSetupToken, saveAccessUrl } from './simplefin'
import { log } from './logger'

async function main() {
  const setupToken = process.argv[2]
  if (!setupToken) {
    log.error('Usage: bun run setup-simplefin.ts <setup-token>')
    log.error('Get a setup token from your SimpleFIN bridge (e.g. https://bridge.simplefin.org).')
    process.exit(1)
  }

  log.info('Claiming SimpleFIN setup token...')
  const accessUrl = await claimSetupToken(setupToken)
  saveAccessUrl(accessUrl)
  log.info('Access URL saved. Setup complete.')
  process.exit(0)
}

main().catch((err) => {
  log.error({ err }, 'SimpleFIN setup failed')
  process.exit(1)
})
