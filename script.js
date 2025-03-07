/**
 * Main script for generating and manipulating a QR code on an HTML canvas.
 *
 * Supports:
 *   - Debounced generation (avoids re-rendering on every keystroke).
 *   - Transparent background toggle.
 *   - Color selection for QR code modules and backgrounds.
 *   - Optional center logo overlay.
 *   - Optional background image usage.
 *   - Rotation control (0–360 degrees).
 *   - Download and copy-to-clipboard functionality.
 *
 * Requirements:
 *   - A QR code library that provides `QRCode.create(text, { errorCorrectionLevel: "H" })`.
 *   - An SVG file named "WRSS_WIT_Logo.svg".
 *   - Images named "download.png", "copy.png", and "done.png" to update button states.
 *   - Appropriate HTML elements with the IDs referenced below.
 */

// --------------------------------------------------------------------
// 1. ELEMENT REFERENCES & GLOBAL CONSTANTS
// --------------------------------------------------------------------

/** @type {HTMLInputElement} */
const textInput = document.getElementById("text");

/** @type {HTMLDivElement} */
const qrContainer = document.getElementById("qr-container");

/** @type {HTMLCanvasElement} */
const qrCanvas = document.getElementById("canvas");

/** @type {HTMLInputElement} */
const qrColorInput = document.getElementById("qrColor");

/** @type {HTMLInputElement} */
const bgColorInput = document.getElementById("bgColor");

/** @type {HTMLButtonElement} */
const downloadBtn = document.getElementById("downloadBtn");
/** @type {HTMLImageElement} */
const downloadBtnImg = document.getElementById("download-button-img");

/** @type {HTMLButtonElement} */
const copyBtn = document.getElementById("copyBtn");
/** @type {HTMLImageElement} */
const copyBtnImg = document.getElementById("copy-button-img");

/** @type {HTMLDivElement} */
const saveBtns = document.getElementById("save-buttons");

/** @type {HTMLInputElement} */
const transparentBg = document.getElementById("transparentBg");

/** @type {HTMLInputElement} */
const includeLogoCheckbox = document.getElementById("includeLogo");

/** @type {HTMLInputElement} */
const bgImageInput = document.getElementById("bg-image");

const logoImageInput = document.getElementById("logo-image");

let customLogoSrc = null;

/** @type {HTMLDivElement} */
const imageContainer = document.getElementById("image-container");
/** @type {HTMLDivElement} */
const addImageIcon = document.getElementById("add-image-icon");
/** @type {HTMLButtonElement} */
const removeBgImageBtn = document.getElementById("image-remove-button");

/** @type {HTMLInputElement} */
const rotationRange = document.getElementById("rotationRange");
/** @type {HTMLInputElement} */
const rotationValueDisplay = document.getElementById("rotationValue");

/** Path to the SVG logo that can be placed in the center of the QR. */
const logoSrc = "images/logo/WRSS_WIT_Logo.svg";

/** Margin around the QR code in the offscreen canvas (in px). */
const margin = 20;

/** Factor by which we create a larger offscreen canvas (for sharper rendering). */
const offscreenScale = 3;

/** The size of the QR code on the screen (calculated dynamically). */
let qrSize;

/** The display size for the main canvas (matches container width). */
let displaySize;

/** The size (in px) of the logo, relative to the QR code. */
let logoSize;

/** The scaled (actual) size for the logo in the offscreen canvas. */
let scaledLogoSize;

/** The portion of the QR code’s center that we skip drawing (so the logo remains clear). */
let scaledSafeZone;

/** The user-chosen background image (base64 or blob URL). */
let backgroundImageSrc = null;

/** Timer reference for debouncing generateQR calls. */
let debounceTimer;

// --------------------------------------------------------------------
// 2. HIGH-DPI CANVAS ADJUSTMENT
// --------------------------------------------------------------------

/**
 * Adjusts a given canvas for high-DPI (retina) displays by applying
 * devicePixelRatio-based scaling.
 *
 * @param {HTMLCanvasElement} canvas - The canvas to adjust
 * @param {number} width - The desired CSS width of the canvas
 * @param {number} height - The desired CSS height of the canvas
 * @returns {CanvasRenderingContext2D} The 2D context with high-DPI scaling
 */
