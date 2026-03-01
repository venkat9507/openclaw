#!/usr/bin/env python3
"""
Web Search Skill for OpenClaw
Uses DuckDuckGo via ddgs - No API key required

Modes:
  - search: Returns search result snippets (fast)
  - deep: Fetches full page content (slower but comprehensive)
"""

try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        # Fallback for some versions where it might be exposed differently
        import sys
        print("Error: Could not import DDGS. Ensure 'ddgs' or 'duckduckgo-search' is installed.", file=sys.stderr)
        sys.exit(1)
import json
import sys
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed


def search(query: str, max_results: int = 5) -> list:
    """
    Search the web using DuckDuckGo (returns snippets only).
    """
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        return results
    except Exception as e:
        return [{"error": str(e)}]


def fetch_page_content(url: str, max_chars: int = 2000) -> str:
    """
    Fetch and extract main text content from a URL.
    """
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Remove scripts, styles, nav, footer
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        
        # Get text from article or main, fallback to body
        main_content = soup.find("article") or soup.find("main") or soup.find("body")
        if main_content:
            text = main_content.get_text(separator=" ", strip=True)
            # Clean up whitespace
            text = " ".join(text.split())
            return text[:max_chars] + "..." if len(text) > max_chars else text
        return ""
    except Exception as e:
        return f"[Error fetching: {str(e)}]"


def deep_search(query: str, max_results: int = 3, max_chars: int = 2000) -> list:
    """
    Search and fetch full content from top results.
    """
    results = search(query, max_results)
    
    if not results or "error" in results[0]:
        return results
    
    # Fetch content in parallel
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_result = {
            executor.submit(fetch_page_content, r["href"], max_chars): r 
            for r in results
        }
        
        for future in as_completed(future_to_result):
            result = future_to_result[future]
            result["full_content"] = future.result()
    
    return results


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: search.py <query> [max_results] [--deep]",
            "examples": [
                "search.py 'AI news' 5",
                "search.py 'AI news' 3 --deep"
            ]
        }, indent=2))
        sys.exit(1)
    
    query = sys.argv[1]
    max_results = 5
    deep_mode = "--deep" in sys.argv
    
    # Parse max_results if provided
    for arg in sys.argv[2:]:
        if arg.isdigit():
            max_results = int(arg)
    
    if deep_mode:
        results = deep_search(query, max_results)
    else:
        results = search(query, max_results)
    
    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
