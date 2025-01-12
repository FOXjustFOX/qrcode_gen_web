/**
 * Main script for generating and manipulating a QR code on an HTML canvas.
 * Includes debouncing, toggles for transparency, background images,
 * logo embedding, rotation, and download/copy functionality.
 */

// --------------------------------------------------------------------
// 1. ELEMENT REFERENCES + GLOBAL CONSTANTS
// --------------------------------------------------------------------
/** Text input field for the QR code content */
const textInput = document.getElementById("text");

/** Main <canvas> element where the final QR (rotated, etc.) is displayed */
const qrCanvas = document.getElementById("canvas");

/** Color input for the QR code modules */
const qrColorInput = document.getElementById("qrColor");

/** Color input for the background color */
const bgColorInput = document.getElementById("bgColor");

/** Label for the background color input (we toggle its visibility) */
const bgColorLabel = document.getElementById("bgColorLabel");

/** Container div for the QR code (not critical, but can be styled) */
const qrbg = document.getElementById("bg");

/** Button to download the generated QR code as PNG */
const downloadBtn = document.getElementById("downloadBtn");

/** Button to copy the QR code image to clipboard */
const copyBtn = document.getElementById("copyBtn");

/** The base dimension for the QR code, unscaled */
const qrSize = 300;

/** Path to the SVG logo that can be placed in the center of the QR */
const logoSrc = "WRSS_WIT_Logo.svg";

/** Logo dimension relative to the QR code size */
let logoSize = qrSize * 0.2;

/** Factor by which we create a larger offscreen canvas (for sharper rendering) */
const offscreenScale = 3;

/** The scaled (actual) size for the logo in the offscreen canvas */
const scaledLogoSize = logoSize * offscreenScale;

/** Safe zone around the logo, so modules in that area are skipped */
const scaledSafeZone = scaledLogoSize * 1.1;

/** Each QR cell’s dimension is computed from (usableSize / modules.size) */
let cellSize;

/** Margin around the QR code in the offscreen canvas */
const margin = 20;

/** Checkbox to toggle transparent background */
const transparentBg = document.getElementById("transparentBg");

/** Label for the background image input */
const backgroundImageLabel = document.getElementById("bgImageLabel");

/** Checkbox to include/exclude the logo in the QR code center */
const includeLogoCheckbox = document.getElementById("includeLogo");

/** Some unused references from older code (kept for reference) */
const logoWidth2 = qrCanvas / 2;
const logoHeight2 = qrCanvas / 2;

/** Button to remove the chosen background image */
const removeBgImageBtn = document.getElementById("removeBgImgBtn");

/** Range input for rotation (0–360) */
const rotationRange = document.getElementById("rotationRange");

/** A second input (text/number) to display the rotation value */
const rotationValueDisplay = document.getElementById("rotationValue");

// --------------------------------------------------------------------
// 2. HIGH-DPI CANVAS ADJUSTMENT
// --------------------------------------------------------------------
/**
 * Adjusts a given canvas for high DPI (retina) displays, factoring in
 * window.devicePixelRatio. Returns the 2D rendering context.
 *
 * @param {HTMLCanvasElement} canvas - The canvas to adjust
 * @param {number} width - The desired CSS width
 * @param {number} height - The desired CSS height
 * @return {CanvasRenderingContext2D} The 2D context with scale applied
 */
function adjustCanvasForHighDPI(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr; // Scale the canvas resolution
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  // We can set a fillStyle here if desired, but note that we typically
  // fillRect or clearRect as needed in our drawing logic.
  ctx.scale(dpr, dpr); // Scale all drawings to match devicePixelRatio
  return ctx;
}

// --------------------------------------------------------------------
// 3. UI / VISIBILITY UPDATES
// --------------------------------------------------------------------
/**
 * Hide or show background color and image inputs based on whether
 * "transparent background" is checked.
 */