function adjustCanvasForHighDPI(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return ctx;
}

// --------------------------------------------------------------------
// 3. UI / VISIBILITY UPDATES
// --------------------------------------------------------------------

/**
 * Resizes the main QR code and derived variables whenever the container changes size.
 * Re-generates the QR code after computing the new dimensions.
 */
function resizeCanvasToContainer() {
    // For a responsive square that fits the container well,
    // we use half of the container width * sqrt(2).
    qrSize = (qrContainer.offsetWidth * Math.sqrt(2)) / 2;
    displaySize = qrContainer.offsetWidth;

    // Compute derived sizing for the logo and safe zone.
    logoSize = qrSize * 0.2;
    scaledLogoSize = logoSize * offscreenScale;
    scaledSafeZone = scaledLogoSize * 1.1;

    // Re-generate the QR with the updated sizes.
    generateQR();
}

/**
 * Toggles the "disabled" classes for background-related controls depending on
 * whether the user wants a transparent background, or has chosen a background image.
 */
function toggleDisabled() {
    if (transparentBg.checked) {
        bgColorInput.classList.add("disabled");
        imageContainer.classList.add("disabled");
        removeBgImageBtn.classList.add("disabled");
    } else if (backgroundImageSrc) {
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
 * Debounced wrapper for generateQR (300ms delay).
 * Called on text input changes to avoid excessive QR re-renders.
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
 * Generates or re-generates the QR code with all current user inputs:
 * - Text content
 * - QR and BG colors
 * - Transparent BG or BG image
 * - Rotation
 * - Optional logo
 *
 * Draws the result onto the main canvas (qrCanvas) with the chosen rotation.
 */
async function generateQR() {
    // Reset the "save" button icons to their default images
    downloadBtnImg.src = "images/download.png";
    copyBtnImg.src = "images/copy.png";

    // Gather current user inputs
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
    offscreenCanvas.width = qrSize * offscreenScale;
    offscreenCanvas.height = qrSize * offscreenScale;
    const offscreenCtx = offscreenCanvas.getContext("2d");

    // Draw the QR code (modules + optional BG + optional logo) onto the offscreen context
    await drawQrToCtx(offscreenCtx, text, qrColor, bgColor);

    // Get the user-chosen rotation (in degrees)
    const rotationDegrees = parseFloat(rotationRange.value) || 0;

    // Prepare the main (visible) canvas
    const mainCtx = adjustCanvasForHighDPI(qrCanvas, displaySize, displaySize);
    mainCtx.clearRect(0, 0, displaySize, displaySize);

    // Apply the rotation and draw the offscreen QR
    mainCtx.save();
    mainCtx.translate(displaySize / 2, displaySize / 2);
    mainCtx.rotate((rotationDegrees * Math.PI) / 180);

    // Scale the offscreen content so it fits within the display size
    // even when rotated (up to 45°). sqrt(2) accounts for diagonal bounding box growth.
    const sqrt2 = Math.SQRT2;
    const scaledFactor = displaySize / (900 * sqrt2);
    mainCtx.scale(scaledFactor, scaledFactor);

    // Center the offscreen image (900×900 used below for consistency)
    const offsetX = -900 / 2;
    const offsetY = -900 / 2;
    mainCtx.drawImage(offscreenCanvas, offsetX, offsetY, 900, 900);
    mainCtx.restore();

    // Display the "Download" and "Copy" buttons
    saveBtns.style.display = "flex";
}

// --------------------------------------------------------------------
// 6. DRAWING THE QR + OPTIONAL LOGO
// --------------------------------------------------------------------

/**
 * Draws the QR code (and optional background/logo) onto a 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D context of the offscreen canvas
 * @param {string} text - The text/URL to encode
 * @param {string} qrColor - Color for QR modules
 * @param {string} bgColor - Background color (if not transparent/using an image)
 */
async function drawQrToCtx(ctx, text, qrColor, bgColor) {
    const width = qrSize * offscreenScale;
    const height = qrSize * offscreenScale;

    // 1) Clear offscreen canvas
    ctx.clearRect(0, 0, width, height);

    // 2) Draw background (color or image) if applicable
    if (backgroundImageSrc && !transparentBg.checked) {
        // Draw user-selected image as background
        await drawBgImage(ctx, backgroundImageSrc, width, height);
    } else if (!transparentBg.checked) {
        // If no image and not transparent => fill with bgColor
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
    }

    // 3) Generate the QR code data (error correction: H)
    const qrCode = await QRCode.create(text, { errorCorrectionLevel: "H" });

    // 4) Draw QR modules
    const marginPx = margin * offscreenScale;
    const usableSize = (qrSize - 2 * margin) * offscreenScale;
    const cellSize = usableSize / qrCode.modules.size;

    // "Safe zone" for the logo in the center
    const logoStart = marginPx + (usableSize - scaledSafeZone) / 2;
    const logoEnd = logoStart + scaledSafeZone;

    qrCode.modules.data.forEach((bit, index) => {
        const col = index % qrCode.modules.size;
        const row = Math.floor(index / qrCode.modules.size);

        const x = marginPx + col * cellSize;
        const y = marginPx + row * cellSize;
        const cellRight = x + cellSize;
        const cellBottom = y + cellSize;

        // Check if this module is within the logo's "safe zone"
        const intersectsSafeZone = !(
            cellRight < logoStart ||
            x > logoEnd ||
            cellBottom < logoStart ||
            y > logoEnd
        );

        // If the user wants a logo and this cell overlaps the safe zone, skip it
        if (includeLogoCheckbox.checked && intersectsSafeZone) return;

        // Otherwise, fill the module (true => "dark" module)
        if (bit) {
            ctx.fillStyle = qrColor;
            ctx.fillRect(
                Math.floor(x),
                Math.floor(y),
                Math.ceil(cellSize),
                Math.ceil(cellSize)
            );
        }
        // For "false" => fill with bgColor if not transparent/no image
        else if (!transparentBg.checked && !backgroundImageSrc) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(
                Math.floor(x),
                Math.floor(y),
                Math.ceil(cellSize),
                Math.ceil(cellSize)
            );
        }
    });

    // 5) Draw logo in the center if requested
    if (includeLogoCheckbox.checked) {
        const centerX = marginPx + usableSize / 2;
        const centerY = marginPx + usableSize / 2;

        const logoToUse = customLogoSrc ? customLogoSrc : logoSrc;
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
 * Draws a given image (src) onto the entire canvas background.
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
 * Optionally inserts a background rect if not transparent and recolors strokes.
 *
 * @param {string} svgPath - Path/URL to the SVG file
 * @param {HTMLCanvasElement} canvas - The target canvas
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} width - Logo width (in px)
 * @param {number} height - Logo height (in px)
 * @param {string} bgColor - Background color (if not transparent / no background image)
 * @param {string} qrColor - Color for strokes/fills (as needed)
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
    // Fetch the SVG
    const response = await fetch(svgPath);
    let svgText = await response.text();

    // Insert a rect if not transparent and no background image is used
    if (!transparentBg.checked && !backgroundImageSrc) {
        svgText = svgText.replace(
            /<svg([^>]*)>/,
            `<svg$1><rect width="100%" height="100%" fill="${bgColor}" />`
        );
    }

    // Recolor all existing strokes in the SVG to match the QR color
    svgText = svgText.replace(/stroke="[^"]*"/g, `stroke="${qrColor}"`);

    // Convert the modified SVG into a Blob/URL
    const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);

    // Draw the SVG onto the canvas
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const ctx = canvas.getContext("2d");
            ctx.save();

            // Translate to the logo's center
            ctx.translate(centerX, centerY);

            // "Undo" the QR rotation for the logo, so it remains upright
            const rotationDegrees = parseFloat(rotationRange.value) || 0;
            ctx.rotate((-rotationDegrees * Math.PI) / 180);

            // Clip to a circle, so the logo is circular
            ctx.beginPath();
            ctx.arc(0, 0, width / 2, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.clip();

            // Draw the logo with center alignment
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
 * Downloads the current displayed QR code from the main canvas as a PNG file.
 * The filename is based on the current text input.
 */
function downloadQRCode() {
    const link = document.createElement("a");
    link.download = `${textInput.value.trim()}_QR_Code.png`;
    link.href = qrCanvas.toDataURL("image/png");
    link.click();

    // Indicate success (swap icon)
    downloadBtnImg.src = "images/done.png";
}

/**
 * Copies the current displayed QR code as an image (PNG) to the clipboard.
 */
function copyQrToClipboard() {
    qrCanvas.toBlob((blob) => {
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([item]);
    });

    // Indicate success (swap icon)
    copyBtnImg.src = "images/done.png";
}

// --------------------------------------------------------------------
// 10. EVENT LISTENERS & INITIALIZATION
// --------------------------------------------------------------------

// 10.1 Text input -> debounced QR generation
textInput.addEventListener("input", generateQRDebounced);

// 10.2 Color inputs -> immediate (non-debounced) QR regeneration
qrColorInput.addEventListener("input", generateQR);
bgColorInput.addEventListener("input", generateQR);

// 10.3 Download + Copy
downloadBtn.addEventListener("click", (e) => {
    e.preventDefault();
    downloadQRCode();
});
copyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    copyQrToClipboard();
});

