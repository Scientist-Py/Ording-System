$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Chapter One Cafe Admin.lnk")
$TargetDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$TargetDir\Launch-Chapter-One-Cafe.vbs`""
$Shortcut.WorkingDirectory = $TargetDir
$Shortcut.Description = "Chapter One Cafe - Native Windows Kitchen & Admin App"
$Shortcut.Save()
Write-Host "Created Desktop shortcut: Chapter One Cafe Admin.lnk" -ForegroundColor Green
