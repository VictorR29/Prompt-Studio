
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });
};

const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const imgRatio = img.width / img.height;
    const canvasRatio = w / h;
    let sx, sy, sw, sh;

    if (imgRatio > canvasRatio) { // Image is wider than canvas area
        sw = img.height * canvasRatio;
        sh = img.height;
        sx = (img.width - sw) / 2;
        sy = 0;
    } else { // Image is taller or same ratio
        sw = img.width;
        sh = img.width / canvasRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
};

export const createImageCollage = async (images: { base64: string; mimeType: string }[]): Promise<string> => {
    if (!images || images.length === 0) {
        return '';
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const canvasSize = 512;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    ctx.fillStyle = '#111827'; // a dark background similar to the app
    ctx.fillRect(0, 0, canvasSize, canvasSize);


    const imageSources = images.slice(0, 4).map(img => `data:${img.mimeType};base64,${img.base64}`);
    const loadedImages = await Promise.all(imageSources.map(loadImage));

    switch (loadedImages.length) {
        case 1:
            drawImageCover(ctx, loadedImages[0], 0, 0, canvasSize, canvasSize);
            break;
        case 2:
            drawImageCover(ctx, loadedImages[0], 0, 0, canvasSize / 2, canvasSize);
            drawImageCover(ctx, loadedImages[1], canvasSize / 2, 0, canvasSize / 2, canvasSize);
            break;
        case 3:
            drawImageCover(ctx, loadedImages[0], 0, 0, canvasSize / 2, canvasSize);
            drawImageCover(ctx, loadedImages[1], canvasSize / 2, 0, canvasSize / 2, canvasSize / 2);
            drawImageCover(ctx, loadedImages[2], canvasSize / 2, canvasSize / 2, canvasSize / 2, canvasSize / 2);
            break;
        case 4:
        default:
            drawImageCover(ctx, loadedImages[0], 0, 0, canvasSize / 2, canvasSize / 2);
            drawImageCover(ctx, loadedImages[1], canvasSize / 2, 0, canvasSize / 2, canvasSize / 2);
            drawImageCover(ctx, loadedImages[2], 0, canvasSize / 2, canvasSize / 2, canvasSize / 2);
            drawImageCover(ctx, loadedImages[3], canvasSize / 2, canvasSize / 2, canvasSize / 2, canvasSize / 2);
            break;
    }

    return canvas.toDataURL('image/jpeg', 0.8);
};

export const resizeImageFile = (file: File, maxWidth = 1024): Promise<{ base64: string; mimeType: string; url: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions
            if (width > maxWidth || height > maxWidth) {
                const ratio = width / height;
                if (width > height) {
                    width = maxWidth;
                    height = maxWidth / ratio;
                } else {
                    height = maxWidth;
                    width = maxWidth * ratio;
                }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                 reject(new Error("Canvas context not available"));
                 return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to base64
            const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const base64Url = canvas.toDataURL(mimeType, 0.85); // 0.85 quality for jpeg
            const base64 = base64Url.split(',')[1];
            
            resolve({
                base64,
                mimeType,
                url // Keep original URL reference
            });
        };
        img.onerror = reject;
        img.src = url;
    });
};