// 10.4 Toggle transparent background
transparentBg.addEventListener("change", () => {
    toggleDisabled();
    generateQR();
});

// 10.5 Toggle inclusion of the logo
includeLogoCheckbox.addEventListener("change", () => {
    generateQR();
});

// 10.6 Rotation range slider
rotationRange.addEventListener("input", (e) => {
    e.preventDefault();
    rotationValueDisplay.value = rotationRange.value;
    generateQR();
});

// 10.7 Rotation numeric input (mirrors the range slider)
rotationValueDisplay.addEventListener("input", () => {
    rotationRange.value = rotationValueDisplay.value;
    generateQR();
});

rotationValueDisplay.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault(); // Prevent any action for Enter key
    }
});

// 10.8 Background image file input
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

logoImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file && file.type === "image/svg+xml") {
        const reader = new FileReader();
        reader.onload = (evt) => {
            customLogoSrc = evt.target.result;
            generateQR();
        };
        reader.readAsDataURL(file);
    } else {
        alert("Please select an SVG file for the logo.");
    }
});

// 10.9 Button to remove the chosen background image
removeBgImageBtn.addEventListener("click", (e) => {
    e.preventDefault();
    bgImageInput.value = "";
    backgroundImageSrc = null;
    removeBgImageBtn.style.display = "none";
    imageContainer.style.backgroundImage = "";
    addImageIcon.style.display = "block";

    // Re-enable color input
    bgColorInput.classList.remove("disabled");
    generateQR();
});

