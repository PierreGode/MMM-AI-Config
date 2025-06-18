# MMM-AI-Config

This module provides a small web interface that leverages OpenAI to update your `MagicMirror` `config.js`.

## Usage

1. Set the environment variable `OPENAI_API_KEY` with your API key.
2. Run `node server.js` inside this folder.
3. Open `http://localhost:8080` in a browser and chat your configuration requests.

Every change will back up the existing `config.js` file by appending the current timestamp to the file name before writing the new content returned by OpenAI.

## MagicMirror Module

This repository also includes a simple MagicMirror module that displays a status dot. The module checks the configured OpenAI API key at startup and shows a green dot when the key appears to work.

Add the module to your `config.js`:

```javascript
{
  module: "MMM-AI-Config",
  position: "top_left",
  config: {
    openAiApiKey: "YOUR_OPENAI_API_KEY",
    showDot: true
  }
}
```

Set `showDot` to `false` if you do not want the dot displayed.
