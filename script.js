const textInput = document.getElementById('text');
const qrCanvas = document.getElementById('canvas');
const downloadBtn = document.createElement('button'); // Create a download button
downloadBtn.textContent = "Download QR Code";
downloadBtn.style.display = "none"; // Hide initially
document.body.appendChild(downloadBtn); // Append it to the body

const qrSize = 300; // Total QR code size
const logoSrc = 'WRSS_WIT_Logo.svg'; // Path to your SVG logo
let logoSize = qrSize * 0.213; // Logo size
let safeZone = logoSize; // Slightly larger than logo for padding

let logoStartX = (qrSize - safeZone) / 2;
let logoStartY = (qrSize - safeZone) / 2;
let logoEndX = logoStartX + safeZone;
let logoEndY = logoStartY + safeZone;

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
    ctx.scale(dpr, dpr); // Scale all drawings accordingly
    return ctx;
}

async function generateQR() {
    const text = textInput.value.trim();

    if (!text) {
        qrCanvas.getContext('2d').clearRect(0, 0, qrSize, qrSize);
        return;
    }

    const ctx = adjustCanvasForHighDPI(qrCanvas, qrSize, qrSize); // Adjust for high DPI
    ctx.clearRect(0, 0, qrSize, qrSize);

    const qrCode = await QRCode.create(text, {
        errorCorrectionLevel: 'H',
    });

    const cellSize = qrSize / qrCode.modules.size; // Size of each module

    // if the cell size is too small, increase the safe zone
    if (cellSize < 6) {
        safeZone = logoSize * 1.2; // Add 2px padding
    }



    // Draw the QR code manually, skipping the logo area
    qrCode.modules.data.forEach((bit, index) => {
        const col = index % qrCode.modules.size;
        const row = Math.floor(index / qrCode.modules.size);

        // Calculate module position
        const x = col * cellSize;
        const y = row * cellSize;

        // Skip cells that overlap the logo area
        logoStartX = (qrSize - safeZone) / 2;
        logoStartY = (qrSize - safeZone) / 2;
        logoEndX = logoStartX + safeZone;
        logoEndY = logoStartY + safeZone;
        
        // logo width
        
        
        if (
          x >= logoStartX &&
          x < logoEndX &&
          y >= logoStartY &&
          y < logoEndY
        ) {
          return; // Skip drawing this cell
        }
        
        // Draw the module
        ctx.fillStyle = bit ? '#000' : '#fff'; // Black for 1, white for 0
        ctx.fillRect(x, y, cellSize, cellSize);
      });
      
      const logoWidth = logoEndX - logoStartX;
      logoSize = logoWidth;
    // Draw the SVG logo in the center
    drawSvgToCanvas(logoSrc, qrCanvas, qrSize / 2, qrSize / 2, logoSize, logoSize);

    downloadBtn.style.display = "block";

}

async function drawSvgToCanvas(svgPath, canvas, centerX, centerY, width, height) {
  const response = await fetch(svgPath);
  const svgText = await response.text();
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  return new Promise((resolve, reject) => {
      img.onload = () => {
          const ctx = canvas.getContext('2d');
          const imgX = logoWidth2 - width / 2;
          const imgY = logoHeight2 - height / 2;
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
downloadBtn.addEventListener('click', downloadQRCode);

// Initial call to ensure the QR code generates on load
generateQR();