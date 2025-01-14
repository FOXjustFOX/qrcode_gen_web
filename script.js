/**
 * Main script for generating and manipulating a QR code on an HTML canvas.
 * Includes debouncing, toggles for transparency, background images,
 * logo embedding, rotation, and download/copy functionality.
 *
 * Dependencies / Requirements:
 *   - A QR code library that provides `QRCode.create(text, { errorCorrectionLevel: "H" })`.
 *   - An SVG file named "WRSS_WIT_Logo.svg".
 *   - Images named "done.png" for success indicators on buttons.
 *   - HTML elements referenced by their IDs (see the "Element References" section).
 */

// --------------------------------------------------------------------
// 1. ELEMENT REFERENCES + GLOBAL CONSTANTS
// --------------------------------------------------------------------
/** Text input field for the QR code content */
const textInput = document.getElementById("text");

/** Container for the entire QR code section */
const qrContainer = document.getElementById("qr-container");

/** Main <canvas> where the final QR (possibly rotated, etc.) is displayed */
const qrCanvas = document.getElementById("canvas");

/** Color input for the QR code modules */
const qrColorInput = document.getElementById("qrColor");

/** Color input for the background color */
const bgColorInput = document.getElementById("bgColor");

/** Button to download the generated QR code as PNG */
const downloadBtn = document.getElementById("downloadBtn");
const downloadBtnImg = document.getElementById("download-button-img");

/** Button to copy the QR code image to clipboard */
const copyBtn = document.getElementById("copyBtn");
const copyBtnImg = document.getElementById("copy-button-img");

/** Container that holds the "Download" and "Copy" buttons */
const saveBtns = document.getElementById("save-buttons");

/** Checkbox to toggle transparent background */
const transparentBg = document.getElementById("transparentBg");

/** Checkbox to include/exclude the logo in the QR code center */
const includeLogoCheckbox = document.getElementById("includeLogo");

/** Background image file input + related UI elements */
const bgImageInput = document.getElementById("bg-image");
const imageContainer = document.getElementById("image-container");
const addImageIcon = document.getElementById("add-image-icon");
const removeBgImageBtn = document.getElementById("image-remove-button");

/** Range input for rotation (0–360) and a text/number input to display the same value */
const rotationRange = document.getElementById("rotationRange");
const rotationValueDisplay = document.getElementById("rotationValue");

/** The path to the SVG logo that can be placed in the center of the QR */
const logoSrc = "WRSS_WIT_Logo.svg";

/** Margin around the QR code in the offscreen canvas */
const margin = 20;

/** Factor by which we create a larger offscreen canvas (for sharper rendering) */
const offscreenScale = 3;

/** The size of the QR code on the screen (calculated on resize) */
let qrSize;

/** The display size for the main canvas */
let displaySize;

/** The size (in px) of the logo, relative to the QR code */
let logoSize;

/** The scaled (actual) size for the logo in the offscreen canvas */
let scaledLogoSize;

/** The portion of the QR code’s center that we skip drawing so the logo remains clear */
let scaledSafeZone;

/** The user-chosen background image (base64 or blob URL) */
let backgroundImageSrc = null;

/** Timer reference for debouncing generateQR calls */
let debounceTimer;

// --------------------------------------------------------------------
// 2. HIGH-DPI CANVAS ADJUSTMENT
// --------------------------------------------------------------------

/**
 * Adjusts a given canvas for high-DPI (retina) displays, factoring in
 * window.devicePixelRatio. Returns the 2D rendering context.
 *
 * @param {HTMLCanvasElement} canvas - The canvas to adjust
 * @param {number} width - The desired (CSS) width
 * @param {number} height - The desired (CSS) height
 * @returns {CanvasRenderingContext2D} The 2D context with DPI scaling applied
 */
function adjustCanvasForHighDPI(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; // Scale the canvas resolution
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr); // Scale all drawings to match devicePixelRatio
    return ctx;
}

// --------------------------------------------------------------------
// 3. UI / VISIBILITY UPDATES
// --------------------------------------------------------------------

/**
 * Resize the main QR and related variables whenever the container changes size
 * (e.g. on window resize).
 */
function resizeCanvasToContainer() {
    // We pick a QR size based on the container width.
    // For example, sqrt(2)/2 ensures a square that fits well in the container.
    qrSize = (qrContainer.offsetWidth * Math.sqrt(2)) / 2;
    displaySize = qrContainer.offsetWidth;

    // Compute derived sizing for the logo and the “safe zone” (offscreen scaled)
    logoSize = qrSize * 0.2;
    scaledLogoSize = logoSize * offscreenScale;
    scaledSafeZone = scaledLogoSize * 1.1;

    // Re-generate the QR with the new sizes
    generateQR();
}

/**
 * Hide or show background color and image UI elements based on whether
 * "transparent background" is checked.
 * This toggles the "disabled" classes but also can be extended to
 * manipulate other styles in your own UI.
 */
