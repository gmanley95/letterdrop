# Letterdrop

A daily word game for iPhone and Android: drop balls through a board of letters, collect what they hit, and build Scrabble-scored words. Your share score is your top 3 words out of up to 5.

Built with **Expo (React Native) + TypeScript**. Game logic in `src/engine/` is plain TypeScript (no React), so it can be tested in Node.

## Requirements
- Node.js 20+ and npm
- iPhone or Android phone with the **Expo Go** app, **or** an Android emulator / iOS simulator (simulator needs a Mac)

## Run it

```bash
cd letterdrop
npm install          # .npmrc sets legacy-peer-deps=true (RN 0.88 RC peer ranges)
npm run web          # quickest: opens in your browser
npm start            # scan the QR code with Expo Go (iPhone camera / Android Expo Go)
npm run android      # Android emulator
npm run ios          # iOS simulator (macOS only)
```

### Visual Studio Code
Open the `letterdrop` folder. Recommended extensions are listed in `.vscode/extensions.json`.
- **Terminal → Run Task…** → `Expo: start`, `Expo: web`, `Test`, `Typecheck`, `Simulate balance`.
- **Run and Debug** → `Debug engine tests` (breakpoints in `src/engine` and `tests`).

### Visual Studio 2022
Use **File → Open → Folder…** on `letterdrop`, then open **View → Terminal** and run the npm commands above. (VS 2022 has no Expo project type; Open Folder plus the terminal is the supported route. VS Code is the smoother option.)

## Android emulator on Windows

Use **VS Code to edit the app** and **Android Studio to install and start the virtual phone**. The emulator runs in its own window; the project does not need to be open in Android Studio.

### 1. Install the Android tools and create a virtual phone

1. Install Android Studio and complete its setup wizard.
2. Open **SDK Manager** (from the welcome screen's **More Actions**, or the **Tools** menu when a project is open). Note the **Android SDK Location**.
3. Under **SDK Tools**, install **Android Emulator** and **Android SDK Platform-Tools**.
4. Open **Device Manager** (it may be called **Virtual Device Manager** on the welcome screen). Choose **Create Device**, select a phone such as a Pixel, then select and download an Android system image recommended for your computer.
5. Finish creating the device and press its **Play** button. Wait until the virtual phone shows its Android home screen.

If the emulator reports missing virtualization support, follow Android Studio's diagnostic instructions. Windows feature or BIOS changes may require administrator access and a restart.

### 2. Let VS Code find the Android SDK

In Windows, search for **Edit environment variables for your account**:

- Create a user variable named `ANDROID_HOME` with the SDK location from SDK Manager. The usual location is `C:\Users\grantmanley\AppData\Local\Android\Sdk`; use the actual installed location.
- Add these two entries to your user **Path**:

```text
%ANDROID_HOME%\emulator
%ANDROID_HOME%\platform-tools
```

Completely close and reopen VS Code after changing the environment. In a new terminal, check:

```powershell
emulator -list-avds
adb --version
adb devices
```

The first command should list your virtual phone. After it boots, `adb devices` should show an `emulator-...` entry with status `device`.

### 3. Load Letterdrop onto the virtual phone

Open `C:\Users\grantmanley\trash\letterdrop` in VS Code, then choose **Terminal > New Terminal**:

```powershell
Set-Location 'C:\Users\grantmanley\trash\letterdrop'
# First-time setup only, or after dependencies change:
npm install
# With the virtual phone already running:
npm run android
```

Keep that terminal running. Expo starts its development server and attempts to open the app on Android. If it asks to install Expo Go on the emulator, follow that prompt. Expo Go must support the Expo SDK used by this project; an incompatible client cannot load it.

If a development server is already running in this folder, use its **a** shortcut to open Android rather than starting another server. Stop any old server running from the original chat folder if you want to avoid testing the wrong copy. If Expo offers another port, note which terminal belongs to this project.

Save edits in VS Code to update the running app. Press **r** in the Expo terminal to reload when needed. Press **Ctrl+C** to stop the server. Once the virtual phone is running, you can close the Android Studio editor and leave the emulator window open.

The optional **React Native Tools** VS Code extension can launch an existing virtual device through **React Native: Launch Android Emulator**. It does not install the SDK or create virtual phones. For this Expo project, use `npm run android` to start the app.

### Run on a physical Android phone

1. Install an Expo Go version compatible with this project's Expo SDK.
2. Connect the phone and computer to the same Wi-Fi network.
3. In the copied project folder, run `npm start`.
4. Open Expo Go on the phone and scan the QR code shown in the terminal.
5. Keep the development server running while testing. Saved edits update the app; use Reload in Expo Go if needed.

If the phone cannot connect, check that a VPN, guest Wi-Fi isolation or firewall is not blocking access to the development server. Do not disable your firewall; allow the relevant development-server connection only if appropriate for your network.

### Troubleshooting

| Symptom | What to check |
|---|---|
| Error 305 or `'emulator' is not recognized` | Install Android Emulator in SDK Manager, add its folder to Path, and completely restart VS Code. |
| `emulator -list-avds` prints nothing | Create a virtual phone in Device Manager. |
| `adb` is not recognized | Install Platform-Tools and add its folder to Path. |
| No emulator in `adb devices` | Start the virtual phone and wait for Android to finish booting. |
| Emulator is listed as `offline` | Wait for boot to finish; if it stays offline, restart that virtual device in Device Manager. |
| Expo Go says the project SDK is unsupported | Use a compatible Expo Go client, or set up a development build for the project. Do not change the project's SDK just to dismiss the warning. |
| Edits do not appear | Confirm VS Code and the Expo terminal both use `C:\Users\grantmanley\trash\letterdrop`, then reload. |

## Scripts
| Command | What it does |
|---|---|
| `npm test` | Engine unit tests (`node:test` via tsx) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run simulate` | Balance / post-design check, writes `docs/balance-results.json` (`-- --rounds 2000 --days 365`) |
| `npm run build:dict` | Rebuild `src/data/words.ts` from `enable1.txt` |

## Project layout
```
App.tsx                 state-based navigation (sign-in → home → game → results; settings, how-to)
src/engine/             rules, rng, letters, board, physics, ballConfig, dictionary, scoring, session, daily, results
src/components/         Board (SVG + gestures), shared UI
src/screens/            SignIn, Home, Game, Results, Settings, HowTo
src/state/AppContext    user, settings, stats, theme, haptics
src/storage.ts          AsyncStorage persistence (device only)
scripts/                build-dictionary.mjs, simulate.ts
tests/                  engine tests
docs/                   product brief, decisions, rules, balance report, requirements audit
```

Word list: ENABLE (public domain), 3–10 letters.
