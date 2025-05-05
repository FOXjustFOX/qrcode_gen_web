import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import "./QRGenerator.css";

interface QRGeneratorProps {
    logoSrc: string;
}

const QRGenerator: React.FC<QRGeneratorProps> = ({ logoSrc }) => {
    const [text, setText] = useState("");
    const [qrColor, setQrColor] = useState("#000000");
    const [bgColor, setBgColor] = useState("#ffffff");
    const [transparentBg, setTransparentBg] = useState(false);
    const [includeLogo, setIncludeLogo] = useState(true);
    const [rotation, setRotation] = useState(0);
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [customLogo, setCustomLogo] = useState<string | null>(null);
    const [showSaveButtons, setShowSaveButtons] = useState(false);
    const [buttonImages, setButtonImages] = useState({
        png: "/images/png.png",
        svg: "/images/svg.png",
        copy: "/images/copy.png",
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const qrContainerRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const margin = 20;
    const offscreenScale = 3;
    const [qrSize, setQrSize] = useState(0);
    const [displaySize, setDisplaySize] = useState(0);
    // const [logoSize, setLogoSize] = useState(0);
    const [scaledLogoSize, setScaledLogoSize] = useState(0);
    const [scaledSafeZone, setScaledSafeZone] = useState(0);

    const adjustCanvasForHighDPI = (
        canvas: HTMLCanvasElement,
        width: number,
        height: number
    ) => {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.scale(dpr, dpr);
            return ctx;
        }
        return null;
    };

    const resizeCanvasToContainer = () => {
        if (!qrContainerRef.current) return;

        const newQrSize =
            (qrContainerRef.current.offsetWidth * Math.sqrt(2)) / 2;
        const newDisplaySize = qrContainerRef.current.offsetWidth;
        const newLogoSize = newQrSize * 0.2;
        const newScaledLogoSize = newLogoSize * offscreenScale;
        const newScaledSafeZone = newScaledLogoSize * 1.1;

        setQrSize(newQrSize);
        setDisplaySize(newDisplaySize);
        // setLogoSize(newLogoSize);
        setScaledLogoSize(newScaledLogoSize);
        setScaledSafeZone(newScaledSafeZone);
    };

    useEffect(() => {
        resizeCanvasToContainer();
        window.addEventListener("resize", resizeCanvasToContainer);
        return () =>
            window.removeEventListener("resize", resizeCanvasToContainer);
    }, []);

    const drawQrToCtx = async (
        ctx: CanvasRenderingContext2D,
        text: string,
        qrColor: string,
        bgColor: string
    ) => {
        const width = qrSize * offscreenScale;
        const height = qrSize * offscreenScale;

        // 1) Clear offscreen canvas
        ctx.clearRect(0, 0, width, height);

        // 2) Draw background (color or image) if applicable
        if (backgroundImage && !transparentBg) {
            const bgImage = new Image();
            bgImage.src = backgroundImage;
            await new Promise((resolve) => {
                bgImage.onload = resolve;
            });
            ctx.drawImage(bgImage, 0, 0, width, height);
        } else if (!transparentBg) {
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
            if (includeLogo && intersectsSafeZone) return;

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
            else if (!transparentBg && !backgroundImage) {
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
        if (includeLogo) {
            const centerX = marginPx + usableSize / 2;
            const centerY = marginPx + usableSize / 2;

            const logoToUse = customLogo || logoSrc;
            const logoImage = new Image();
            logoImage.src = logoToUse;
            await new Promise((resolve) => {
                logoImage.onload = resolve;
            });

            const logoX = centerX - scaledLogoSize / 2;
            const logoY = centerY - scaledLogoSize / 2;

            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, scaledLogoSize / 2, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(
                logoImage,
                logoX,
                logoY,
                scaledLogoSize,
                scaledLogoSize
            );
            ctx.restore();
        }
    };

    const generateQR = async () => {
        if (!canvasRef.current || !text.trim()) {
            setShowSaveButtons(false);
            return;
        }

        const canvas = canvasRef.current;
        const mainCtx = adjustCanvasForHighDPI(
            canvas,
            displaySize,
            displaySize
        );
        if (!mainCtx) return;

        mainCtx.clearRect(0, 0, displaySize, displaySize);

        try {
            const offscreenCanvas = document.createElement("canvas");
            offscreenCanvas.width = qrSize * offscreenScale;
            offscreenCanvas.height = qrSize * offscreenScale;
            const offscreenCtx = offscreenCanvas.getContext("2d");
            if (!offscreenCtx) return;

            await drawQrToCtx(offscreenCtx, text, qrColor, bgColor);

            // Apply rotation and draw to main canvas
            mainCtx.save();
            mainCtx.translate(displaySize / 2, displaySize / 2);
            mainCtx.rotate((rotation * Math.PI) / 180);
            mainCtx.drawImage(
                offscreenCanvas,
                -qrSize / 2,
                -qrSize / 2,
                qrSize,
                qrSize
            );
            mainCtx.restore();

            setShowSaveButtons(true);
        } catch (error) {
            console.error("Error generating QR code:", error);
        }
    };

    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(generateQR, 300);
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [
        text,
        qrColor,
        bgColor,
        transparentBg,
        includeLogo,
        rotation,
        backgroundImage,
        customLogo,
        qrSize,
        displaySize,
    ]);

    const handleFileUpload = (
        event: React.ChangeEvent<HTMLInputElement>,
        type: "background" | "logo"
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (
            type === "background" &&
            !["image/jpeg", "image/png"].includes(file.type)
        ) {
            alert("Please upload a JPEG or PNG file for the background");
            return;
        }

        if (type === "logo" && file.type !== "image/svg+xml") {
            alert("Please upload an SVG file for the logo");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (type === "background") {
                setBackgroundImage(e.target?.result as string);
            } else {
                setCustomLogo(e.target?.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const downloadQRCode = (format: "png" | "svg") => {
        if (!canvasRef.current || !text.trim()) return;

        if (format === "png") {
            const link = document.createElement("a");
            link.download = `${text.trim()}_QR_Code.png`;
            link.href = canvasRef.current.toDataURL("image/png");
            link.click();

            // Show success indicator
            setButtonImages((prev) => ({ ...prev, png: "/images/done.png" }));
            setTimeout(() => {
                setButtonImages((prev) => ({
                    ...prev,
                    png: "/images/png.png",
                }));
            }, 2500);
        } else {
            // SVG download logic
            const qrCode = QRCode.create(text.trim(), {
                errorCorrectionLevel: "H",
            });
            const rotationRadians = Math.abs((rotation * Math.PI) / 180);
            const expansionFactor = Math.max(
                Math.abs(Math.cos(rotationRadians)) +
                    Math.abs(Math.sin(rotationRadians)),
                1
            );

            const baseSize = 1000;
            const expandedSize = Math.ceil(baseSize * expansionFactor);
            const paddingSize = baseSize * 0.1;
            const size = expandedSize + paddingSize * 2;

            const centerX = size / 2;
            const centerY = size / 2;

            const marginPx = baseSize * (margin / qrSize);
            const usableSize = baseSize - 2 * marginPx;
            const cellSize = usableSize / qrCode.modules.size;

            let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
            svg += "<g>";

            svg += `<g transform="translate(${centerX}, ${centerY}) rotate(${rotation})">`;

            const qrAreaSize = baseSize;
            const qrAreaX = -qrAreaSize / 2;
            const qrAreaY = -qrAreaSize / 2;

            if (!transparentBg) {
                svg += `<rect x="${qrAreaX}" y="${qrAreaY}" width="${qrAreaSize}" height="${qrAreaSize}" fill="${bgColor}" />`;
            }

            const qrX = -baseSize / 2;
            const qrY = -baseSize / 2;

            const logoSize = usableSize * 0.2;
            const safeZone = logoSize * 1.1;
            const logoStartOffset = (usableSize - safeZone) / 2;
            const logoStart = marginPx + logoStartOffset;
            const logoEnd = logoStart + safeZone;

            let pathData = "";

            qrCode.modules.data.forEach((bit, index) => {
                if (!bit) return;

                const col = index % qrCode.modules.size;
                const row = Math.floor(index / qrCode.modules.size);

                const x = qrX + marginPx + col * cellSize;
                const y = qrY + marginPx + row * cellSize;

                const rotatedLogoStart = qrX + logoStart;
                const rotatedLogoEnd = qrX + logoEnd;

                if (includeLogo) {
                    const intersectsSafeZone = !(
                        x + cellSize < rotatedLogoStart ||
                        x > rotatedLogoEnd ||
                        y + cellSize < rotatedLogoStart ||
                        y > rotatedLogoEnd
                    );

                    if (intersectsSafeZone) return;
                }

                pathData += `M${x},${y}h${cellSize}v${cellSize}h${-cellSize}z`;
            });

            svg += `<path d="${pathData}" fill="${qrColor}" />`;
            svg += `</g>`;

            if (includeLogo) {
                const logoWidth = logoSize;
                const logoHeight = logoSize;
                const logoX = centerX - logoWidth / 2;
                const logoY = centerY - logoHeight / 2;

                svg += `<defs>
                    <clipPath id="logoClip">
                        <rect x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" />
                    </clipPath>
                </defs>`;

                const logoToUse = customLogo || logoSrc;
                svg += `<g clip-path="url(#logoClip)">
                    <image x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" 
                        xlink:href="${logoToUse}" />
                </g>`;
            }

            svg += "</g></svg>";

            const blob = new Blob([svg], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.download = `${text.trim()}_QR_Code.svg`;
            link.href = url;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 100);

            setButtonImages((prev) => ({ ...prev, svg: "/images/done.png" }));
            setTimeout(() => {
                setButtonImages((prev) => ({
                    ...prev,
                    svg: "/images/svg.png",
                }));
            }, 2500);
        }
    };

    const copyQRCode = async () => {
        if (!canvasRef.current || !text.trim()) return;

        try {
            const svg = await QRCode.toString(text.trim(), {
                errorCorrectionLevel: "H",
                width: 1000,
                margin: 1,
                color: {
                    dark: qrColor,
                    light: transparentBg ? "#00000000" : bgColor,
                },
            });

            await navigator.clipboard.writeText(svg);

            setButtonImages((prev) => ({ ...prev, copy: "/images/done.png" }));
            setTimeout(() => {
                setButtonImages((prev) => ({
                    ...prev,
                    copy: "/images/copy.png",
                }));
            }, 2500);
        } catch (error) {
            console.error("Error copying QR code:", error);
        }
    };

    return (
        <div className="qr-generator">
            <div className="container">
                <div className="left-container">
                    <div className="title-container">
                        <p className="title">
                            Tu wpisz adres URL, który przekieruje ten kod QR:
                        </p>
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Np. https://www.facebook.com/samorzad.wita"
                        />
                    </div>
                    <div className="sections">
                        <div className="section-container">
                            <p className="section-title">Kolor kodu QR:</p>
                            <input
                                type="color"
                                value={qrColor}
                                onChange={(e) => setQrColor(e.target.value)}
                            />
                            <div className="logo-container">
                                <p className="section-title">Logo?</p>
                                <input
                                    type="checkbox"
                                    checked={includeLogo}
                                    onChange={(e) =>
                                        setIncludeLogo(e.target.checked)
                                    }
                                    className="button"
                                />
                            </div>
                        </div>
                        <div className="section-container color-section">
                            <p className="section-title">Kolor tła:</p>
                            <input
                                type="color"
                                value={bgColor}
                                onChange={(e) => setBgColor(e.target.value)}
                                disabled={transparentBg}
                            />
                            <p className="section-title">Przezroczyste tło?</p>
                            <input
                                type="checkbox"
                                checked={transparentBg}
                                onChange={(e) =>
                                    setTransparentBg(e.target.checked)
                                }
                                className="button"
                            />
                        </div>
                        <div className="section-container image-section">
                            <p className="section-title">Grafika:</p>
                            <div className="image-container">
                                <label htmlFor="bg-image" className="button">
                                    <img
                                        src="/images/Group.png"
                                        alt="add image icon"
                                    />
                                    <input
                                        type="file"
                                        id="bg-image"
                                        accept=".jpg,.jpeg,.png"
                                        onChange={(e) =>
                                            handleFileUpload(e, "background")
                                        }
                                    />
                                </label>
                            </div>
                            {backgroundImage && (
                                <button
                                    className="button"
                                    onClick={() => setBackgroundImage(null)}>
                                    <p>Usuń zdjęcie tła</p>
                                </button>
                            )}
                        </div>
                        <div className="section-container image-section">
                            <p className="section-title">Własne logo:</p>
                            <div className="logo-image-container">
                                <label htmlFor="logo-image" className="button">
                                    {customLogo ? (
                                        <img
                                            src={customLogo}
                                            alt="własne logo"
                                        />
                                    ) : (
                                        <img
                                            src="/images/Group.png"
                                            alt="add image logo"
                                        />
                                    )}
                                    <input
                                        type="file"
                                        id="logo-image"
                                        accept=".svg"
                                        onChange={(e) =>
                                            handleFileUpload(e, "logo")
                                        }
                                    />
                                </label>
                            </div>
                            {customLogo && (
                                <button
                                    className="button"
                                    onClick={() => setCustomLogo(null)}>
                                    <p>Usuń logo</p>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="right-container">
                    <div className="options-container">
                        <div className="rotation-container">
                            <div className="qr-rotation">
                                <label htmlFor="rotationRange">Obrót: </label>
                                <div className="rotation-div">
                                    <input
                                        type="range"
                                        id="rotationRange"
                                        min="0"
                                        max="360"
                                        value={rotation}
                                        onChange={(e) =>
                                            setRotation(Number(e.target.value))
                                        }
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        max="360"
                                        value={rotation}
                                        onChange={(e) =>
                                            setRotation(Number(e.target.value))
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="qr-container" ref={qrContainerRef}>
                        <canvas ref={canvasRef} />
                    </div>
                    {showSaveButtons && (
                        <div className="save-buttons">
                            <button
                                className="button"
                                onClick={() => downloadQRCode("png")}>
                                <img
                                    className="save-button"
                                    src={buttonImages.png}
                                    alt="download PNG button"
                                />
                            </button>
                            <button
                                className="button"
                                onClick={() => downloadQRCode("svg")}>
                                <img
                                    className="save-button"
                                    src={buttonImages.svg}
                                    alt="Download SVG button"
                                />
                            </button>
                            <button className="button" onClick={copyQRCode}>
                                <img
                                    className="save-button"
                                    src={buttonImages.copy}
                                    alt="copy svg button"
                                />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QRGenerator;
