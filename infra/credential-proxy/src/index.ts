import Fastify from 'fastify'
import { registerRoutes } from './routes'
import { log } from './logger'

const PORT = parseInt(process.env.PORT || '9876', 10)

const app = Fastify({ logger: log })

registerRoutes(app)

app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  log.info({ port: PORT, anthropic: `/anthropic/*`, gmail: `/gmail/*` }, 'Credential proxy running')
})
