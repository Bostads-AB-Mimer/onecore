import * as crypto from 'node:crypto'

export interface PasswordAndHash {
  password: string
  salt: string
}

const createSalt = async (): Promise<string> => {
  const saltByteSize = 12
  return new Promise((resolve, reject) => {
    crypto.randomBytes(saltByteSize, (err, buf) => {
      if (err) reject(err)
      resolve(buf.toString('base64'))
    })
  })
}

const hashPassword = async (
  password: string,
  salt: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const bSalt = Buffer.from(salt, 'base64')
      crypto.pbkdf2(password, bSalt, 1000, 60, 'sha1', (err, res) => {
        if (err) {
          throw err
        } else {
          resolve(res.toString('base64'))
        }
      })
    } catch (err) {
      reject(err)
    }
  })
}

const createSaltAndHash = async (
  password: string
): Promise<PasswordAndHash> => {
  const salt = await createSalt()
  const hashedPassword = await hashPassword(password, salt)

  return {
    password: hashedPassword,
    salt,
  }
}

export default {
  createSalt,
  createSaltAndHash,
  hashPassword,
}
