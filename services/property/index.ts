import express from 'express'
const app = express()
const port = 3000

app.get('/', async(req, res) => {
    res.json("hello world")
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
