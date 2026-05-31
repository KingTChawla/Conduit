# Conduit

**Hotspot your phone's internet — even when your carrier says no.**

[![Download APK](https://img.shields.io/badge/Download-APK-brightgreen?style=for-the-badge&logo=android)](https://github.com/KingTChawla/Conduit/releases/latest/download/Conduit.apk)

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Platform: Android](https://img.shields.io/badge/Platform-Android-green.svg)](https://developer.android.com)
[![PRs: Not Accepted](https://img.shields.io/badge/PRs-not%20accepted-lightgrey.svg)](#)

---

## What It Does

Carriers block mobile hotspot to upsell data plans. Conduit works around this by creating a WiFi Direct peer-to-peer network instead of a standard hotspot, then routing traffic through a local HTTP CONNECT proxy. No root required. No subscription. One tap.

---

## How It Works

- Your phone becomes a **WiFi Direct Group Owner** at `192.168.49.1`
- An **HTTP CONNECT proxy** runs on port `8080`, forwarding TCP traffic over your mobile data
- Peer devices connect to the WiFi Direct network and set a manual proxy (`192.168.49.1:8080`) in their WiFi settings
- Because WiFi Direct is a device-to-device protocol, it bypasses the carrier's hotspot detection that targets standard tethering

---

## Features

- Single-tap activation — no configuration required to start
- No root required
- Works on Android 10 and above
- Customizable SSID and password
- 2.4 GHz / 5 GHz band selection
- Real-time stats: connected peers and data transferred
- Persistent foreground service with notification (keeps the proxy alive)
- No ads, no tracking, no analytics

---

## Quick Start

1. Download the APK from the [Releases](../../releases) page
2. Install it and grant the requested permissions (Location / Nearby Devices)
3. Tap the power button in the app
4. On the peer device:
   - Connect to the WiFi network shown in the app
   - Open WiFi settings for that network
   - Set **Proxy** to **Manual**
   - Host: `192.168.49.1` — Port: `8080`
   - Save and open a browser to confirm connectivity

---

## What Works

Everything that uses standard HTTP/HTTPS over TCP works through Conduit:

- Web browsing (Chrome, Firefox, Safari, etc.)
- Social media (Instagram, Twitter/X, Reddit, Facebook, Threads)
- Messaging (WhatsApp text/images, Telegram, Signal, iMessage)
- Email (Gmail, Outlook, Yahoo)
- Streaming video (YouTube, Netflix, Twitch, Disney+)
- Streaming music (Spotify, Apple Music, YouTube Music)
- App stores and updates (Google Play, App Store)
- Cloud storage (Google Drive, Dropbox, iCloud)
- Maps and navigation (Google Maps, Waze, Apple Maps)
- News, shopping, banking, and most productivity apps

---

## What Doesn't Work

- **VoIP and video calls** — Zoom, FaceTime, Discord voice, WhatsApp calls (requires UDP)
- **Online gaming** — most multiplayer games use UDP for real-time communication
- **VPN apps** — these typically bypass the system proxy entirely
- **Some streaming apps** — apps that use custom networking stacks instead of the system proxy
- **Peer-to-peer transfers** — BitTorrent, AirDrop-style features

The manual proxy must be configured on each connecting device. This is a one-time step per network. Connection reliability depends on WiFi Direct support quality, which varies by device manufacturer.

---

## vs. Alternatives

| App | Root Required | Free | Open Source | Carrier Bypass | Setup |
|---|---|---|---|---|---|
| **Conduit** | No | Yes | Yes (GPL-3.0) | Yes | Easy |
| PDANet+ | No | Partial | No | Yes | Medium |
| NetShare | No | Partial | No | Yes | Easy |
| FoxFi | No | Partial | No | Partial | Easy |
| VPN Hotspot | No | Partial | Yes | No | Medium |

---

## Building from Source

```bash
git clone https://github.com/KingTChawla/Conduit.git
cd Conduit
npm install
npm run android
```

Requires Node >= 22.11.0, Android SDK, and a connected Android device or emulator. See [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment) for prerequisites.

---

## Tech Stack

- React Native 0.85 (bare workflow, New Architecture enabled)
- Kotlin native modules
- WiFi Direct (Android Wi-Fi P2P API)
- HTTP CONNECT proxy (custom implementation)

---

## License

GPL-3.0. See [LICENSE](LICENSE).

---

## Disclaimer

Bypassing carrier hotspot or tethering restrictions may violate your carrier's terms of service. Review your plan's terms before use. This software is provided as-is, with no warranty. Use at your own risk.

---

[![Download APK](https://img.shields.io/badge/Download-APK-brightgreen?style=for-the-badge&logo=android)](https://github.com/KingTChawla/Conduit/releases/latest/download/Conduit.apk)
