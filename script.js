const textInput = document.getElementById('text');
const qrCanvas = document.getElementById('canvas');
const qrColorInput = document.getElementById('qrColor'); // QR code color input
const bgColorInput = document.getElementById('bgColor'); // Background color input
const bgColorLabel = document.getElementById('bgColorLabel'); // Background color label
const qrbg  = document.getElementById('bg'); // Container div
const downloadBtn = document.createElement('button'); // Create a download button
downloadBtn.textContent = "Download QR Code";
downloadBtn.style.display = "none"; // Hide initially
document.body.appendChild(downloadBtn); // Append it to the body

const qrSize = 300; // Total QR code size
const logoSrc = 'WRSS_WIT_Logo.svg'; // Path to  SVG logo
let logoSize = qrSize * 0.2; // Logo size

const offscreenScale = 3; // 3x resolution

const scaledLogoSize = logoSize * offscreenScale; 
const scaledSafeZone = scaledLogoSize * 1.1;

let cellSize

const margin = 20; // margin around the QR code

const transparentBg = document.getElementById('transparentBg');

const backgroundImageLabel = document.getElementById('bgImageLabel');

const includeLogoCheckbox = document.getElementById('includeLogo');

const logoWidth2 = qrCanvas / 2;
const logoHeight2 = qrCanvas / 2;

const removeBgImageBtn = document.createElement('button');
removeBgImageBtn.textContent = "Remove Background Image";
removeBgImageBtn.style.display = "none"; // Hide by default
document.body.appendChild(removeBgImageBtn); 

const rotationRange = document.getElementById('rotationRange');
const rotationValueDisplay = document.getElementById('rotationValue');

