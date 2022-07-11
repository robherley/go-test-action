# go-test-action

GitHub Action for running `go test ...` and getting rich summary and annotations as output.

Powered by [Job Summaries](https://github.blog/2022-05-09-supercharging-github-actions-with-job-summaries/), this Action will generate a convenient interactive viewer for tests based on Go's [test2json](https://pkg.go.dev/cmd/test2json) output.

## Example

Tests are organized per package, with a brief summary of individual test results:

![summary overview](docs/img/overview.png)

Expand for per-test (with subtest) results and to view raw test output:

![summary expanded](docs/img/expanded.png)

## Inputs

- `moduleDirectory` (optional): relative path to the directory containing the `go.mod` of the module you wish to test
  - Default: `.`
- `testArguments` (optional): arguments to pass to `go test`, `-json` will be prepended
  - Default: `./...`

