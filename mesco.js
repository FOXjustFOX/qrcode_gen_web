const label = document.querySelector("#icon-image");
const input = document.querySelector("#bg-image");
const imageContainer = document.querySelector("#image-container");

input.addEventListener("change", updateImageDisplay);

function updateImageDisplay() {
  const file = input.files[0];
  if (validFileType(file)) {
    imageContainer.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
  }
}

const fileTypes = ["image/apng", "image/bmp", "image/gif", "image/jpeg", "image/pjpeg", "image/png", "image/svg+xml", "image/tiff", "image/webp", "image/x-icon"];
function validFileType(file) {
  return fileTypes.includes(file.type);
}
