# go-test-action

GitHub Action for running `go test ...` and getting rich summary and annotations as output.

Powered by [Job Summaries](https://github.blog/2022-05-09-supercharging-github-actions-with-job-summaries/), this Action will generate a convenient interactive viewer for tests based on Go's [test2json](https://pkg.go.dev/cmd/test2json) output. If there are any errors during `go test`, the Action will report back the same exit code, which will fail the job.

## Inputs

| Input | Default | Description |
| -     | -       | -           |
| moduleDirectory | `.` | relative path to the directory containing the `go.mod` of the module you wish to test |
| testArguments | `./...` | arguments to pass to `go test`, `-json` will be prepended automatically |
| fromJSONFile | null | parse an exisiting [test2json](https://pkg.go.dev/cmd/test2json) file, instead of executing go test |
| omitUntestedPackages | `false` |  omit any go packages that don't have any tests from the summary output |
| omitSuccessfulPackages | `false` |  omit any go packages that didn't contain failed tests |
| omitPie | `false` | omit the pie chart from the summary output

## Demo

Tests are organized per package, with a brief summary of individual test results:

![summary overview](docs/img/overview.png)

Expand for per-test (with subtest) results and to view raw test output:

![summary expanded](docs/img/expanded.png)

## Example workflow

```yaml
name: Go

on:
  push:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Set up Go
      uses: actions/setup-go@v5
      with:
        go-version-file: go.mod

    - name: Build
      run: go build -v ./...

    - name: Test
      uses: robherley/go-test-action@v0.3.0
```

