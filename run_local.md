# OpenClaw Browser Tool: The Complete Guide

This guide covers how to set up and use the OpenClaw Browser Tool reliably on your local machine.

## 1. Install the CLI & Gateway

First, get the core software running on your machine. The Gateway handles the connection between the agent and your browser.

```bash
# 1. Install OpenClaw CLI (if not already installed)
npm install -g openclaw

# 2. Install the Gateway Service (makes it run in background automatically)
openclaw gateway install

# 3. Start the Gateway
openclaw gateway start

# 4. Verify Status
# Should say "Service: LaunchAgent (loaded)" and "RPC probe: ok"
openclaw gateway status
```

## 2. Install the Browser Relay Extension

You must install the Chrome extension to let the agent talk to your browser.

1.  **Download:** Use the source code from your OpenClaw installation.
2.  **Load in Chrome:**
    - Go to `chrome://extensions`
    - Enable **Developer Mode** (toggle in the top right).
    - Click **Load Unpacked**.
    - Select the `browser/chrome-extension` folder inside your OpenClaw install directory.

## 3. Configure the Extension & Chrome

Configuration is critical for connection stability.

1.  **Pin the Icon:** Click the puzzle piece 🧩 in Chrome toolbar and **Pin** OpenClaw Relay. You need quick access to this button.
2.  **Check Port:**
    - Right-click the OpenClaw icon -> **Options**.
    - Ensure the "Relay port" matches your gateway (default is `18789` or `18792`). Use `openclaw gateway status` to check your specific port.
    - Click **Save**.
3.  **Prevent Tab Sleeping (Crucial):**
    - Go to `chrome://settings/performance`.
    - Turn **OFF** "Memory Saver".
    - (Optional) Add `http://localhost` and your target sites to the "Always keep these sites active" list.
    - _Why?_ If Chrome puts the tab to sleep, the agent loses connection immediately.

## 4. How to Use (The Workflow)

To run an automation task:

1.  **Open your target tab** (e.g., LinkedIn, Google).
2.  **Click the OpenClaw Icon** on that specific tab.
    - The badge **must turn GREEN / ON**.
    - _If Red 🔴:_ The Gateway isn't running. Run `openclaw gateway start` in your terminal.
3.  **Leave this tab open.** Do not close it or navigate away manually if possible.
4.  **Issue Command to Agent:**
    > "Navigate the attached tab to linkedin.com and search for Flutter jobs."

## 5. Managed Browser (Advanced)

If you want the agent to launch its own isolated browser window (clean slate, no cookies):

1.  **Enable Managed Mode:**
    ```bash
    openclaw gateway config.patch '{"browser":{"attachOnly":false}}'
    openclaw gateway restart
    ```
2.  **Issue Command:**
    > "Launch a managed browser and search Google for..."

---

_Save this file for future reference when setting up new environments._