// 10.10 Recompute sizing on window resize
window.addEventListener("resize", () => {
    resizeCanvasToContainer();
});

// 10.11 Initial calls on page load
resizeCanvasToContainer();
generateQR();

// --------------------------------------------------------------------
// EXTRA: Displaying the chosen background image in the container
// --------------------------------------------------------------------

/** @type {HTMLLabelElement} */
const label = document.querySelector("#icon-image");
/** @type {HTMLInputElement} */
const input = document.querySelector("#bg-image");

input.addEventListener("change", updateImageDisplay);

/**
 * Updates the preview in the background image container.
 */
function updateImageDisplay() {
    const file = input.files[0];
    if (validFileType(file)) {
        imageContainer.style.backgroundImage = `url(${URL.createObjectURL(
            file
        )})`;
        addImageIcon.style.display = "none";
    }
}

/**
 * List of allowed file MIME types for the background image upload.
 * @type {string[]}
 */
const fileTypes = [
    "image/apng",
    "image/bmp",
    "image/gif",
    "image/jpeg",
    "image/pjpeg",
    "image/png",
    "image/svg+xml",
    "image/tiff",
    "image/webp",
    "image/x-icon",
];

/**
 * Checks whether the uploaded file is an allowed type.
 *
 * @param {File} file
 * @returns {boolean}
 */
function validFileType(file) {
    return fileTypes.includes(file.type);
}
