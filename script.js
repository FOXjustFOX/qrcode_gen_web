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
const downloadPngBtn = document.getElementById("downloadPngBtn");
/** @type {HTMLImageElement} */
const downloadPngBtnImg = document.getElementById("download-png-button-img");

const downloadSvgBtn = document.getElementById("downloadSvgBtn");

const downloadSvgBtnImg = document.getElementById("download-svg-button-img");

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

const addImageLogo = document.getElementById("add-image-logo");

const removeBgImageBtn = document.getElementById("image-remove-button");

const logoImageContainer = document.getElementById("logo-image-container");

const logoRemoveButton = document.getElementById("logo-remove-button");

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

    if (includeLogoCheckbox.checked) {
        logoImageContainer.classList.remove("disabled");
        logoRemoveButton.classList.remove("disabled");
    } else {
        logoImageContainer.classList.add("disabled");
        logoRemoveButton.classList.add("disabled");
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
    downloadPngBtnImg.src = "images/png.png";
    downloadSvgBtnImg.src = "images/svg.png";
    // downloadBtnImg.src = "images/download.png";
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
            logoToUse,
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
    downloadPngImg.src = "images/done.png";

    resetButtonImage(downloadPngBtnImg, "images/png.png");

}

/**
 * Downloads the current QR code as an SVG file.
 */
