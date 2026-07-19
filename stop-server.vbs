' Stops the Orbit TV server that was started with start-hidden.vbs.

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set objShell = CreateObject("WScript.Shell")

pidFilePath = scriptDir & "\.server-pid"

If fso.FileExists(pidFilePath) Then
    Set f = fso.OpenTextFile(pidFilePath)
    pid = Trim(f.ReadLine())
    f.Close

    ' /T kills the whole process tree (cmd -> npm -> node), not just the top process
    objShell.Run "taskkill /F /T /PID " & pid, 0, True

    fso.DeleteFile pidFilePath
    MsgBox "Orbit TV server stopped.", 64, "Orbit TV"
Else
    MsgBox "The server doesn't appear to be running (no .server-pid file found)." & vbCrLf & _
           "If it's still running anyway, open Task Manager and end the ""Node.js"" process manually.", 48, "Orbit TV"
End If
