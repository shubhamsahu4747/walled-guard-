# Walled Guard - Chrome & Edge Companion Extension

This browser companion enables **Walled Guard DLP** protection directly inside standalone external browsers (Google Chrome, Microsoft Edge, Brave, etc.).

It monitors user interactions with:
- **ChatGPT Web**: `https://chatgpt.com`
- **Perplexity Web**: `https://www.perplexity.ai`

---

## Architecture Overview

```
┌─────────────────────────────────┐
│     Google Chrome / Edge        │
│  (chatgpt.com / perplexity.ai)  │
│                                 │
│     [ content.js ]              │  <-- Intercepts Enter / Click / Drop events
│           │                     │  <-- Injects AI response recolor (#00A86B)
│     [ background.js ]           │
└───────────┬─────────────────────┘
            │ Chrome Native Messaging (stdio JSON)
┌───────────▼─────────────────────┐
│   Walled Guard Native Host      │
│   (scripts/native-host.cjs)     │
│                                 │
│  - Inspects text & file buffers │
│  - Detects WALLED_SENSITIVE     │
│  - Spawns Native Desktop Dialog │  <-- Windows Forms OS-native modal
│  - Returns CONTINUE / CANCEL    │
└─────────────────────────────────┘
```

---

## 1-Minute Setup Instructions

### Step 1: Register Native Messaging Host
In this repository root, run the registration script (double-click or run from terminal):
```cmd
scripts\register-chrome-host.bat
```
This registers the Native Messaging Host manifest in your Windows Registry under `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.walledguard.native`.

### Step 2: Load Extension in Chrome or Edge
1. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
   *(For Microsoft Edge, navigate to `edge://extensions/`)*
2. Turn on the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the `extension` folder inside this repository:
   ```
   e:\personal-project\walled-guard\extension
   ```
5. The extension will appear with ID `jcbcffpofhmgdhgklfpkdkokojkkgjnf`.

---

## Testing in Real Browser

### Test A: Sensitive Prompt Interception
1. In Chrome, open `https://chatgpt.com` or `https://www.perplexity.ai`.
2. Type:
   ```
   Please summarize the department WALLED_SENSITIVE budget projection.
   ```
3. Press **Enter** or click the **Send** button.
4. **Result**:
   - The native desktop dialog appears immediately with **Warning** icon, prompt snippet, and **[ OK ]** (Continue) / **[ Cancel ]** buttons.
   - If you click **Cancel**: The prompt submission is blocked and your prompt remains in the input box so you can edit it.
   - If you click **OK** (Continue): The prompt is submitted normally.

### Test B: Clean Prompt
1. Type a regular prompt without the marker (e.g. `Hello! What is DLP?`).
2. Press Enter.
3. **Result**: Submitted instantly with zero interruption.

### Test C: Response Text Recoloring
1. When ChatGPT or Perplexity generates a response, all AI text is recolored to Spring Green (`#00A86B`) while keeping code blocks, syntax highlighting, links, and tables readable.

---

## Uninstallation
To remove the registry entry:
```cmd
scripts\unregister-chrome-host.bat
```
