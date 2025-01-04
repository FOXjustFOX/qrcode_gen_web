const textInput = document.getElementById('text');
const qrCanvas = document.getElementById('canvas');
const qrColorInput = document.getElementById('qrColor'); // QR code color input
const bgColorInput = document.getElementById('bgColor'); // Background color input
const qrbg  = document.getElementById('bg'); // Container div
const downloadBtn = document.createElement('button'); // Create a download button
downloadBtn.textContent = "Download QR Code";
downloadBtn.style.display = "none"; // Hide initially
document.body.appendChild(downloadBtn); // Append it to the body

const qrSize = 300; // Total QR code size
const logoSrc = 'WRSS_WIT_Logo.svg'; // Path to your SVG logo
let logoSize = qrSize * 0.213; // Logo size
let safeZone = logoSize * 1.1; // Slightly larger than logo for padding

let cellSize

const margin = 20; // margin around the QR code

const logoWidth2 = qrCanvas / 2;
const logoHeight2 = qrCanvas / 2;

// Adjust canvas for high DPI
function adjustCanvasForHighDPI(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; // Scale the canvas resolution
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`; // Set the CSS size
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor; // Set the background color
    ctx.scale(dpr, dpr); // Scale all drawings accordingly
    return ctx;
}



async function generateQR() {
  const text = textInput.value.trim();
  const qrColor = qrColorInput.value;
  const bgColor = bgColorInput.value;

  if (!text) {
    qrCanvas.getContext('2d').clearRect(0, 0, qrSize, qrSize);
    return;
  }

  const ctx = adjustCanvasForHighDPI(qrCanvas, qrSize, qrSize); 
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, qrSize, qrSize); // Fill entire canvas w/ bgColor

  // Generate the QR data first
  const qrCode = await QRCode.create(text, {
    errorCorrectionLevel: 'H',
  });

  // Now define margin, usableSize, and cellSize
  const margin = 20;
  const usableSize = qrSize - 2 * margin;
  cellSize = usableSize / qrCode.modules.size; // OK now, because qrCode exists

  // Then define centerX, centerY, radius, etc.
  const centerX = margin + usableSize / 2;
  const centerY = margin + usableSize / 2;
  const radius = safeZone / 2;

  cellSize = usableSize / qrCode.modules.size;
  

  // Draw QR code modules, skipping the logo area
  qrCode.modules.data.forEach((bit, index) => {
    const col = index % qrCode.modules.size;
    const row = Math.floor(index / qrCode.modules.size);
  
    // Each module’s top-left corner
    const x = margin + col * cellSize;
    const y = margin + row * cellSize;
  
    // --- CIRCLE CHECK ---
    // Use the center of the module cell for best visual results
    const moduleCenterX = x + cellSize / 2;
    const moduleCenterY = y + cellSize / 2;
  
    // Distance² from (centerX, centerY)
    const distSq = (moduleCenterX - centerX) ** 2 + (moduleCenterY - centerY) ** 2;
    const rSq = radius ** 2;
  
    // Skip any modules that fall within the circular safe zone
    if (distSq <= rSq) {
      return; 
    }
  
    // Otherwise, fill the module
    ctx.fillStyle = bit ? qrColor : bgColor;
    ctx.fillRect(x, y, cellSize, cellSize);
  });

  // Center for the logo is now margin + half of the usable area

  // Pass bgColor, qrColor along as before
  await drawSvgToCanvas(
    logoSrc,
    qrCanvas,
    centerX,   // pass the same center
    centerY,   // pass the same center
    logoSize,
    logoSize,
    bgColor,
    qrColor
  );

  downloadBtn.style.display = "block";
}
// Function to update the div background color
function updateDivBackgroundColor() {
  qrCanvas.style.backgroundColor = bgColorInput.value; // Change the div's background color
}

async function drawSvgToCanvas(svgPath, canvas, centerX, centerY, width, height, bgColor, qrColor) {
  const response = await fetch(svgPath);
  let svgText = await response.text();

  // Modify the SVG to change colors dynamically
  svgText = svgText.replace(
    /<svg([^>]*)>/,
    `<svg$1><rect width="100%" height="100%" fill="${bgColor}" />`
  );



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

// Initial call to ensure the QR code generates on load
generateQR();