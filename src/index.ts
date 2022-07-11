import * as core from '@actions/core'
import Tester from './tester'

new Tester().run().catch(err => {
  core.error(err)
  process.exit(1)
})
