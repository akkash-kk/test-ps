# Photo Studio for Figma

This development plugin opens the deployed Photo Studio editor inside Figma. Select one layer with a visible image fill, edit it in Photo Studio, then choose **Send to Figma** to replace that image fill with the exported PNG.

## Install for development

1. In the Figma desktop app, choose **Plugins → Development → New plugin**, select **Figma design** and **Custom UI**, and save the starter plugin somewhere temporary.
2. Copy the generated plugin ID from the starter plugin's `manifest.json` into this folder's `manifest.json`, replacing the example ID.
3. Choose **Plugins → Development → Import plugin from manifest…** and select this folder's `manifest.json`.
4. Select a single rectangle, frame, or other layer with an image fill, then run **Photo Studio** from **Plugins → Development**.
5. Make edits and click **Send to Figma** in the plugin toolbar.

The editor URL is set in `manifest.json`, `ui.html`, and the app bridge. If you deploy the app at another URL, update those references and the plugin's allowed network domain.

The plugin currently supports one selected image fill at a time. It replaces the original image fill with a full-resolution PNG fitted to the same layer bounds; the original image crop is not retained. Other fills and the layer itself remain in the Figma document.
