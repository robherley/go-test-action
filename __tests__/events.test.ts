import { getTestStdout, mockActionsCoreLogging } from './helpers'
import { parseTestEvents } from '../src/events'

describe('events', () => {
  beforeEach(() => {
    mockActionsCoreLogging()
  })

  it('correctly parses test2json output', async () => {
    const stdout = await getTestStdout()

    const testsEvents = parseTestEvents(stdout)

    expect(testsEvents).toHaveLength(59)
    expect(testsEvents[58]).toEqual({
      time: new Date('2022-07-11T02:42:12.111Z'),
      action: 'fail',
      package: 'github.com/robherley/go-test-example/boom',
      test: undefined,
      elapsed: 0.103,
      output: undefined,
      isCached: false,
      isSubtest: false,
      isPackageLevel: true,
      isConclusive: true,
    })
  })

  it('correctly indicates a package level test', () => {
    const packageLevelStdout =
      '{"Time":"2022-07-10T22:42:11.92576-04:00","Action":"output","Package":"github.com/robherley/go-test-example","Output":"?   \\tgithub.com/robherley/go-test-example\\t[no test files]\\n"}'

    const packageLevelTestEvents = parseTestEvents(packageLevelStdout)
    expect(packageLevelTestEvents[0]).toHaveProperty('isPackageLevel', true)

    const otherStdout =
      '{"Time":"2022-07-10T22:42:12.108346-04:00","Action":"output","Package":"github.com/robherley/go-test-example/boom","Test":"TestFatal","Output":"=== RUN   TestFatal\\n"}'

    const otherTestEvents = parseTestEvents(otherStdout)
    expect(otherTestEvents[0]).toHaveProperty('isPackageLevel', false)
  })

  it('correctly indicates a subtest', () => {
    const subTestStdout =
      '{"Time":"2022-07-10T22:42:11.9313-04:00","Action":"output","Package":"github.com/robherley/go-test-example/success","Test":"TestSuccess/Subtest(2)","Output":"    success_test.go:19: hello from subtest #2\\n"}'

    const subTestEvents = parseTestEvents(subTestStdout)
    expect(subTestEvents[0]).toHaveProperty('isSubtest', true)

    const topLevelTestStdout =
      '{"Time":"2022-07-10T22:42:11.931141-04:00","Action":"output","Package":"github.com/robherley/go-test-example/success","Test":"TestSuccess","Output":"=== RUN   TestSuccess\\n"}'

    const topLevelTestEvents = parseTestEvents(topLevelTestStdout)
    expect(topLevelTestEvents[0]).toHaveProperty('isSubtest', false)
  })

  it('correctly indicates conclusive tests', () => {
    const getStdout = (action: string) =>
      `{"Time":"2022-07-10T22:42:12.108414-04:00","Action":"${action}","Package":"github.com/robherley/go-test-example/boom","Test":"TestFatal","Elapsed":0}`

    const testCases: [string, boolean][] = [
      ['run', false],
      ['pause', false],
      ['cont', false],
      ['bench', false],
      ['output', false],
      ['pass', true],
      ['fail', true],
      ['skip', true],
    ]

    for (let [action, isConclusive] of testCases) {
      const stdout = getStdout(action)
      const testEvents = parseTestEvents(stdout)
      expect(testEvents[0]).toHaveProperty('isConclusive', isConclusive)
    }
  })

  it('correctly indicates a cached test', () => {
    const cachedStdout =
      '{"Time":"2022-07-10T22:42:11.931552-04:00","Action":"output","Package":"github.com/robherley/go-test-example/success","Output":"ok  \\tgithub.com/robherley/go-test-example/success\\t(cached)\\n"}'

    const cachedTestEvents = parseTestEvents(cachedStdout)
    expect(cachedTestEvents[0]).toHaveProperty('isCached', true)

    const otherStdout =
      '{"Time":"2022-07-10T22:42:11.931552-04:00","Action":"output","Package":"github.com/robherley/go-test-example/success","Output":"ok  \\tgithub.com/robherley/go-test-example/success"}'

    const otherTestEvents = parseTestEvents(otherStdout)
    expect(otherTestEvents[0]).toHaveProperty('isCached', false)
  })
})
