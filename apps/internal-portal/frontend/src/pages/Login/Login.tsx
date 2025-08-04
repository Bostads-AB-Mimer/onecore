import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

const Login = () => {
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<boolean>(false)
  const navigate = useNavigate()

  const doLogin = async () => {
    try {
      const result = await axios(`${backendUrl}/auth/login`, {
        method: 'post',
        data: {
          username,
          password,
        },
      })

      if (result.status === 200) {
        history.replaceState
        navigate('/')
      } else {
        setError(true)
      }
    } catch (error) {
      setError(true)
    }
  }

  return (
    <Stack rowGap={4} justifyContent="flex-start">
      <Typography variant="h1">Login</Typography>
      <TextField
        id="username"
        onChange={(e) => {
          setUsername(e.target.value)
        }}
        value={username}
        label="Användarnamn"
        variant="standard"
      />
      <TextField
        id="password"
        onChange={(e) => {
          setPassword(e.target.value)
        }}
        value={password}
        label="Lösenord"
        variant="standard"
        type="password"
      />
      <Button
        variant="text"
        onClick={doLogin}
        sx={{
          marginTop: 2,
          borderRadius: 0,
          bgcolor: '#53565a',
          color: 'white',
          '&:hover': { backgroundColor: 'secondary.main', color: 'white' },
        }}
      >
        Logga in
      </Button>
      {error && <Alert severity="error">Inloggning misslyckades!</Alert>}
    </Stack>
  )
}

export default Login
