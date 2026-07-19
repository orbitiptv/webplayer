' Starts the Orbit TV server in the background with no visible window.
' Double-click this file to start the server; double-click stop-server.vbs to stop it.

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = scriptDir

' Exec (not Run) so we can capture the process id to stop it later, and so
' no console window is shown.
Set objExec = objShell.Exec("cmd /c npm start")

Set pidFile = fso.CreateTextFile(scriptDir & "\.server-pid", True)
pidFile.WriteLine objExec.ProcessID
pidFile.Close

MsgBox "Orbit TV is starting in the background." & vbCrLf & vbCrLf & _
       "Open http://localhost:3000 in your browser in a few seconds." & vbCrLf & vbCrLf & _
       "To stop the server later, double-click stop-server.vbs.", 64, "Orbit TV"