function downloadQRCodeAsSVG() {
    // Get the current text content
    const text = textInput.value.trim();

    if (!text) {
        return; // Don't generate if there's no text
    }

    // Create a QR code using the same approach as in generateQR
    const qrCode = QRCode.create(text, { errorCorrectionLevel: "H" });

    // Get current colors and settings
    const qrColor = qrColorInput.value;
    const bgColor = transparentBg.checked ? "transparent" : bgColorInput.value;
    const rotationDegrees = parseFloat(rotationRange.value) || 0;

    // Calculate how much larger the SVG needs to be to accommodate rotation
    // Using the diagonal as the maximum dimension (sqrt(2) ≈ 1.414 times larger for 45° rotation)
    const rotationRadians = Math.abs((rotationDegrees * Math.PI) / 180);
    const expansionFactor = Math.max(
        Math.abs(Math.cos(rotationRadians)) +
            Math.abs(Math.sin(rotationRadians)),
        1
    );

    // Base size for the QR code
    const baseSize = 1000;
    // Expanded size to prevent cutoff during rotation
    const expandedSize = Math.ceil(baseSize * expansionFactor);

    // Add padding around the QR code (10% of base size)
    const paddingSize = baseSize * 0.1;
    const size = expandedSize + paddingSize * 2;

    // Center point of the SVG
    const centerX = size / 2;
    const centerY = size / 2;

    // Original margins for the QR code
    const marginPx = baseSize * (margin / qrSize);
    const usableSize = baseSize - 2 * marginPx;
    const cellSize = usableSize / qrCode.modules.size;

    // Start SVG document with a transparent background (entire SVG is transparent)
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;

    // Create a group for the entire content
    svg += "<g>";

    // Create a group for QR code with rotation
    svg += `<g transform="translate(${centerX}, ${centerY}) rotate(${rotationDegrees})">`;

    // The actual QR code area (to contain the background color)
    // This rect is sized exactly to match only the QR code area, not the entire SVG
    const qrAreaSize = baseSize;
    const qrAreaX = -qrAreaSize / 2; // Centered
    const qrAreaY = -qrAreaSize / 2; // Centered

    // Add background only for the QR code area, not the whole SVG
    if (bgColor !== "transparent") {
        svg += `<rect x="${qrAreaX}" y="${qrAreaY}" width="${qrAreaSize}" height="${qrAreaSize}" fill="${bgColor}" />`;
    }

    // Draw QR modules - positioned relative to center
    const qrX = -baseSize / 2;
    const qrY = -baseSize / 2;

    // Logo dimensions
    const logoSize = usableSize * 0.2; // 20% of usable area
    const safeZone = logoSize * 1.1;
    const logoStartOffset = (usableSize - safeZone) / 2;
    const logoStart = marginPx + logoStartOffset;
    const logoEnd = logoStart + safeZone;

    // Use a path to avoid gaps between adjacent squares
    let pathData = "";

    qrCode.modules.data.forEach((bit, index) => {
        if (!bit) return; // Only draw dark modules

        const col = index % qrCode.modules.size;
        const row = Math.floor(index / qrCode.modules.size);

        // Position relative to the top-left of the centered QR code
        const x = qrX + marginPx + col * cellSize;
        const y = qrY + marginPx + row * cellSize;

        // Calculate logo position in the rotated coordinate system
        const rotatedLogoStart = qrX + logoStart;
        const rotatedLogoEnd = qrX + logoEnd;

        // Skip logo area if needed
        if (includeLogoCheckbox.checked) {
            const intersectsSafeZone = !(
                x + cellSize < rotatedLogoStart ||
                x > rotatedLogoEnd ||
                y + cellSize < rotatedLogoStart ||
                y > rotatedLogoEnd
            );

            if (intersectsSafeZone) return;
        }

        // Instead of individual rects, add to path data
        pathData += `M${x},${y}h${cellSize}v${cellSize}h${-cellSize}z`;
    });

    // Add the combined path for all QR modules
    svg += `<path d="${pathData}" fill="${qrColor}" />`;

    // Close the rotation group
    svg += `</g>`;

    // Add logo if needed - OUTSIDE the rotation transform to keep it horizontal
    if (includeLogoCheckbox.checked) {
        handleSvgLogo(svg, size, logoSize, qrColor, rotationDegrees).then(
            (logoSvg) => {
                svg = logoSvg;
                finalizeSvgDownload(svg, text);
            }
        );
    } else {
        // Close the main group
        svg += "</g>";
        finalizeSvgDownload(svg, text);
    }
}
function copyQRCodeAsSVG() {
    // Get the current text content
    const text = textInput.value.trim();

    if (!text) {
        return; // Don't generate if there's no text
    }

    // Create a QR code using the same approach as in generateQR
    const qrCode = QRCode.create(text, { errorCorrectionLevel: "H" });

    // Get current colors and settings
    const qrColor = qrColorInput.value;
    const bgColor = transparentBg.checked ? "transparent" : bgColorInput.value;
    const rotationDegrees = parseFloat(rotationRange.value) || 0;

    // Calculate how much larger the SVG needs to be to accommodate rotation
    // Using the diagonal as the maximum dimension (sqrt(2) ≈ 1.414 times larger for 45° rotation)
    const rotationRadians = Math.abs((rotationDegrees * Math.PI) / 180);
    const expansionFactor = Math.max(
        Math.abs(Math.cos(rotationRadians)) +
            Math.abs(Math.sin(rotationRadians)),
        1
    );

    // Base size for the QR code
    const baseSize = 1000;
    // Expanded size to prevent cutoff during rotation
    const expandedSize = Math.ceil(baseSize * expansionFactor);

    // Add padding around the QR code (10% of base size)
    const paddingSize = baseSize * 0.1;
    const size = expandedSize + paddingSize * 2;

    // Center point of the SVG
    const centerX = size / 2;
    const centerY = size / 2;

    // Original margins for the QR code
    const marginPx = baseSize * (margin / qrSize);
    const usableSize = baseSize - 2 * marginPx;
    const cellSize = usableSize / qrCode.modules.size;

    // Start SVG document with a transparent background (entire SVG is transparent)
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;

    // Create a group for the entire content
    svg += "<g>";

    // Create a group for QR code with rotation
    svg += `<g transform="translate(${centerX}, ${centerY}) rotate(${rotationDegrees})">`;

    // The actual QR code area (to contain the background color)
    // This rect is sized exactly to match only the QR code area, not the entire SVG
    const qrAreaSize = baseSize;
    const qrAreaX = -qrAreaSize / 2; // Centered
    const qrAreaY = -qrAreaSize / 2; // Centered

    // Add background only for the QR code area, not the whole SVG
    if (bgColor !== "transparent") {
        svg += `<rect x="${qrAreaX}" y="${qrAreaY}" width="${qrAreaSize}" height="${qrAreaSize}" fill="${bgColor}" />`;
    }

    // Draw QR modules - positioned relative to center
    const qrX = -baseSize / 2;
    const qrY = -baseSize / 2;

    // Logo dimensions
    const logoSize = usableSize * 0.2; // 20% of usable area
    const safeZone = logoSize * 1.1;
    const logoStartOffset = (usableSize - safeZone) / 2;
    const logoStart = marginPx + logoStartOffset;
    const logoEnd = logoStart + safeZone;

    // Use a path to avoid gaps between adjacent squares
    let pathData = "";

    qrCode.modules.data.forEach((bit, index) => {
        if (!bit) return; // Only draw dark modules

        const col = index % qrCode.modules.size;
        const row = Math.floor(index / qrCode.modules.size);

        // Position relative to the top-left of the centered QR code
        const x = qrX + marginPx + col * cellSize;
        const y = qrY + marginPx + row * cellSize;

        // Calculate logo position in the rotated coordinate system
        const rotatedLogoStart = qrX + logoStart;
        const rotatedLogoEnd = qrX + logoEnd;

        // Skip logo area if needed
        if (includeLogoCheckbox.checked) {
            const intersectsSafeZone = !(
                x + cellSize < rotatedLogoStart ||
                x > rotatedLogoEnd ||
                y + cellSize < rotatedLogoStart ||
                y > rotatedLogoEnd
            );

            if (intersectsSafeZone) return;
        }

        // Instead of individual rects, add to path data
        pathData += `M${x},${y}h${cellSize}v${cellSize}h${-cellSize}z`;
    });

    // Add the combined path for all QR modules
    svg += `<path d="${pathData}" fill="${qrColor}" />`;

    // Close the rotation group
    svg += `</g>`;

    // Add logo if needed - OUTSIDE the rotation transform to keep it horizontal
    if (includeLogoCheckbox.checked) {
        handleSvgLogo(svg, size, logoSize, qrColor, rotationDegrees).then(
            (logoSvg) => {
                svg = logoSvg;
                copyQrToClipboard(svg);
            }
        );
    } else {
        // Close the main group
        svg += "</g>";
        copyQrToClipboard(svg);
    }
}

