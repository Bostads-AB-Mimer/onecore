describe('/contacts', () => {
  it('should do the THING', async () => {
    const response = await fetch('http://localhost:5099/contacts/')

    console.log(await response.json())
  })
})
