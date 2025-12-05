import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import Config from '../../../common/config'
import { logger } from '@onecore/utilities'

/**
 * Wrapper for calling the .NET DAX CLI
 * This uses the self-contained .NET executable to make DAX API calls
 */

// Use Windows build for local testing, Linux for production
const CLI_PATH = process.platform === 'win32'
  ? path.join(__dirname, '../../../../dax-cli/DaxCli/bin/Release/net8.0/win-x64/publish/DaxCli.exe')
  : path.join(__dirname, '../../../../dax-cli/DaxCli/bin/Release/net8.0/linux-x64/publish/DaxCli')

export async function callDaxCli<T>(command: string, params?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    // Read the private key from file
    const privateKey = fs.readFileSync(Config.alliera.pemKeyPath, 'utf-8')

    const env = {
      ...process.env,
      DAX_API_URL: Config.alliera.apiUrl,
      DAX_INSTANCE_ID: Config.alliera.clientId, // Use CLIENT_ID as the instance ID
      DAX_USERNAME: Config.alliera.username,
      DAX_PASSWORD: Config.alliera.password,
      DAX_PRIVATE_KEY: privateKey
    }

    const args = params ? [command, JSON.stringify(params)] : [command]

    logger.info(`Calling DAX CLI: ${command}`)

    const proc = spawn(CLI_PATH, args, { env })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('error', (error) => {
      logger.error(`DAX CLI spawn error: ${error.message}`)
      reject(new Error(`Failed to spawn DAX CLI: ${error.message}`))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout)
          logger.info(`DAX CLI call successful: ${command}`)
          resolve(result)
        } catch (error) {
          logger.error(`DAX CLI JSON parse error: ${error}`)
          reject(new Error(`Failed to parse DAX CLI output: ${stdout}`))
        }
      } else {
        logger.error(`DAX CLI exited with code ${code}: ${stderr}`)
        reject(new Error(`DAX CLI failed: ${stderr}`))
      }
    })
  })
}

/**
 * Get all contracts using the .NET DAX CLI
 */
export async function getContractsCli() {
  return callDaxCli('getcontracts')
}
