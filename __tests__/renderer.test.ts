import { getTestStdout } from './helpers'
import Renderer from '../src/renderer'

describe('Renderer', () => {
  it('correctly parses test2json output', async () => {
    const stdout = await getTestStdout()

    const testsEvents = Renderer.parseTestEvents(stdout)

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

    const packageLevelTestEvents = Renderer.parseTestEvents(packageLevelStdout)
    expect(packageLevelTestEvents[0]).toHaveProperty('isPackageLevel', true)

    const otherStdout =
      '{"Time":"2022-07-10T22:42:12.108346-04:00","Action":"output","Package":"github.com/robherley/go-test-example/boom","Test":"TestFatal","Output":"=== RUN   TestFatal\\n"}'

    const otherTestEvents = Renderer.parseTestEvents(otherStdout)
    expect(otherTestEvents[0]).toHaveProperty('isPackageLevel', false)
  })

  it('correctly indicates a subtest', () => {
    const subTestStdout =
      '{"Time":"2022-07-10T22:42:11.9313-04:00","Action":"output","Package":"github.com/robherley/go-test-example/success","Test":"TestSuccess/Subtest(2)","Output":"    success_test.go:19: hello from subtest #2\\n"}'

    const subTestEvents = Renderer.parseTestEvents(subTestStdout)
    expect(subTestEvents[0]).toHaveProperty('isSubtest', true)

    const topLevelTestStdout =
      '{"Time":"2022-07-10T22:42:11.931141-04:00","Action":"output","Package":"github.com/robherley/go-test-example/success","Test":"TestSuccess","Output":"=== RUN   TestSuccess\\n"}'

    const topLevelTestEvents = Renderer.parseTestEvents(topLevelTestStdout)
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
      const testEvents = Renderer.parseTestEvents(stdout)
      expect(testEvents[0]).toHaveProperty('isConclusive', isConclusive)
    }
  })

  it('correctly indicates a cached test', () => {
    const cachedStdout =
      '{"Time":"2022-07-10T22:42:11.931552-04:00","Action":"output","Package":"github.com/robherley/go-test-example/success","Output":"ok  \\tgithub.com/robherley/go-test-example/success\\t(cached)\\n"}'

    const cachedTestEvents = Renderer.parseTestEvents(cachedStdout)
    expect(cachedTestEvents[0]).toHaveProperty('isCached', true)

    const otherStdout =
      '{"Time":"2022-07-10T22:42:11.931552-04:00","Action":"output","Package":"github.com/robherley/go-test-example/success","Output":"ok  \\tgithub.com/robherley/go-test-example/success"}'

    const otherTestEvents = Renderer.parseTestEvents(otherStdout)
    expect(otherTestEvents[0]).toHaveProperty('isCached', false)
  })

  it('properly aggregates tests, subtests and results for a package test event', async () => {
    const stdout = await getTestStdout()

    const renderer = new Renderer(
      'github.com/robherley/go-test-example',
      stdout
    )

    const packageTestEvent = renderer.testEvents.find(
      e =>
        e.isPackageLevel &&
        e.package === 'github.com/robherley/go-test-example/success'
    )

    expect(packageTestEvent).toBeDefined()

    const { results, tests, subtestMap } = renderer.aggregatePackageTests(
      packageTestEvent!
    )

    expect(results).toEqual({
      pass: 4,
      fail: 0,
      skip: 0,
    })

    expect(tests).toEqual([
      {
        action: 'pass',
        elapsed: 0,
        isCached: false,
        isConclusive: true,
        isPackageLevel: false,
        isSubtest: false,
        output: undefined,
        package: 'github.com/robherley/go-test-example/success',
        test: 'TestSuccess',
        time: new Date('2022-07-11T02:42:11.931Z'),
      },
    ])

    expect(subtestMap).toEqual({
      TestSuccess: [
        {
          action: 'pass',
          elapsed: 0,
          isCached: false,
          isConclusive: true,
          isPackageLevel: false,
          isSubtest: true,
          output: undefined,
          package: 'github.com/robherley/go-test-example/success',
          test: 'TestSuccess/Subtest(1)',
          time: new Date('2022-07-11T02:42:11.931Z'),
        },
        {
          action: 'pass',
          elapsed: 0,
          isCached: false,
          isConclusive: true,
          isPackageLevel: false,
          isSubtest: true,
          output: undefined,
          package: 'github.com/robherley/go-test-example/success',
          test: 'TestSuccess/Subtest(2)',
          time: new Date('2022-07-11T02:42:11.931Z'),
        },
        {
          action: 'pass',
          elapsed: 0,
          isCached: false,
          isConclusive: true,
          isPackageLevel: false,
          isSubtest: true,
          output: undefined,
          package: 'github.com/robherley/go-test-example/success',
          test: 'TestSuccess/Subtest(3)',
          time: new Date('2022-07-11T02:42:11.931Z'),
        },
      ],
    })
  })

  // TODO(robherley): write tests for markdown/HTML using something like cheerio
})
