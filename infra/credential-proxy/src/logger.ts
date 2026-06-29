import pino from 'pino'
import pretty from 'pino-pretty'

const options = { name: 'credential-proxy', level: process.env.LOG_LEVEL ?? 'info' }

// In dev, pretty-print via an in-process stream rather than pino's `transport`
// option, which spawns a worker thread (thread-stream) that fails to resolve
// its deps under bun when run outside Docker.
export const log =
  process.env.NODE_ENV !== 'production'
    ? pino(options, pretty({ colorize: true }))
    : pino(options)
