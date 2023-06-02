import app from './app'
import Config from './common/config'

const PORT = Config.port || 5010
app.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`)
})
