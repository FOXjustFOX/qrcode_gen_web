const textInput = document.getElementById('text');
    const toggleImage = document.getElementById('toggleImage');
    const qrCanvas = document.getElementById('canvas');
    const qrDisplay = document.getElementById('qrcode');
    const downloadBtn = document.getElementById('downloadBtn');
  
    let debounceTimer;
  
    async function generateQR() {
      const text = textInput.value.trim();
      const addImage = toggleImage.checked;
  
      if (!text) {
        qrDisplay.innerHTML = ''; // Clear the QR code if input is empty
        qrCanvas.style.opacity = '0'; // Hide the canvas
        downloadBtn.style.display = 'none'; // Hide the download button
        return;
      }
  
      clearTimeout(debounceTimer); // Clear previous debounce timer
  
      debounceTimer = setTimeout(async () => {
        const ctx = qrCanvas.getContext('2d');
        ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height); // Clear the canvas
  
        // Generate the QR code with high error correction level
        await QRCode.toCanvas(qrCanvas, text, {
          width: 300,
          errorCorrectionLevel: 'H', // High error correction
        });
  
        if (addImage) {
          // Embed the predefined image in the center
          const img = new Image();
          img.src = 'Wit_Cropped_Margin Background Removed.png'; // Updated image path
          img.onload = () => {
            const maxSize = qrCanvas.width * 0.3; // Max image size is 30% of QR code
            const centerX = (qrCanvas.width - maxSize) / 2;
            const centerY = (qrCanvas.height - maxSize) / 2;
            ctx.drawImage(img, centerX, centerY, maxSize, maxSize); // Adjust size as needed
            finalizeQRCode();
          };
        } else {
          finalizeQRCode();
        }
      }, 200); // Debounce for 200ms
    }
  
    function finalizeQRCode() {
      qrCanvas.style.opacity = '1'; // Show the canvas with smooth fade-in
      downloadBtn.style.display = 'block'; // Show the download button
    }
  
    function downloadQRCode() {
      const link = document.createElement('a');
      link.download = textInput.value.trim() + '_QR_Code.png';
      link.href = qrCanvas.toDataURL('image/png'); // Get the canvas as a PNG data URL
      link.click();
    }
  
    // Event listeners
    textInput.addEventListener('input', generateQR);
    toggleImage.addEventListener('change', generateQR);
    downloadBtn.addEventListener('click', downloadQRCode);