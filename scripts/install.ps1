# raigal Windows installer
# Usage: iwr https://raigal.dev/install.ps1 | iex
#
# Downloads the raigal-win-x64.exe binary from GitHub Releases,
# verifies the SHA256 checksum, installs to %LOCALAPPDATA%\raigal\,
# and adds that directory to the user PATH.

$ErrorActionPreference = "Stop"

$Repo        = "meethiu/raigal"
$Asset       = "raigal-win-x64.exe"
$GithubBase  = "https://github.com/$Repo/releases/latest/download"
$InstallDir  = Join-Path $env:LOCALAPPDATA "raigal"
$InstallPath = Join-Path $InstallDir "raigal.exe"

# Ensure install directory exists
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "Downloading raigal for Windows x64..."

$TmpBinary   = [System.IO.Path]::GetTempFileName()
$TmpChecksum = [System.IO.Path]::GetTempFileName()

try {
    # Download binary
    Invoke-WebRequest -Uri "$GithubBase/$Asset" -OutFile $TmpBinary -UseBasicParsing

    # Download checksum file (non-fatal if unavailable)
    try {
        Invoke-WebRequest -Uri "$GithubBase/checksums.txt" -OutFile $TmpChecksum -UseBasicParsing

        # Verify checksum
        $Lines    = Get-Content $TmpChecksum -ErrorAction SilentlyContinue
        $Expected = ($Lines | Where-Object { $_ -match [regex]::Escape($Asset) }) -split '\s+' | Select-Object -First 1
        if ($Expected) {
            $Actual = (Get-FileHash -Path $TmpBinary -Algorithm SHA256).Hash.ToLower()
            if ($Expected.ToLower() -ne $Actual) {
                Write-Error "Checksum mismatch.`n  Expected: $Expected`n  Got:      $Actual"
                exit 1
            }
            Write-Host "Checksum verified."
        }
    } catch {
        Write-Host "Note: could not verify checksum (continuing anyway)."
    }

    # Install
    Move-Item -Path $TmpBinary -Destination $InstallPath -Force
} finally {
    Remove-Item $TmpBinary   -Force -ErrorAction SilentlyContinue
    Remove-Item $TmpChecksum -Force -ErrorAction SilentlyContinue
}

# Add to user PATH if not already present
$UserPath = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
if ($UserPath -notlike "*$InstallDir*") {
    [System.Environment]::SetEnvironmentVariable(
        "PATH",
        "$InstallDir;$UserPath",
        [System.EnvironmentVariableTarget]::User
    )
    Write-Host ""
    Write-Host "Added $InstallDir to your user PATH."
    Write-Host "Restart your terminal (or open a new one) for PATH changes to take effect."
}

Write-Host ""
Write-Host "raigal installed to $InstallPath"
Write-Host ""

try {
    $Version = & $InstallPath --version 2>&1
    Write-Host $Version
    Write-Host "Installation complete."
} catch {
    Write-Host "Binary installed. Open a new terminal and run: raigal --version"
}
