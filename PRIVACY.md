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
All configuration data, sound metadata, and application settings are stored locally on your device (typically under `%APPDATA%\pulse-panel` or the application's local user directory).
#### Data Retention and Deletion
All audio files, recordings, and settings remain on your local system until you choose to delete them within the Application, delete the configuration folder manually, or uninstall the software.
---
### 3. External Network Activity
Pulse Panel functions completely offline for its core features. The only external network requests that may occur are:
1. **Optional VB-CABLE Download:** If you choose to install the optional virtual audio driver (VB-CABLE) from within the Application, Pulse Panel initiates an outbound HTTPS download directly to the official vendor (VB-Audio) to fetch the installer package. No user data, telemetry, or system identifiers are sent during this request.
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
