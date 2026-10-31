<!-- :: Batch section
@echo off
setlocal
cd /d "%~dp0"
start "" mshta.exe "%~f0"
exit /b
-->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>OLTO Sovereign Notepad</title>
  <HTA:APPLICATION
    ID="OltoNotepadApp"
    APPLICATIONNAME="OLTO Sovereign Notepad"
    BORDER="thin"
    BORDERSTYLE="normal"
    CAPTION="yes"
    ICON=""
    MAXIMIZEBUTTON="yes"
    MINIMIZEBUTTON="yes"
    SHOWINTASKBAR="yes"
    SINGLEINSTANCE="yes"
    SYSMENU="yes"
    WINDOWSTATE="normal"
    NAVIGABLE="no"
    SCROLL="no"
  />
  <script type="text/javascript">
    window.resizeTo(1100, 720);
    window.moveTo((screen.width - 1100) / 2, (screen.height - 720) / 2);
    // Redirect to local modern core engine
    window.location.replace("olto_notepad_core.html");
  </script>
</head>
<body style="background:#0a0e17; color:#fff; font-family:sans-serif; margin:0; display:flex; align-items:center; justify-content:center; height:100vh;">
  <p>Launching OLTO Sovereign Notepad...</p>
</body>
</html>
