
document.addEventListener("DOMContentLoaded", () => {
  const qrContainer = document.getElementById("qr-container");

  const createQrCode = () => {
    // Clear any existing QR code
    qrContainer.innerHTML = "";

    // Create a new QR code element
    const qrCodeElement = document.createElement("qr-code");

    // Get values from the form
    const qrContent = document.getElementById("qr-content").value;
    const moduleColor = document.getElementById("module-color").value;
    const positionRingColor = document.getElementById("position-ring-color").value;
    const positionCenterColor = document.getElementById("position-center-color").value;
    const bgColor = document.getElementById("bg-color").value;
    const height = document.getElementById("height").value;
    const width = height; 
    const rotation_value = document.getElementById("rotate-value");

    // const width = document.getElementById("height").value;

    // Set attributes for the QR code
    qrCodeElement.setAttribute("id", "qrCodeElement");
    qrCodeElement.contents = qrContent; // Set the content of the QR code
    qrCodeElement.setAttribute("module-color", moduleColor);
    qrCodeElement.setAttribute("position-ring-color", positionRingColor);
    qrCodeElement.setAttribute("position-center-color", positionCenterColor);
    qrCodeElement.setAttribute("mask-x-to-y-ratio", 1);
    
    // Set styles for the QR code
    qrCodeElement.style.width = `${width}px`;
    qrCodeElement.style.height = `${height}px`;
    qrCodeElement.style.margin = "2em auto";
    qrCodeElement.style.padding = "100px auto";
    // qrCodeElement.style.backgroundColor = "#fff";
    
    //logo img
    // <img src="WRSS WIT Logo.svg" alt="hello" slot="icon">  just for reference
    const logo = document.createElement("img");
    logo.src = "WRSS WIT Logo.svg"
    logo.id = "logo";
    logo.slot = "icon";
    qrCodeElement.appendChild(logo);

    //qr code rotation
    rotation_value.addEventListener("input", () => {
      let rotation = parseFloat(rotation_value.value) || 0;      
      qrContainer.style.transform = `rotate(${rotation}deg)`;
    });

    // Append the QR code element to the container
    qrContainer.appendChild(qrCodeElement);

    qrCodeElement.style.backgroundColor = bgColor;
    // qrCodeElement.style.backgroundColor = "red";
    
    document.getElementById("update-qr").textContent = "Update QR Code";
    // document.getElementById('qrCodeElement').addEventListener('codeRendered', () => {
    //   document.getElementById('qrCodeElement').animateQRCode('FadeInTopDown');
    // });
  };

  // Create an initial QR code
  createQrCode();

  // Update QR code when the button is clicked
  document.getElementById("update-qr").addEventListener("click", createQrCode);

  //download qr code
  const downloadButton = document.createElement("button");
  downloadButton.id = "download-qr";
  downloadButton.textContent = "Download QR Code (SVG)";
  downloadButton.style.marginTop = "20px";
  downloadButton.style.padding = "10px 20px";
  downloadButton.style.fontSize = "16px";
  downloadButton.style.cursor = "pointer";
  downloadButton.style.borderRadius = "25px";
  downloadButton.style.backgroundColor = "#007bff";
  downloadButton.style.color = "white";
  downloadButton.style.border = "none";
  downloadButton.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.1)";
  downloadButton.style.transition = "background-color 0.3s ease, box-shadow 0.3s ease";

  // Add hover effects
  downloadButton.addEventListener("mouseover", () => {
    downloadButton.style.backgroundColor = "#0056b3";
    downloadButton.style.boxShadow = "0px 4px 12px rgba(0, 86, 179, 0.4)";
  });
  downloadButton.addEventListener("mouseout", () => {
    downloadButton.style.backgroundColor = "#007bff";
    downloadButton.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.1)";
  });

  // Append the button to the body
  document.body.appendChild(downloadButton);

  // Enable download functionality
  downloadButton.addEventListener("click", async () => {
    // Locate the custom `<qr-code>` component
    const qrCodeComponent = document.querySelector("#qrCodeElement");
  
    if (!qrCodeComponent) {
      console.error("No QR code component found");
      return;
    }
  
    // Access the shadow root of the `<qr-code>` component
    const shadowRoot = qrCodeComponent.shadowRoot;
  
    if (!shadowRoot) {
      console.error("No shadow root found in the QR code component");
      return;
    }
  
    // Locate the SVG inside the shadow DOM
    const qrCodeSvg = shadowRoot.querySelector("#qr-container > div:nth-child(2) > svg");
  
    if (!qrCodeSvg) {
      console.error("No QR code SVG found within the shadow root");
      return;
    }
  
    // Clone the SVG element
    const clonedSvg = qrCodeSvg.cloneNode(true);
  
    // Include the logo
    const logo = document.getElementById("logo");
    if (logo) {
      const logoData = await fetch(logo.src)
        .then((response) => response.blob())
        .then((blob) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        });
  
      // Embed the logo into the SVG
      const svgNS = "http://www.w3.org/2000/svg";
      const embeddedLogo = document.createElementNS(svgNS, "image");
      embeddedLogo.setAttributeNS(null, "href", logoData);
      embeddedLogo.setAttribute("x", "50"); // Adjust position as needed
      embeddedLogo.setAttribute("y", "50");
      embeddedLogo.setAttribute("width", "40"); // Adjust size as needed
      embeddedLogo.setAttribute("height", "40");
      clonedSvg.appendChild(embeddedLogo);
    }
  
    // Serialize the SVG
    const serializer = new XMLSerializer();
    const serializedSvg = serializer.serializeToString(clonedSvg);
  
    // Create an `img` element to render the SVG on a canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
  
    const img = new Image();
    img.onload = () => {
      // Adjust canvas size to match the SVG dimensions
      const qrWidth = parseInt(qrCodeComponent.style.width) || 200;
      const qrHeight = parseInt(qrCodeComponent.style.height) || 200;
      canvas.width = qrWidth;
      canvas.height = qrHeight;
  
      // Draw the SVG onto the canvas
      ctx.drawImage(img, 0, 0, qrWidth, qrHeight);
  
      // Convert the canvas content to a PNG image
      const pngUrl = canvas.toDataURL("image/png");
  
      // Trigger the download
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "QR_Code.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  
    // Set the source of the `img` element to the serialized SVG as a data URL
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializedSvg)}`;
  });
});