/**
 * Handles the logo addition to the SVG and returns the updated SVG
 */
async function handleSvgLogo(svg, size, logoSize, qrColor, rotationDegrees) {
    const centerX = size / 2;
    const centerY = size / 2;
    const logoWidth = logoSize;
    const logoHeight = logoSize;

    // Calculate logo position - always centered in the SVG
    const logoX = centerX - logoWidth / 2;
    const logoY = centerY - logoHeight / 2;

    // Create a rectangular clip path for the logo
    svg += `<defs>
        <clipPath id="logoClip">
            <rect x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" />
        </clipPath>
    </defs>`;

    // Handle the logo - custom or default - keeping it horizontal
    if (customLogoSrc) {
        // For SVG logo, try to embed it correctly
        if (customLogoSrc.includes("image/svg+xml")) {
            try {
                // Extract the SVG content from the data URI
                const svgContent = atob(customLogoSrc.split(",")[1]);

                // Remove XML declaration if present
                const cleanedSvgContent = svgContent.replace(
                    /<\?xml[^>]*\?>/,
                    ""
                );

                // Find the main SVG tag including all its attributes
                const svgTagMatch = cleanedSvgContent.match(/<svg([^>]*)>/);
                if (!svgTagMatch) {
                    throw new Error("Could not find SVG tag");
                }

                const svgAttrs = svgTagMatch[1];

                // Extract all namespace declarations to preserve them
                const namespaceMatches =
                    svgAttrs.match(/xmlns(:[\w-]+)?="[^"]+"/g) || [];
                const namespaces = namespaceMatches.join(" ");

                // Extract viewBox from the original SVG
                const viewBoxMatch = svgAttrs.match(/viewBox="([^"]+)"/);
                let viewBox = viewBoxMatch
                    ? viewBoxMatch[1].split(/\s+/).map(Number)
                    : [0, 0, 100, 100];

                if (viewBox.length === 2) {
                    viewBox = [0, 0, viewBox[0], viewBox[1]];
                }

                // Extract inner content - remove outer SVG tag
                const innerContent = cleanedSvgContent
                    .replace(/<svg[^>]*>/, "")
                    .replace(/<\/svg>/, "")
                    .trim();

                // Create an inner SVG that preserves all namespaces from the original
                svg += `<g clip-path="url(#logoClip)">
                    <svg x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" 
                        viewBox="${viewBox.join(" ")}" ${namespaces}>
                        ${innerContent}
                    </svg>
                </g>`;
            } catch (e) {
                console.error("Error processing SVG logo:", e);
                // Fallback to image embedding if SVG parsing fails
                svg += `<image x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" 
                    xlink:href="${customLogoSrc}" clip-path="url(#logoClip)" />`;
            }
        } else {
            // For raster images, use an image element
            svg += `<image x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" 
                xlink:href="${customLogoSrc}" clip-path="url(#logoClip)" />`;
        }
    } else {
        // Use the default logo
        try {
            // Fetch the default SVG logo
            const response = await fetch(logoSrc);
            let logoSvgText = await response.text();

            // Remove XML declaration if present
            logoSvgText = logoSvgText.replace(/<\?xml[^>]*\?>/, "");

            // Find the main SVG tag including all its attributes
            const svgTagMatch = logoSvgText.match(/<svg([^>]*)>/);
            if (!svgTagMatch) {
                throw new Error("Could not find SVG tag in default logo");
            }

            const svgAttrs = svgTagMatch[1];

            // Extract all namespace declarations to preserve them
            const namespaceMatches =
                svgAttrs.match(/xmlns(:[\w-]+)?="[^"]+"/g) || [];
            const namespaces = namespaceMatches.join(" ");

            // Extract viewBox
            const viewBoxMatch = svgAttrs.match(/viewBox="([^"]+)"/);
            let viewBox = viewBoxMatch
                ? viewBoxMatch[1].split(/\s+/).map(Number)
                : [0, 0, 100, 100];

            // Extract inner content - carefully remove just the outer SVG tag
            const innerContent = logoSvgText
                .replace(/<svg[^>]*>/, "")
                .replace(/<\/svg>/, "")
                .trim();

            // Add the logo with rectangular clipping and preserved namespaces
            svg += `<g clip-path="url(#logoClip)">
                <svg x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" 
                    viewBox="${viewBox.join(" ")}" ${namespaces}>
                    ${innerContent}
                </svg>
            </g>`;
        } catch (e) {
            console.error("Error loading default logo:", e);
            // Fallback to a simple rectangle if we can't load the logo
            svg += `<rect x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" 
                fill="white" stroke="${qrColor}" stroke-width="2" />`;
        }
    }

    // Close the main group
    svg += "</g>";

    return svg;
}

