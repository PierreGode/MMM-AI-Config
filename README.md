# MMM-AI-Config

This module provides a small web interface that leverages OpenAI to update your `MagicMirror` `config.js`.

## Usage

1. Set the environment variable `OPENAI_API_KEY` with your API key (or provide it via the module configuration).
2. Add the module to your `config.js` and start MagicMirror. The configuration interface will automatically launch.
3. Open `http://<magicmirror-ip>:5006` (or your configured port) in a browser and chat your configuration requests using the admin page served from the `public` directory (`admin.html`).

The port can be changed with the `adminPort` configuration option.

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
    showDot: true,
    adminPort: 5006
  }
}
```

Set `showDot` to `false` if you do not want the dot displayed.
