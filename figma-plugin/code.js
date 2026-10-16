figma.showUI(__html__, {
  width: 1280,
  height: 800,
  themeColors: true,
});

let targetNodeId = null;
let targetImageHash = null;
let targetFillIndex = -1;

function reportError(error) {
  figma.ui.postMessage({
    type: 'error',
    message: error instanceof Error ? error.message : String(error),
  });
}

function imageMimeType(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  if (
    String.fromCharCode(...bytes.slice(0, 6)) === 'GIF87a' ||
    String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a'
  )
    return 'image/gif';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' &&
    String.fromCharCode(...bytes.slice(8, 12)).includes('avif')
  )
    return 'image/avif';
  throw new Error('This image format is not supported. Use PNG, JPEG, WebP, GIF, or AVIF.');
}

async function loadSelection() {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) {
    targetNodeId = null;
    throw new Error('Select one Figma layer with an image fill, then try again.');
  }

  const node = selection[0];
  if (!('fills' in node) || !Array.isArray(node.fills)) {
    targetNodeId = null;
    throw new Error('The selected layer does not have editable image fills.');
  }

  const fillIndex = node.fills.findIndex(
    (fill) => fill.type === 'IMAGE' && fill.visible !== false,
  );
  if (fillIndex < 0) {
    targetNodeId = null;
    throw new Error('The selected layer has no visible image fill.');
  }

  const fill = node.fills[fillIndex];
  const image = figma.getImageByHash(fill.imageHash);
  if (!image) {
    targetNodeId = null;
    throw new Error('Figma could not read the selected image.');
  }
  const bytes = await image.getBytesAsync();
  const mimeType = imageMimeType(bytes);

  targetNodeId = node.id;
  targetImageHash = fill.imageHash;
  targetFillIndex = fillIndex;
  figma.ui.postMessage({
    type: 'load-image',
    name: `${node.name || 'Figma image'}.${mimeType.split('/')[1]}`,
    mimeType,
    bytes,
  });
}

async function replaceSelection(message) {
  if (!targetNodeId || targetFillIndex < 0 || !message.bytes) {
    throw new Error('Load an image from Figma before sending an edit back.');
  }
  const node = figma.getNodeById(targetNodeId);
  if (!node || !('fills' in node) || !Array.isArray(node.fills)) {
    throw new Error('The original Figma layer is no longer available. Load it again.');
  }
  const fills = [...node.fills];
  const originalFill = fills[targetFillIndex];
  if (originalFill?.type !== 'IMAGE' || originalFill.imageHash !== targetImageHash) {
    throw new Error('The original Figma image changed while you were editing. Load it again to avoid overwriting changes.');
  }

  const bytes =
    message.bytes instanceof Uint8Array ? message.bytes : new Uint8Array(message.bytes);
  const image = figma.createImage(bytes);
  const replacement = {
    ...originalFill,
    imageHash: image.hash,
    scaleMode: 'FILL',
  };
  delete replacement.imageTransform;
  fills[targetFillIndex] = replacement;
  node.fills = fills;
  targetImageHash = image.hash;
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
  figma.notify(`Updated ${node.name} with the edited image.`);
  figma.ui.postMessage({ type: 'image-updated', name: node.name });
}

figma.ui.onmessage = (message) => {
  if (message.type === 'editor-ready' || message.type === 'load-selection') {
    void loadSelection().catch(reportError);
    return;
  }
  if (message.type === 'exported-image') {
    void replaceSelection(message).catch(reportError);
  }
};
