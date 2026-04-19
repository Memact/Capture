import { execFileSync } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const requiredPaths = [
  'extension/memact/background.js',
  'extension/memact/bridge.js',
  'extension/memact/capture-api.js',
  'extension/memact/embed-worker.js',
  'extension/memact/page-api.js',
  'extension/memact/Readability.js',
  'extension/memact/icons',
  'extension/memact/vendor',
  'scripts/package-extension.mjs',
  'scripts/sync-transformers.mjs',
]

const syntaxCheckTargets = [
  'extension/memact/background.js',
  'extension/memact/bridge.js',
  'extension/memact/capture-api.js',
  'extension/memact/embed-worker.js',
  'extension/memact/page-api.js',
  'scripts/package-extension.mjs',
  'scripts/sync-transformers.mjs',
]

async function ensurePathExists(relativePath) {
  await access(path.join(projectRoot, relativePath))
}

function runSyntaxCheck(relativePath) {
  execFileSync(process.execPath, ['--check', path.join(projectRoot, relativePath)], {
    stdio: 'inherit',
  })
}

async function main() {
  const packageJson = JSON.parse(
    await readFile(path.join(projectRoot, 'package.json'), 'utf8')
  )
  const manifest = JSON.parse(
    await readFile(path.join(projectRoot, 'extension', 'memact', 'manifest.json'), 'utf8')
  )

  if (packageJson.version !== manifest.version) {
    throw new Error(
      `Version mismatch: package.json=${packageJson.version}, manifest.json=${manifest.version}`
    )
  }

  if (manifest.version_name !== 'v0.0') {
    throw new Error(
      `Unexpected manifest version_name "${manifest.version_name}". Expected "v0.0".`
    )
  }

  for (const relativePath of requiredPaths) {
    await ensurePathExists(relativePath)
  }

  for (const relativePath of syntaxCheckTargets) {
    runSyntaxCheck(relativePath)
  }

  console.log('Capture checks passed.')
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exitCode = 1
})
