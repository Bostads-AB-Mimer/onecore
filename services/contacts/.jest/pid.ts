import fs from 'node:fs'

export const cleanPid = () => {
  if (fs.existsSync('.jest-server-pid')) {
    const pid = Number(fs.readFileSync('.jest-server-pid', 'utf8'))
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      // already dead, fine
    }
    fs.unlinkSync('.jest-server-pid')
  }
}