function updateBackgroundColorLabel() {
  if (transparentBg.checked) {
    // Hide the color picker and BG image input
    bgColorInput.style.display = "none";
    bgColorLabel.style.display = "none";
    bgImageInput.style.display = "none";

    // Reset background image
    bgImageInput.value = "";
    backgroundImageSrc = null;
    removeBgImageBtn.style.display = "none";
    backgroundImageLabel.style.display = "none";
  } else {
    // Show them again
    bgColorInput.style.display = "";
    bgColorLabel.style.display = "";
    bgImageInput.style.display = "";
    backgroundImageLabel.style.display = "";
  }
}

// --------------------------------------------------------------------
// 4. DEBOUNCING LOGIC
// --------------------------------------------------------------------
let debounceTimer;

/**
 * Wraps the generateQR call in a 300ms debounce, so we don't call generateQR
 * on every keystroke or tiny change too frequently.
 */
function generateQRDebounced() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    generateQR();
  }, 300);
}

// --------------------------------------------------------------------
// 5. MAIN QR GENERATION
// --------------------------------------------------------------------
/**
 * Generates (or re-generates) the QR code with the current user inputs:
 * - text content
 * - colors
 * - transparent BG or BG image
 * - rotation
 * - optional logo
 *
 * Draws the result onto the main canvas (640×640) with the chosen rotation.
 */
async function generateQR() {
  const text = textInput.value.trim();
  const qrColor = qrColorInput.value;
  const bgColor = bgColorInput.value;

  // The display size for the main canvas (where we apply rotation, etc.)
  const displaySize = 640;

  // If no text, clear the canvas and hide the download/copy buttons
  if (!text) {
    const mainCtx = adjustCanvasForHighDPI(qrCanvas, displaySize, displaySize);
    mainCtx.clearRect(0, 0, displaySize, displaySize);

    downloadBtn.style.display = "none";
    copyBtn.style.display = "none";
    return;
  }

  // 1) Create an offscreen canvas to draw the raw QR code
  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = qrSize * offscreenScale; // e.g., 900
  offscreenCanvas.height = qrSize * offscreenScale; // e.g., 900
  const offscreenCtx = offscreenCanvas.getContext("2d");

  // 2) Draw the entire QR code (modules + optional BG + optional logo)
  //    onto the offscreen context
  await drawQrToCtx(offscreenCtx, text, qrColor, bgColor);

  // 3) Determine user-chosen rotation
  const rotationDegrees = parseFloat(rotationRange.value) || 0;

  // 4) Prepare the main canvas
  const mainCtx = adjustCanvasForHighDPI(qrCanvas, displaySize, displaySize);
  mainCtx.clearRect(0, 0, displaySize, displaySize);

  // 5) Apply the rotation transform and draw the offscreen canvas
  mainCtx.save();
  mainCtx.translate(displaySize / 2, displaySize / 2);
  mainCtx.rotate((rotationDegrees * Math.PI) / 180);

  // Here, we're drawing a 450×450 sub-region from the 900×900 QR
  // so it fits nicely in the 640×640 main canvas, centered.
  mainCtx.drawImage(
    offscreenCanvas,
    -450 / 2, // -225
    -450 / 2, // -225
    450,
    450
  );
  mainCtx.restore();

  // 6) Show the download/copy buttons
  downloadBtn.innerText = "Download QR Code";
  copyBtn.innerText = "Copy QR Code to clipboard";

  downloadBtn.style.display = "block";
  copyBtn.style.display = "block";
}

// --------------------------------------------------------------------
// 6. DRAWING THE QR + OPTIONAL LOGO
// --------------------------------------------------------------------
/**
 * Draws the QR code (and optional logo/background) onto a given 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D context of the offscreen canvas
 * @param {string} text - The text/URL to encode
 * @param {string} qrColor - Color for the QR modules
 * @param {string} bgColor - Color for the background (if not transparent/IMG)
 */