function toggleDisabled() {

    if (transparentBg.checked) {
        bgColorInput.classList.add("disabled");
        imageContainer.classList.add("disabled");
        removeBgImageBtn.classList.add("disabled");
    }else if (backgroundImageSrc) {
        bgColorInput.classList.add("disabled");
        imageContainer.classList.remove("disabled");
        removeBgImageBtn.classList.remove("disabled");
    } else {
        bgColorInput.classList.remove("disabled");
        imageContainer.classList.remove("disabled");
        removeBgImageBtn.classList.remove("disabled");
    }
}

// --------------------------------------------------------------------
// 4. DEBOUNCING LOGIC
// --------------------------------------------------------------------

/**
 * Wraps the generateQR call in a 300ms debounce, so we don't call generateQR
 * too frequently on every keystroke.
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
 * Draws the result onto the main canvas with the chosen rotation.
 */
async function generateQR() {

    // Reset the "save" button icons
    downloadBtnImg.src = "download.png";
    copyBtnImg.src = "copy.png";
    
    // Get the current user inputs
    const text = textInput.value.trim();
    const qrColor = qrColorInput.value;
    const bgColor = bgColorInput.value;

    // If no text is provided, clear the canvas and hide the "save" buttons
    if (!text) {
        const mainCtx = adjustCanvasForHighDPI(
            qrCanvas,
            displaySize,
            displaySize
        );
        mainCtx.clearRect(0, 0, displaySize, displaySize);

        saveBtns.style.display = "none";
        return;
    }

    // Create an offscreen canvas to draw the raw QR code
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = qrSize * offscreenScale; // e.g., 900
    offscreenCanvas.height = qrSize * offscreenScale;
    const offscreenCtx = offscreenCanvas.getContext("2d");

    // Draw the entire QR code (modules + optional BG + optional logo) onto the offscreen context
    await drawQrToCtx(offscreenCtx, text, qrColor, bgColor);

    // Determine user-chosen rotation
    const rotationDegrees = parseFloat(rotationRange.value) || 0;

    // Prepare the main (visible) canvas
    const mainCtx = adjustCanvasForHighDPI(qrCanvas, displaySize, displaySize);
    mainCtx.clearRect(0, 0, displaySize, displaySize);

    // Apply the rotation transform and draw the offscreen canvas
    mainCtx.save();
    mainCtx.translate(displaySize / 2, displaySize / 2);
    mainCtx.rotate((rotationDegrees * Math.PI) / 180);

    /**
     * We'll scale the offscreen 900×900 so that when it's rotated by up to 45°,
     * it still fits in the displaySize. (We use a factor of sqrt(2) to account
     * for diagonal bounding box growth.)
     */
    const sqrt2 = Math.SQRT2;
    const scaledFactor = displaySize / (900 * sqrt2);
    mainCtx.scale(scaledFactor, scaledFactor);

    // Center the offscreen canvas chunk
    const offsetX = -900 / 2;
    const offsetY = -900 / 2;
    mainCtx.drawImage(offscreenCanvas, offsetX, offsetY, 900, 900);
    mainCtx.restore();

    // Show the "Download" and "Copy" buttons
    saveBtns.style.display = "flex";
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
    const width = qrSize * offscreenScale;
    const height = qrSize * offscreenScale;

    // 1) Clear offscreen
    ctx.clearRect(0, 0, width, height);

    // 2) Optionally draw a background image or fill with bgColor
    if (backgroundImageSrc && !transparentBg.checked) {
        // If user selected an image
        await drawBgImage(ctx, backgroundImageSrc, width, height);
    } else if (!transparentBg.checked) {
        // If no image but not transparent, fill with bgColor
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
    }

    // 3) Generate the QR code data
    const qrCode = await QRCode.create(text, { errorCorrectionLevel: "H" });

    // 4) Draw the QR modules
    const marginPx = margin * offscreenScale;
    const usableSize = (qrSize - 2 * margin) * offscreenScale;
    const cellSize = usableSize / qrCode.modules.size;

    // The "safe zone" for the logo in the center
    const logoStart = marginPx + (usableSize - scaledSafeZone) / 2;
    const logoEnd = logoStart + scaledSafeZone;

    qrCode.modules.data.forEach((bit, index) => {
        const col = index % qrCode.modules.size;
        const row = Math.floor(index / qrCode.modules.size);

        const x = marginPx + col * cellSize;
        const y = marginPx + row * cellSize;

        // Check if this cell intersects the logo's safe zone
        const cellRight = x + cellSize;
        const cellBottom = y + cellSize;
        const intersectsSafeZone = !(
            cellRight < logoStart ||
            x > logoEnd ||
            cellBottom < logoStart ||
            y > logoEnd
        );

        // Skip drawing if the user wants a logo and this cell intersects the safe zone
        if (includeLogoCheckbox.checked && intersectsSafeZone) return;

        // Otherwise, fill the module
        if (bit) {
            // “bit” true => black module
            ctx.fillStyle = qrColor;
            ctx.fillRect(
                Math.floor(x),
                Math.floor(y),
                Math.ceil(cellSize),
                Math.ceil(cellSize)
            );
        } else if (!transparentBg.checked && !backgroundImageSrc) {
            // “bit” false => white module, so fill with bgColor if not transparent
            ctx.fillStyle = bgColor;
            ctx.fillRect(
                Math.floor(x),
                Math.floor(y),
                Math.ceil(cellSize),
                Math.ceil(cellSize)
            );
        }
    });

    // 5) If the user wants the logo, draw it centered in the safe zone
    if (includeLogoCheckbox.checked) {
        const centerX = marginPx + usableSize / 2;
        const centerY = marginPx + usableSize / 2;
        await drawSvgToCanvas(
            logoSrc,
            ctx.canvas,
            centerX,
            centerY,
            scaledLogoSize,
            scaledLogoSize,
            bgColor,
            qrColor
        );
    }
}

