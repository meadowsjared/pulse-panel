!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to also delete all Pulse Panel settings and data (soundboards, custom recordings, hotkeys, and preferences)?" /SD IDNO IDNO skipDelete
    RMDir /r "$APPDATA\pulse-panel"
  skipDelete:
!macroend
