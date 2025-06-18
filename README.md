# MMM-AI-Config

This module provides a small web interface that leverages OpenAI to update your `MagicMirror` `config.js`.

## Usage

1. Set the environment variable `OPENAI_API_KEY` with your API key.
2. Run `node server.js` inside this folder.
3. Open `http://localhost:8080` in a browser and chat your configuration requests.

Every change will back up the existing `config.js` file by appending the current timestamp to the file name before writing the new content returned by OpenAI.
