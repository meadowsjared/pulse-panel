# Privacy Policy for Pulse Panel
**Effective Date:** September 27, 2026  
**Last Updated:** September 27, 2026  
Pulse Panel ("the Application") is an open-source soundboard application developed by Jared Meadows ("we", "us", or "our"). We respect user privacy and believe in data transparency. This Privacy Policy explains how data, audio recordings, and settings are handled by the Application.
---
### 1. No Collection or Transmission of Personal Information
**Pulse Panel does not collect, transmit, sell, or share any personal information, telemetry, or analytics with the developer or any third party.** 
The Application does not maintain any backend servers or external user tracking services. All processing, recording, and storage operations occur strictly on your local computer.
---
### 2. Information Accessed and Stored Locally
To provide soundboard functionality, Pulse Panel accesses and stores the following data locally on your device:
* **Audio Files and User Recordings:** Audio files imported by the user and any microphone recordings made within the Application are stored entirely on the local file system. Audio capture only occurs when you intentionally initiate a recording within the app.
* **Sound Metadata:** Custom sound labels, tags, volume levels, and playback configurations.
* **Global Hotkeys:** Hotkey keybindings configured to trigger sounds.
* **Application Settings:** User interface preferences, audio device selections, and general application configuration.
#### Storage Location
All configuration data, sound metadata, and application settings are stored locally on your device:
* **Windows:** `%APPDATA%\pulse-panel` (typically `C:\Users\<Username>\AppData\Roaming\pulse-panel`)
* **Linux/macOS:** `~/.config/pulse-panel` or the user profile directory

Files stored in this directory include:
* `pulse-panel.db`: SQLite database storing sound metadata, hotkey bindings, categories, and tags.
* `pulse-panel.json`: Application settings, window state, and audio device preferences.

#### Data Retention, Uninstallation, and Deletion
* **Normal Use:** Audio files, recordings, and settings remain on your local system until you edit or delete them within the Application.
* **On Uninstall:** When uninstalling Pulse Panel via the Windows uninstaller, the uninstaller presents an interactive prompt asking whether you would also like to delete all Pulse Panel data and settings (soundboards, custom recordings, hotkeys, and preferences):
  * **Selecting "Yes":** The uninstaller completely removes `%APPDATA%\pulse-panel`, ensuring no traces of local data or databases remain.
  * **Selecting "No":** The application binaries are removed while preserving `%APPDATA%\pulse-panel` (`deleteAppDataOnUninstall: false`), protecting your custom soundboards and hotkeys if you reinstall in the future.
  * **Silent / Automated Uninstalls:** In unattended uninstallations (such as automated package manager commands), the uninstaller safely defaults to retaining user data to prevent accidental library loss.
* **Manual Deletion:** Users can also manually delete local data at any time:
  1. Press `Win + R` on your keyboard to open the Run dialog.
  2. Type `%APPDATA%` and press Enter.
  3. Locate the `pulse-panel` folder and delete it.

---

### 3. External Network Activity & Optional Privileged Components
Pulse Panel functions completely offline for its core soundboard features. The only external network requests and privileged actions that may occur are:

1. **Optional Virtual Audio Driver Installation (VB-CABLE):**
   Pulse Panel provides an optional convenience feature in Settings to download and install the third-party virtual audio driver (VB-CABLE by VB-Audio) for audio routing:
   * **Network Download:** When initiated by the user, Pulse Panel performs an outbound HTTPS download directly from the official vendor server (`https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip`). No telemetry, analytics, or user identifiers are sent.
   * **Cryptographic Hash Verification:** To prevent tampering and supply-chain risks, the downloaded archive is verified against a pinned SHA-256 cryptographic hash (`66fd0a4d9f4896ff41632b7e3d53892c085c4561f53e8ae8d0f0bc10eedd1cdd`) before extraction. If the hash does not match, the application immediately aborts, deletes the downloaded file, and does not extract or execute anything (fail closed).
   * **Privileged Execution:** Upon successful integrity verification, the setup executable (`VBCABLE_Setup_x64.exe` or `VBCABLE_Setup.exe`) is launched with administrator elevation (prompting a standard Windows UAC confirmation dialog) to install the system driver. The temporary installer files and directories are cleaned up immediately following installation.

2. **External Web Links:** Clicking external links (such as project documentation, release notes, or GitHub issues) will open the destination URL in your default web browser according to that website's privacy practices.
---
### 4. Children’s Privacy
The Application does not collect personal information from anyone, including children under the age of 13.
---
### 5. Changes to This Privacy Policy
If we update this Privacy Policy, the revised version will be published in this repository with an updated revision date.
---
### 6. Contact
If you have questions about this Privacy Policy or Pulse Panel, please open an issue at:  
https://github.com/meadowsjared/pulse-panel/issues
