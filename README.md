# MMM-AI-Config

This module provides a small web interface that leverages OpenAI to update your `MagicMirror` `config.js`.

## Usage

1. Set the environment variable `OPENAI_API_KEY` with your API key (or provide it via the module configuration).
2. Add the module to your `config.js` and start MagicMirror. The configuration interface will automatically launch.
3. Open `http://<magicmirror-ip>:5006` (or your configured port) in a browser and chat your configuration requests using the admin page served from the `public` directory (`admin.html`).

The port can be changed with the `adminPort` configuration option.

After sending a request, the server returns the JSON changes proposed by OpenAI. The admin page will show these changes and let you approve or reject them. Only approved changes are written to `config.js`. When a change is applied, the previous file is backed up by appending the current timestamp to its name.

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

Set `showDot` to `false` in your `config.js` if you do not want the dot displayed.