async function drawQrToCtx(ctx, text, qrColor, bgColor) {
  // 1) Clear offscreen
  ctx.clearRect(0, 0, qrSize * offscreenScale, qrSize * offscreenScale);

  // 2) Optionally draw a background image or fill with bgColor
  if (backgroundImageSrc && !transparentBg.checked) {
    // If user selected an image
    await drawBgImage(ctx, backgroundImageSrc, qrSize * offscreenScale, qrSize * offscreenScale);
  } else if (!transparentBg.checked) {
    // If no image but not transparent, fill with bgColor
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, qrSize * offscreenScale, qrSize * offscreenScale);
  }

  // 3) Generate the QR data (QRCode.create returns a promise)
  const qrCode = await QRCode.create(text, { errorCorrectionLevel: "H" });

  // 4) Draw the QR modules
  const margin = 20 * offscreenScale;
  const usableSize = (qrSize - 2 * 20) * offscreenScale;
  const cellSize = usableSize / qrCode.modules.size;

  // The “safe zone” for the logo in the center
  const logoStart = margin + (usableSize - scaledSafeZone) / 2;
  const logoEnd = logoStart + scaledSafeZone;

  qrCode.modules.data.forEach((bit, index) => {
    const col = index % qrCode.modules.size;
    const row = Math.floor(index / qrCode.modules.size);

    const x = margin + col * cellSize;
    const y = margin + row * cellSize;

    // For bounding-box intersection
    const cellLeft = x;
    const cellTop = y;
    const cellRight = x + cellSize;
    const cellBottom = y + cellSize;

    const zoneLeft = logoStart;
    const zoneTop = logoStart;
    const zoneRight = logoEnd;
    const zoneBottom = logoEnd;

    // If the cell intersects the safe zone (for the logo)...
    const intersectsSafeZone = !(cellRight < zoneLeft || cellLeft > zoneRight || cellBottom < zoneTop || cellTop > zoneBottom);

    const logoIsActive = includeLogoCheckbox.checked;
    // If user wants the logo and the cell intersects, skip drawing it
    if (logoIsActive && intersectsSafeZone) {
      return;
    }

    // Otherwise, fill the module
    if (bit) {
      // “bit” is true => black module
      ctx.fillStyle = qrColor;
      ctx.fillRect(Math.floor(cellLeft), Math.floor(cellTop), Math.ceil(cellSize), Math.ceil(cellSize));
    } else if (!transparentBg.checked && !backgroundImageSrc) {
      // “bit” is false => white module, so fill with bgColor if not transparent
      ctx.fillStyle = bgColor;
      ctx.fillRect(Math.floor(cellLeft), Math.floor(cellTop), Math.ceil(cellSize), Math.ceil(cellSize));
    }
  });

  // 5) If the user wants the logo, draw it centered in the safe zone
  if (includeLogoCheckbox.checked) {
    const centerX = margin + usableSize / 2;
    const centerY = margin + usableSize / 2;
    await drawSvgToCanvas(logoSrc, ctx.canvas, centerX, centerY, scaledLogoSize, scaledLogoSize, bgColor, qrColor);
  }
}

// --------------------------------------------------------------------
// 7. DRAWING THE BACKGROUND IMAGE
// --------------------------------------------------------------------
/**
 * Draws the user-selected background image onto the entire canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} src - The base64 or blob URL for the image
 * @param {number} width
 * @param {number} height
 */
