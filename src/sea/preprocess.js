import fs from 'node:fs'
import path from 'node:path'
import {CONFIG, CJS, EXE} from './constants.js'

fs.writeFileSync(path.join(process.cwd(), CONFIG), JSON.stringify({
	main: './' + CJS,
	output: './' + EXE + (process.platform === 'win32' ? '.exe' : ''),
	disableExperimentalSEAWarning: true
}))

const filename = path.join(process.cwd(), CJS)

fs.writeFileSync(filename, fs.readFileSync(filename).toString().replace(
	// package.json: dependencies
	/require\("(@jitl\/quickjs-wasmfile-release-sync|quickjs-emscripten-core|quickjs-emscripten-sync|undici)"\)/g,
	'require("module").createRequire(__filename)("$1")'
))
