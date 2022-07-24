import * as core from '@actions/core'

// https://cs.opensource.google/go/go/+/master:src/cmd/test2json/main.go;l=46-55
export type TestEventAction =
  | 'run' // the test has started running
  | 'pause' // the test has been paused
  | 'cont' // the test has continued running
  | 'bench' // the benchmark printed log output but did not fail
  | 'output' // the test printed output
  | TestEventActionConclusion

// Specific actions that are "conclusive", they mark the end result of a test
export type TestEventActionConclusion =
  | 'pass' // the test passed
  | 'fail' // the test or benchmark failed
  | 'skip' // the test was skipped or the package contained no tests

// Specific test actions that mark the conclusive state of a test
export const conclusiveTestEvents: TestEventActionConclusion[] = [
  'pass',
  'fail',
  'skip',
]

// https://cs.opensource.google/go/go/+/master:src/cmd/test2json/main.go;l=34-41
export interface TestEvent {
  // parsed fields from go's test event
  time?: Date
  action: TestEventAction
  package: string
  test: string
  elapsed?: number // seconds
  output?: string
  // added fields
  isSubtest: boolean
  isPackageLevel: boolean
  isConclusive: boolean
  isCached: boolean
}

/**
 * Convert test2json raw JSON output to TestEvent
 * @param stdout raw stdout of go test process
 * @returns parsed test events
 */
export function parseTestEvents(stdout: string): TestEvent[] {
  const events: TestEvent[] = []

  const lines = stdout.split('\n').filter(line => line.length !== 0)
  for (let line of lines) {
    try {
      const json = JSON.parse(line)
      events.push({
        time: json.Time && new Date(json.Time),
        action: json.Action as TestEventAction,
        package: json.Package,
        test: json.Test,
        elapsed: json.Elapsed,
        output: json.Output,
        isCached: json.Output?.includes('\t(cached)') || false,
        isSubtest: json.Test?.includes('/') || false, // afaik there isn't a better indicator in test2json
        isPackageLevel: typeof json.Test === 'undefined',
        isConclusive: conclusiveTestEvents.includes(json.Action),
      })
    } catch {
      core.debug(`unable to parse line: ${line}`)
      continue
    }
  }

  return events
}
