# Multi-AI — Ask Every AI at Once, Get the Best Answer

Free, standalone web tool. No server, no login, no payment. Your files and keys never leave your device.

## What it does

Ask a question once and the tool sends it to **every AI provider you connected, in parallel**. Each answer appears in its own card — provider name, model, status, word count and time taken. Failed providers never block the others; retry just the failed ones.

Then build one **Best Answer**:
- **Pick manually** — tap "Use this as best" on any answer card.
- **AI judge** — one of your providers (your choice) reads all the answers, ranks them, and merges the strongest, most accurate parts into one improved answer, clearly labelled as judge-merged.

## How to add providers

1. Tap **+ OpenRouter (free model)** or **+ FreeModel** and paste your own API key when asked, or tap **+ Custom provider** and fill in name, endpoint URL, model and key.
2. Toggle providers on/off, tap **Test** to check a key with a tiny request, or **Delete** to remove one.
3. Keys are stored **only in your browser's localStorage**. They are sent only to the provider endpoint you added. Never paste passwords, wallet seed phrases or bank details into the tool.

## How Best Answer works

- Manual pick keeps the answer exactly as that provider wrote it.
- The AI judge receives the original question plus every successful answer, ranks them, and writes one final answer from the strongest parts, fixing errors and removing repetition. The judge is one of your own connected providers, chosen in the dropdown.

## History

Your last 10 Q&A rounds are saved in this browser only. Tap a round to reload its question and answers. **Clear history** wipes them.

## Deploy (GitHub Pages)

1. Create a public repo (e.g. `multi-ai`) and upload `index.html`, `style.css`, `app.js`, `README.md` to the root.
2. Settings → Pages → Deploy from a branch → `main` / root.
3. Open `https://<username>.github.io/multi-ai/`.

## Privacy

No account, no tracking of prompts, no server. The only network requests are the ones you trigger, to the AI providers you added, with the keys you entered.
