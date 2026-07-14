import fs from 'node:fs'
import path from 'node:path'
import {CONFIG, CJS} from './constants.js'

fs.rmSync(path.join(process.cwd(), CONFIG))
fs.rmSync(path.join(process.cwd(), CJS))
