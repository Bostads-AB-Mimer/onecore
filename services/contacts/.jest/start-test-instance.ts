import { spawn } from 'node:child_process'
import fs from 'node:fs'
import dotenv from 'dotenv'
import { cleanPid } from './pid'

const waitForHttp = async (
  url: string,
  { timeoutMs = 15000, intervalMs = 250 } = {}
) => {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      console.log('Pinging', url)
    }

    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error(`Timed out waiting for ${url}`)
}

export default async () => {
  try {
    // Clean any earlier process
    cleanPid()

    // 1. Load test env
    console.log(process.env.DOTENV_CONFIG_PATH)
    const pde = dotenv.config({
      path: process.env.DOTENV_CONFIG_PATH,
    }).parsed
    console.log(pde)
    if (!pde) throw new Error('Failed to load test dotenv config')
    if (!pde.PORT) {
      throw new Error('Test dotenv does not specify a port')
    }

    // 2. start server
    const proc = spawn(
      'node',
      ['-r', 'dotenv/config', '--import', 'tsx', '--watch', 'src/index'],
      {
        env: {
          ...process.env,
          DOTENV_CONFIG_PATH: '.env.test',
          NODE_ENV: 'test',
        },
        stdio: 'inherit',
        detached: true,
      }
    )
    // 3. persist PID for teardown
    fs.writeFileSync('.jest-server-pid', String(proc.pid), 'utf8')

    // 4. wait for readiness
    await waitForHttp(`http://localhost:${pde.PORT}/health`)
  } catch (e) {
    cleanPid()
    throw e
  }
}