// --------------------------------------------------------------------
// 7. DRAWING THE BACKGROUND IMAGE
// --------------------------------------------------------------------

/**
 * Draws the user-selected background image onto the entire canvas.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D context
 * @param {string} src - The base64 or blob URL for the image
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Promise<void>}
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
 * @returns {Promise<void>}
 */
async function drawSvgToCanvas(
    svgPath,
    canvas,
    centerX,
    centerY,
    width,
    height,
    bgColor,
    qrColor
) {
    // Fetch the SVG as text
    const response = await fetch(svgPath);
    let svgText = await response.text();

    // Insert a rect if not transparent and no background image is used
    if (!transparentBg.checked && !backgroundImageSrc) {
        svgText = svgText.replace(
            /<svg([^>]*)>/,
            `<svg$1><rect width="100%" height="100%" fill="${bgColor}" />`
        );
    }

    // Recolor strokes
    svgText = svgText.replace(/stroke="[^"]*"/g, `stroke="${qrColor}"`);

    // Create a Blob and URL for the modified SVG
    const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);

    // Draw onto the canvas as an image
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const ctx = canvas.getContext("2d");
            ctx.save();

            // Move origin to the center where the logo goes
            ctx.translate(centerX, centerY);

            // Rotate the logo "back" if the entire QR is rotated
            const rotationDegrees = parseFloat(rotationRange.value) || 0;
            ctx.rotate((-rotationDegrees * Math.PI) / 180);

            // Clip to a circle so the logo is circular
            ctx.beginPath();
            ctx.arc(0, 0, width / 2, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.clip();

            // Draw the logo so that (0,0) is its center
            ctx.drawImage(img, -width / 2, -height / 2, width, height);

            ctx.restore();
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

    // Indicate success (e.g., swap icon)
    downloadBtnImg.src = "done.png";
}

/**
 * Copies the current displayed QR code as an image to the clipboard (PNG).
 */
function copyQrToClipboard() {
    qrCanvas.toBlob((blob) => {
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([item]);
    });

    // Indicate success (e.g., swap icon)
    copyBtnImg.src = "done.png";
}

// --------------------------------------------------------------------
// 10. EVENT LISTENERS + INITIALIZATION
// --------------------------------------------------------------------

// Text input -> debounced QR generation
textInput.addEventListener("input", generateQRDebounced);

// Immediate (non-debounced) QR regeneration on color changes
qrColorInput.addEventListener("input", generateQR);
bgColorInput.addEventListener("input", generateQR);

// Download + Copy
downloadBtn.addEventListener("click", (e) => {
    e.preventDefault();
    downloadQRCode();
});
copyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    copyQrToClipboard();
});

// Toggle transparent background
transparentBg.addEventListener("change", () => {
    toggleDisabled();
    generateQR();
});

// Toggle inclusion of the logo
includeLogoCheckbox.addEventListener("change", () => {
    generateQR();
});

// Rotation range slider
rotationRange.addEventListener("input", () => {
    rotationValueDisplay.value = rotationRange.value;
    generateQR();
});

// Rotation numeric input (mirrors to the range slider)
rotationValueDisplay.addEventListener("input", () => {
    rotationRange.value = rotationValueDisplay.value;
    generateQR();
});

// Background image file input
bgImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    toggleDisabled();
    if (!file) {
        removeBgImageBtn.style.display = "none";
        return;
    }
    // Hide color input if using an image
    bgColorInput.classList.add("disabled");
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
    imageContainer.style.backgroundImage = "";
    addImageIcon.style.display = "block";

    // Re-show the color inputs
    bgColorInput.classList.remove("disabled");
    generateQR();
});

// Recompute sizing on window resize
window.addEventListener("resize", () => {
    resizeCanvasToContainer();
});

// Initial calls on page load
resizeCanvasToContainer();
generateQR();
