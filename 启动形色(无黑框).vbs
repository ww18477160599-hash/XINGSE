Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
ws.CurrentDirectory = currentDir

' 检查 3721 端口服务是否已在运行
ret = ws.Run("cmd /c netstat -ano | findstr 127.0.0.1:3721 | findstr LISTENING", 0, True)
If ret <> 0 Then
    ws.Run "node server.js", 0, False
    WScript.Sleep 1000
End If

' 查找 Edge 独立窗口启动
edge1 = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
edge2 = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(edge2) Then
    ws.Run """" & edge2 & """ --app=http://127.0.0.1:3721 --window-size=1540,960", 1, False
ElseIf fso.FileExists(edge1) Then
    ws.Run """" & edge1 & """ --app=http://127.0.0.1:3721 --window-size=1540,960", 1, False
Else
    ws.Run "http://127.0.0.1:3721", 1, False
End If
