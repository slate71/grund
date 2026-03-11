import Fastify from 'fastify'
import { registerRoutes } from './routes'

const PORT = parseInt(process.env.PORT || '9876', 10)

const app = Fastify()

registerRoutes(app)

app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log(`Credential proxy running on port ${PORT}`)
  console.log(`  Anthropic: http://localhost:${PORT}/anthropic/*`)
  console.log(`  Gmail:     http://localhost:${PORT}/gmail/*`)
})
