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
