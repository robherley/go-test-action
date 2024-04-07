# go-test-action

- [go-test-action](#go-test-action)
  - [Inputs](#inputs)
  - [Screenshots](#screenshots)
  - [Examples](#examples)
    - [Basic](#basic)
    - [Using existing test file](#using-existing-test-file)
    - [Omitting elements](#omitting-elements)

GitHub Action for running `go test ./...` and getting rich summary and annotations as output.

Powered by [Job Summaries](https://github.blog/2022-05-09-supercharging-github-actions-with-job-summaries/), this Action will generate a convenient interactive viewer for tests based on Go's [test2json](https://pkg.go.dev/cmd/test2json) output. If there are any errors during `go test`, the Action will report back the same exit code, which will fail the job.

## Inputs

```yaml
- uses: robherley/go-test-action@v0
  with:
    # Relative path to the directory containing the go.mod of the module you wish to test.
    # Optional. Default is '.'
    moduleDirectory:

    # Arguments to pass to go test, -json will be prepended automatically.
    # Optional. Default is './...'
    testArguments:

    # Parse an exisiting [test2json](https://pkg.go.dev/cmd/test2json) file, instead of executing go test.
    # Will always exit(0) on successful test file parse.
    # Optional. No default
    fromJSONFile:

    # Whitespace separated list of renderable items to omit.
    # Valid options to omit are:
    #  untested: packages that have no tests
    #  successful: packages that are successful
    #  pie: mermaid.js pie chart
    #  pkg-tests: per-package test list
    #  pkg-output: per-package test output
    #  stderr: standard error output of `go test` subprocess
    # Optional. No default
    omit:
```

## Screenshots

Tests are organized per package, with a brief summary of individual test results:

![summary overview](docs/img/overview.png)

Expand for per-test (with subtest) results and to view raw test output:

![summary expanded](docs/img/expanded.png)

## Examples

### Basic

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
      uses: robherley/go-test-action@v0
```

### Using existing test file

```yaml
- name: Test
  uses: robherley/go-test-action@v0
  with:
    fromJSONFile: /path/to/test2json.json
```

### Omitting elements

See [Inputs](#inputs) above for valid options

```yaml
- name: Test
  uses: robherley/go-test-action@v0
  with:
    omit: |
      pie
      stderr
```

or

```yaml
- name: Test
  uses: robherley/go-test-action@v0
  with:
    omit: 'pie'
```
