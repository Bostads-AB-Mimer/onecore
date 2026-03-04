import fs from 'node:fs'
import { cleanPid } from './pid'

module.exports = async () => {
  cleanPid()
}
