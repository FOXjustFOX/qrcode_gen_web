# QR Code Generator Documentation

This documentation provides an overview of the functionality, usage, and components of the QR Code Generator script. The script allows users to create customizable QR codes with various features, including transparent backgrounds, embedded logos, rotation, and more.

---

## Features

-   **Customizable QR Code**: Generate QR codes with user-defined text, colors, backgrounds, and more.
-   **High-DPI Support**: Automatically adjusts for retina displays using `window.devicePixelRatio`.
-   **Background Options**: Choose between a solid color, transparent background, or custom background image.
-   **Embedded Logo**: Optionally overlay a logo at the center of the QR code.
-   **Rotation Control**: Rotate the QR code from 0 to 360 degrees.
-   **Debounced Input**: Prevents excessive re-rendering while typing.
-   **Download and Copy**: Save the QR code as a PNG file or copy it to the clipboard.

---

## File Requirements

-   **SVG Logo**: `WRSS_WIT_Logo.svg` (used for the optional center logo).
-   **Button State Images**:
    -   `download.png` (default state of the download button).
    -   `copy.png` (default state of the copy button).
    -   `done.png` (indicates a successful download or copy action).

---

## HTML Elements and IDs

### Inputs and Controls

| **Element Type** | **ID**          | **Description**                           |
| ---------------- | --------------- | ----------------------------------------- |
| Text Input       | `text`          | Input field for the QR code content.      |
| Color Input      | `qrColor`       | Selects the color of the QR modules.      |
| Color Input      | `bgColor`       | Selects the background color.             |
| Checkbox         | `transparentBg` | Toggles the transparent background.       |
| Checkbox         | `includeLogo`   | Toggles the inclusion of the center logo. |
| File Input       | `bg-image`      | Uploads a custom background image.        |
| Range Input      | `rotationRange` | Controls the rotation of the QR code.     |
| Number Input     | `rotationValue` | Displays the rotation value in degrees.   |

### Buttons

| **Element Type** | **ID**        | **Description**                            |
| ---------------- | ------------- | ------------------------------------------ |
| Button           | `downloadBtn` | Downloads the generated QR code as a PNG.  |
| Button           | `copyBtn`     | Copies the QR code image to the clipboard. |

### Containers and UI Elements

| **Element Type** | **ID**                | **Description**                                      |
| ---------------- | --------------------- | ---------------------------------------------------- |
| Div              | `qr-container`        | Container for the QR code canvas.                    |
| Canvas           | `canvas`              | Main canvas where the QR code is drawn.              |
| Div              | `image-container`     | Container for the background image preview.          |
| Image            | `add-image-icon`      | Icon displayed when no background image is selected. |
| Button           | `image-remove-button` | Removes the selected background image.               |

---

## Script Functionality

### 1. **High-DPI Canvas Adjustment**

The canvas resolution automatically scales with the device's pixel ratio for sharper rendering on high-DPI screens.

### 2. **Dynamic QR Code Resizing**

The QR code's size adjusts based on the container's width, ensuring it remains responsive across devices.

### 3. **Custom QR Code Generation**

-   **Text Input**: The QR code content updates dynamically based on the text entered.
-   **Color Options**: Users can customize the module and background colors.
-   **Background Options**:
    -   Transparent: Toggle via the `transparentBg` checkbox.
    -   Solid Color: Select via the `bgColor` input.
    -   Image: Upload via the `bg-image` input.

### 4. **Logo Integration**

A logo (from `WRSS_WIT_Logo.svg`) can be embedded at the center of the QR code. The script ensures the logo area is clear of QR modules.

### 5. **Rotation**

The QR code can be rotated by specifying an angle (0–360 degrees) using the range slider (`rotationRange`) or numeric input (`rotationValue`).

### 6. **Download and Copy**

-   **Download**: Saves the QR code as a PNG file using the `downloadBtn`.
-   **Copy**: Copies the QR code as an image to the clipboard using the `copyBtn`.

---

## Background Image Handling

-   Users can upload an image via the `bg-image` input.
-   The background image replaces the background color when selected.
-   The image can be removed using the `image-remove-button`.

---

## Event Listeners

| **Event** | **Element**           | **Description**                               |
| --------- | --------------------- | --------------------------------------------- |
| `input`   | `text`                | Updates the QR code content (debounced).      |
| `input`   | `qrColor`, `bgColor`  | Updates the QR and background colors.         |
| `change`  | `transparentBg`       | Toggles transparency and regenerates QR.      |
| `change`  | `includeLogo`         | Toggles logo inclusion and regenerates QR.    |
| `input`   | `rotationRange`       | Updates rotation and regenerates QR.          |
| `input`   | `rotationValue`       | Updates rotation via numeric input.           |
| `change`  | `bg-image`            | Sets the background image.                    |
| `click`   | `image-remove-button` | Removes the selected background image.        |
| `click`   | `downloadBtn`         | Triggers the download functionality.          |
| `click`   | `copyBtn`             | Triggers the copy-to-clipboard functionality. |

---

## Initial Setup and Usage

### 1. **Include the Required Files**

-   SVG logo: `WRSS_WIT_Logo.svg`.
-   Button state images: `download.png`, `copy.png`, `done.png`.

### 2. **HTML Structure**

Ensure your HTML contains elements with the IDs listed above.

### 3. **Initialization**

The script automatically resizes the QR code to fit its container and generates an initial QR code on page load.

### 4. **Customizing the QR Code**

-   Input text into the text field (`text`).
-   Adjust colors, transparency, rotation, or add a logo using the provided controls.

---

## Dependencies

-   **QR Code Library**: Ensure you have a library that supports `QRCode.create(text, { errorCorrectionLevel: "H" })`.

---

## Notes

-   The QR code size dynamically adapts to the container, ensuring a responsive design.
-   All user inputs (text, colors, images, etc.) are reflected in real-time or with minimal delay (debounced).
-   The script ensures high-DPI rendering for clear visuals on modern displays.

---

Feel free to integrate this script into your project and customize it to meet your specific needs. For further assistance, consult the script's inline comments or reach out for support.
