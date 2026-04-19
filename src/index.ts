import * as core from '@actions/core'
import Runner from './runner.js'

new Runner().run().catch(err => {
  core.error(err)
  process.exit(1)
})
