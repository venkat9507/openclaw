import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def start_browser():
    chrome_options = Options()
    
    # 1. Path to your confirmed Default Profile
    user_data = "/Users/venkatraman/Library/Application Support/Google/Chrome"
    chrome_options.add_argument(f"--user-data-dir={user_data}")
    chrome_options.add_argument("--profile-directory=Default")

    # 2. REQUIRED FOR OPENCLAW: Open the debugging port
    chrome_options.add_argument("--remote-debugging-port=9222")

    # 3. PRE-APPROVE OPENCLAW PERMISSION
    # Change 'http://localhost:3000' to whatever URL triggers your OpenClaw app
    prefs = {
        "protocol_handler.allowed_origin_protocol_pairs": {
            "http://localhost:3000": { 
                "openclaw": True
            }
        }
    }
    chrome_options.add_experimental_option("prefs", prefs)
    chrome_options.add_experimental_option("detach", True)

    try:
        # Kill any hanging Chrome processes
        os.system('pkill -9 "Google Chrome"')
        os.system('rm -f ~/Library/Application\ Support/Google/Chrome/SingletonLock')
        
        driver = webdriver.Chrome(options=chrome_options)
        driver.get("http://localhost:3000") # Your app URL
        print("✅ Browser is up and Permission is injected.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    start_browser()