// Adjust canvas for high DPI
function adjustCanvasForHighDPI(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; // Scale the canvas resolution
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`; 
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor; // Set the background color
    ctx.scale(dpr, dpr); // Scale all drawings accordingly
    return ctx;
}

// Function to update the background color labels
function updateBackgroundColorLabel() {
  if (transparentBg.checked) {
    bgColorInput.style.display = 'none';
    bgColorLabel.style.display = 'none';
    bgImageInput.style.display = 'none';

    bgImageInput.value = "";
    backgroundImageSrc = null;
    removeBgImageBtn.style.display = "none";
    backgroundImageLabel.style.display = 'none';

  } else {
    bgColorInput.style.display = '';
    bgColorLabel.style.display = '';
    bgImageInput.style.display = '';
    backgroundImageLabel.style.display = '';
  }
}


async function generateQR() {
  const text    = textInput.value.trim();
  const qrColor = qrColorInput.value;
  const bgColor = bgColorInput.value;

  const displaySize = 650;


  if (!text) {
    // Clear main canvas
    const mainCtx = adjustCanvasForHighDPI(qrCanvas, displaySize, displaySize);
    mainCtx.clearRect(0, 0, displaySize, displaySize);
    downloadBtn.style.display = "none";
    return;
  }

  // 1) Create an offscreen canvas to draw the QR code
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width  = qrSize * offscreenScale;
  offscreenCanvas.height = qrSize * offscreenScale;
  const offscreenCtx = offscreenCanvas.getContext('2d');

  // 2) Draw the entire QR code (with background/logo) on the offscreen context
  await drawQrToCtx(offscreenCtx, text, qrColor, bgColor);

  // 3) Get the desired rotation from the range input
  const rotationDegrees = parseFloat(rotationRange.value) || 0;

  // 4) Prepare the main canvas
  const mainCtx = adjustCanvasForHighDPI(qrCanvas, displaySize, displaySize);
  mainCtx.clearRect(0, 0, displaySize, displaySize);

  // 5) Apply the rotation transform and draw the offscreen canvas onto the main
  mainCtx.save();

  // Translate to the center, rotate, then translate back
  mainCtx.translate(displaySize / 2, displaySize / 2);
  mainCtx.rotate((rotationDegrees * Math.PI) / 180);
  mainCtx.drawImage(
    offscreenCanvas,
    -450/2, -450/2, 450, 450    // Half the offscreen height
  );
  

  mainCtx.restore();

  // 6) Show the download button
  downloadBtn.style.display = "block";
}

async function drawQrToCtx(ctx, text, qrColor, bgColor) {
  // (1) Clear the given context
  ctx.clearRect(0, 0, qrSize * offscreenScale, qrSize * offscreenScale);

  // (2) Draw background image or color
  if (backgroundImageSrc && !transparentBg.checked) {
    await drawBgImage(ctx, backgroundImageSrc, qrSize * offscreenScale, qrSize * offscreenScale);
  } else if (!transparentBg.checked) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, qrSize * offscreenScale, qrSize * offscreenScale);  }

  // (3) Generate QR data
  const qrCode = await QRCode.create(text, { errorCorrectionLevel: 'H' });

  // (4) Draw QR modules
  const margin     = 20 * offscreenScale;
  const usableSize = (qrSize - 2 * 20) * offscreenScale; 
  const cellSize   = usableSize / qrCode.modules.size;
  
  const logoStart = margin + (usableSize - scaledSafeZone) / 2;
  const logoEnd   = logoStart + scaledSafeZone;

  qrCode.modules.data.forEach((bit, index) => {
    const col = index % qrCode.modules.size;
    const row = Math.floor(index / qrCode.modules.size);

    const x = margin + col * cellSize;
    const y = margin + row * cellSize;

    const cellLeft   = x;
    const cellTop    = y;
    const cellRight  = x + cellSize;
    const cellBottom = y + cellSize;

    const zoneLeft   = logoStart;
    const zoneTop    = logoStart;
    const zoneRight  = logoEnd;
    const zoneBottom = logoEnd;

    // Check intersection
    const intersectsSafeZone =
      !(cellRight  < zoneLeft  ||
        cellLeft   > zoneRight ||
        cellBottom < zoneTop   ||
        cellTop    > zoneBottom);

        const logoIsActive = includeLogoCheckbox.checked;

    // Then in the loop:
    if (logoIsActive && intersectsSafeZone) {
      // Skip the entire cell if it partially intersects
      return;
    }

    // Draw  QR cell if it's fully outside the safe zone
    if (bit) {
      ctx.fillStyle = qrColor;
      ctx.fillRect(
        Math.floor(cellLeft), 
        Math.floor(cellTop),
        Math.ceil(cellSize),
        Math.ceil(cellSize)
      );
    } else if (!transparentBg.checked && !backgroundImageSrc) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(
        Math.floor(cellLeft),
        Math.floor(cellTop),
        Math.ceil(cellSize),
        Math.ceil(cellSize)
      );
    }
});
if (includeLogoCheckbox.checked) {
  // (5) Draw the logo onto this context
  const centerX = margin + usableSize / 2;
  const centerY = margin + usableSize / 2;
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
};
}

function drawBgImage(ctx, src, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Fill entire canvas with this image
      ctx.drawImage(img, 0, 0, width, height);
      resolve();
    };
    img.onerror = reject;
    img.src = src; // e.g. a data URL from FileReader
  });
}

includeLogoCheckbox.addEventListener('change', () => {
  generateQR(); 
});

// bg image
const bgImageInput = document.getElementById('bgImage');

let backgroundImageSrc = null;

bgImageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    removeBgImageBtn.style.display = "none";
    return;
  }; 
  removeBgImageBtn.style.display = "block";

  const reader = new FileReader();
  reader.onload = (evt) => {
    backgroundImageSrc = evt.target.result; 
    generateQR(); // Regenerate the QR to show new background
  };
  reader.readAsDataURL(file);
});

rotationRange.addEventListener('input', () => {
  rotationValueDisplay.textContent = rotationRange.value + '°';
  generateQR();
});

removeBgImageBtn.addEventListener('click', (e) => {
e.preventDefault();
bgImageInput.value = "";
backgroundImageSrc = null;
removeBgImageBtn.style.display = "none";
generateQR(); // Regenerate the QR to remove background
});


// Function to update the div background color
function updateDivBackgroundColor() {
  qrCanvas.style.backgroundColor = bgColorInput.value; // Change the div's background color
}

async function drawSvgToCanvas(svgPath, canvas, centerX, centerY, width, height, bgColor, qrColor) {
  const response = await fetch(svgPath);
  let svgText = await response.text();

  // Modify the SVG to change colors dynamically
  if (!transparentBg.checked && !backgroundImageSrc) {
    svgText = svgText.replace(
      /<svg([^>]*)>/,
      `<svg$1><rect width="100%" height="100%" fill="${bgColor}" />`
    );
  }

  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  return new Promise((resolve, reject) => {
      img.onload = () => {
          const ctx = canvas.getContext('2d');
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

// Event listener for the input field
function downloadQRCode() {
  const link = document.createElement('a');
  link.download = textInput.value.trim() + '_QR_Code.png';
  link.href = qrCanvas.toDataURL('image/png'); // Get the canvas as a PNG data URL
  link.click();
}

// Event listeners
textInput.addEventListener('input', generateQR);
qrColorInput.addEventListener('input', generateQR); // Regenerate QR code on color change
bgColorInput.addEventListener('input', generateQR);
downloadBtn.addEventListener('click', downloadQRCode);
transparentBg.addEventListener('change', () => {
  updateBackgroundColorLabel();
  generateQR();
}
);

// Initial call to ensure the QR code generates on load
generateQR();
updateBackgroundColorLabel();