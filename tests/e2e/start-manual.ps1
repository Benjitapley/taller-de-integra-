param(
    [string]$PgBin = 'C:/Program Files/PostgreSQL/18/bin',
    [string]$Node = 'C:/Program Files/nodejs/node.exe',
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$testPython = Join-Path $projectRoot '.venv/Scripts/python.exe'
foreach ($dependency in @($testPython, $Node, (Join-Path $PgBin 'initdb.exe'), (Join-Path $PgBin 'pg_ctl.exe'))) {
    if (-not (Test-Path -LiteralPath $dependency -PathType Leaf)) {
        throw "Falta dependencia local: $dependency. Consulta tests/e2e/MANUAL.md."
    }
}
$runnerArguments = @('-I', '-B', (Join-Path $PSScriptRoot 'run_e2e.py'), '--manual', '--pg-bin', $PgBin, '--node', $Node)
if ($NoOpen) { $runnerArguments += '--no-open' }
# Foreground execution preserves the terminal, stdin, and Ctrl+C cleanup.
& $testPython @runnerArguments
if ($LASTEXITCODE -ne 0) { throw "El entorno manual terminó con código $LASTEXITCODE." }