/**
 * Finalizes the SVG by closing it and downloading it
 */
function finalizeSvgDownload(svg, text) {
    // Close SVG document
    svg += "</svg>";

    // Create download link
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${text}_QR_Code.svg`;
    link.href = url;
    link.click();

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);

    // Show success indicator
    downloadSvgBtnImg.src = "images/done.png";

    resetButtonImage(downloadSvgBtnImg, "images/svg.png");

}

/**
 * Copies the current displayed QR code as an image (PNG) to the clipboard.
 */
function copyQrToClipboard(svg) {

    svg += "</svg>";

    navigator.clipboard.writeText(svg);

    // Indicate success (swap icon)
    copyBtnImg.src = "images/done.png";

    resetButtonImage(copyBtnImg, "images/copy.png");

}

// --------------------------------------------------------------------
// 10. EVENT LISTENERS & INITIALIZATION
// --------------------------------------------------------------------

// 10.1 Text input -> debounced QR generation
textInput.addEventListener("input", generateQRDebounced);

// 10.2 Color inputs -> immediate (non-debounced) QR regeneration
qrColorInput.addEventListener("input", generateQR);
bgColorInput.addEventListener("input", generateQR);

function resetButtonImage(imgElement, originalSrc, delay = 2500) {
    setTimeout(() => {
        imgElement.src = originalSrc;
    }, delay);
}

// 10.3 Download + Copy
downloadPngBtn.addEventListener("click", (e) => {
    e.preventDefault();
    downloadQRCode();
});
downloadSvgBtn.addEventListener("click", (e) => {
    e.preventDefault();
    downloadQRCodeAsSVG();
});
copyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    copyQRCodeAsSVG();
});

// 10.4 Toggle transparent background
transparentBg.addEventListener("change", () => {
    toggleDisabled();
    generateQR();
});

// 10.5 Toggle inclusion of the logo
includeLogoCheckbox.addEventListener("change", () => {
    toggleDisabled()
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

logoImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        // Show the remove button
        logoRemoveButton.style.display = "block";

        const reader = new FileReader();
        reader.onload = (evt) => {
            // Store the custom logo for QR code generation
            customLogoSrc = evt.target.result;

            // Regenerate QR code with the new logo
            generateQR();
        };
        reader.readAsDataURL(file);
    }
});

// 10.9 Button to remove the chosen background image
logoRemoveButton.addEventListener("click", (e) => {
    e.preventDefault();
    customLogoSrc = null;

    const img = document.getElementById("logo-image-preview");
    img.style.display = "none";

    // Hide the remove button
    logoRemoveButton.style.display = "none";

    // Clear the file input
    logoImageInput.value = "";

    addImageLogo.style.display = "block";

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
const bgInput = document.querySelector("#bg-image");

const logoInput = document.querySelector("#logo-image");

bgInput.addEventListener("change", updateImageDisplay);
logoInput.addEventListener("change", updateLogoDisplay);

/**
 * Updates the preview in the background image container.
 */
function updateImageDisplay() {
    const file = bgInput.files[0];
    if (validFileType(file)) {
        imageContainer.style.backgroundImage = `url(${URL.createObjectURL(
            file
        )})`;
        addImageIcon.style.display = "none";
    }
}

function updateLogoDisplay() {
    const file = logoInput.files[0];
    if (file.type === "image/svg+xml") {
        const ogjectURL = URL.createObjectURL(file);

        const img = document.getElementById("logo-image-preview");
        img.src = ogjectURL;
        img.style.display = "block";
        img.style.position = "absolute";
        img.style.width = "25%";
        img.style.height = "25%";
        img.style.objectFit = "contain"

        addImageLogo.style.display = "none";

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