function drawBgImage(ctx, src, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

// --------------------------------------------------------------------
// 8. DRAWING THE SVG LOGO
// --------------------------------------------------------------------
/**
 * Draws an SVG logo onto the given canvas at the specified center/size.
 * We optionally insert a background rect if not transparent and recolor strokes.
 *
 * @param {string} svgPath - Path/URL to the SVG file
 * @param {HTMLCanvasElement} canvas - The target canvas
 * @param {number} centerX - Center X coordinate where the logo is placed
 * @param {number} centerY - Center Y coordinate where the logo is placed
 * @param {number} width - The logo’s width
 * @param {number} height - The logo’s height
 * @param {string} bgColor - The background color (if not transparent or no image)
 * @param {string} qrColor - The color for strokes/fills (as needed)
 */
async function drawSvgToCanvas(svgPath, canvas, centerX, centerY, width, height, bgColor, qrColor) {
  const response = await fetch(svgPath);
  let svgText = await response.text();

  // If not transparent and no image, we insert a <rect> as a background
  if (!transparentBg.checked && !backgroundImageSrc) {
    svgText = svgText.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="${bgColor}" />`);
  }

  // Recolor any stroke to match the QR code color
  svgText = svgText.replace(/stroke="[^"]*"/g, `stroke="${qrColor}"`);

  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      const imgX = centerX - width / 2;
      const imgY = centerY - height / 2;
      ctx.drawImage(img, imgX, imgY, width, height);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });
}

// --------------------------------------------------------------------
// 9. DOWNLOAD / COPY LOGIC
// --------------------------------------------------------------------
/**
 * Saves the current displayed QR code (main canvas) as a PNG file.
 * The filename is based on the current text input.
 */
function downloadQRCode() {
  const link = document.createElement("a");
  link.download = textInput.value.trim() + "_QR_Code.png";
  link.href = qrCanvas.toDataURL("image/png");
  link.click();

  // Optionally change the button text to indicate success
  downloadBtn.innerText = "Downloaded!";
}

/**
 * Copies the current displayed QR code as an image to the clipboard (PNG).
 */
function copyQrToClipboard() {
  // Convert the canvas to a Blob, then create a ClipboardItem
  qrCanvas.toBlob((blob) => {
    const item = new ClipboardItem({ "image/png": blob });
    navigator.clipboard.write([item]);
  });
  // Indicate success
  copyBtn.innerText = "Copied!";
}

// --------------------------------------------------------------------
// 10. EVENT LISTENERS + INITIALIZATION
// --------------------------------------------------------------------

// Debounced typing in the text input
textInput.addEventListener("input", generateQRDebounced);

// For color inputs, we can re-generate immediately (or also debounce if we wish)
qrColorInput.addEventListener("input", generateQR);
bgColorInput.addEventListener("input", generateQR);

// Download + Copy
downloadBtn.addEventListener("click", downloadQRCode);
copyBtn.addEventListener("click", copyQrToClipboard);

// Toggle transparent background
transparentBg.addEventListener("change", () => {
  updateBackgroundColorLabel();
  generateQR();
});

// Toggle inclusion of the logo
includeLogoCheckbox.addEventListener("change", () => {
  generateQR();
});

// Range slider for rotation
rotationRange.addEventListener("input", () => {
  rotationValueDisplay.value = rotationRange.value;
  generateQR();
});

// Numeric input for rotation - mirror changes back to the range slider
rotationValueDisplay.addEventListener("input", () => {
  rotationRange.value = rotationValueDisplay.value;
  generateQR();
});

// Background image file input
const bgImageInput = document.getElementById("bg-image");
let backgroundImageSrc = null;

bgImageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) {
    removeBgImageBtn.style.display = "none";
    return;
  }
  // Hide color input if using an image
  bgColorInput.style.display = "none";
  bgColorLabel.style.display = "none";
  removeBgImageBtn.style.display = "block";

  // Read the image as a data URL
  const reader = new FileReader();
  reader.onload = (evt) => {
    backgroundImageSrc = evt.target.result;
    generateQR();
  };
  reader.readAsDataURL(file);
});

// Button to remove the chosen background image
removeBgImageBtn.addEventListener("click", (e) => {
  e.preventDefault();
  bgImageInput.value = "";
  backgroundImageSrc = null;
  removeBgImageBtn.style.display = "none";

  // Re-show the color inputs
  bgColorInput.style.display = "";
  bgColorLabel.style.display = "";
  generateQR();
});

// Optionally update some canvas-based background color (not used much now)
function updateDivBackgroundColor() {
  qrCanvas.style.backgroundColor = bgColorInput.value;
}

// Initial calls on page load
generateQR();
updateBackgroundColorLabel();
