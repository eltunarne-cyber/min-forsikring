// Bildekomprimering i nettleseren før lagring (maks 1600 px, JPEG ~0,8).

const MAX_SIDE = 1600;
const QUALITY = 0.8;

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kunne ikke lese bildet')); };
    img.src = url;
  });
}

// Gir en JPEG-Blob. Bildet roteres riktig (nettleseren følger EXIF-retningen).
export async function compressImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; // gjennomsiktige PNG-er får hvit bakgrunn i JPEG
  g.fillRect(0, 0, w, h);
  g.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Kunne ikke komprimere bildet');
  // Behold originalen hvis den allerede er mindre (f.eks. et lite skjermbilde).
  return file.type === 'image/jpeg' && file.size <= blob.size && scale === 1 ? file : blob;
}

export const isImage = (file) => /^image\//.test(file.type) || /\.(jpe?g|png|heic|heif|gif|webp)$/i.test(file.name || '');
export const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
