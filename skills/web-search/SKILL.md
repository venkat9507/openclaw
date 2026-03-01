---
name: web-search
description: Search the web using DuckDuckGo (no API key required)
user-invocable: true
command-dispatch: tool
command-tool: web_search
command-arg-mode: raw
---

# Web Search Skill

Provides web search capability without requiring API keys.

## Usage

### Automatic (Built-in Tool)

The web_search tool is automatically available to agents. Ask the AI to search:

- "Search the web for latest AI news"
- "Find information about Python programming"
- "Look up weather in Chennai"

### Manual (Slash Command)

Use the `/web-search` command to directly invoke the tool:

```
/web-search <query> [max_results]
```

Examples:

- `/web-search OpenAI 5`
- `/web-search Python tutorials 3`
- `/web-search best practices for web development`

## Commands

```bash
# Basic search
python3 ~/.openclaw/skills/web-search/search.py "your query"

# With result limit
python3 ~/.openclaw/skills/web-search/search.py "your query" 10
```

## Output Format

Returns JSON array:

```json
[
  {
    "title": "Result Title",
    "href": "https://example.com",
    "body": "Snippet of the content..."
  }
]
```

## Notes

- No API key required
- Uses DuckDuckGo search
- Rate limiting: Be reasonable with usage to avoid blocks
