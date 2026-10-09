import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Preload all images within a container element to guarantee no blank or broken
 * image captures occur during canvas conversion.
 */
export async function preloadAllImages(containerElement) {
  if (!containerElement) return;
  const images = Array.from(containerElement.querySelectorAll('img'));

  const promises = images.map(img => {
    if (img.complete && img.naturalHeight !== 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, 3500);

      img.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timer);
        // Fallback: hide broken image so layout remains intact
        img.style.display = 'none';
        resolve();
      };
    });
  });

  await Promise.all(promises);
}

/**
 * Converts rendered magazine pages into a high-fidelity, multi-page A4 PDF document.
 * 
 * Flow:
 * 1. Locates all .magazine-pdf-page elements inside the container.
 * 2. Preloads and waits for all images to settle.
 * 3. Uses html2canvas (scale: 2) for crystal-clear text and graphic rasterization.
 * 4. Inserts each page sequentially into an A4 portrait jsPDF document (210mm x 297mm).
 * 5. Triggers direct file download.
 */
export async function generateMagazinePDF({
  containerElement,
  magazineTitle = 'Reflection',
  issueNumber = '32',
  onProgress,
}) {
  if (!containerElement) {
    throw new Error('Magazine preview container not found.');
  }

  onProgress?.('Preparing magazine pages and loading images...');
  await preloadAllImages(containerElement);

  // Short pause to ensure all reflows and fonts are painted
  await new Promise(r => setTimeout(r, 250));

  const pageElements = Array.from(containerElement.querySelectorAll('.magazine-pdf-page'));
  if (pageElements.length === 0) {
    throw new Error('No magazine pages found to render.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pdfWidth = 210;
  const pdfHeight = 297;

  for (let i = 0; i < pageElements.length; i++) {
    const pageEl = pageElements[i];
    onProgress?.(`Rendering page ${i + 1} of ${pageElements.length}...`);

    // Temporarily ensure element is visible for canvas painting
    const canvas = await html2canvas(pageEl, {
      scale: 2, // High resolution
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    if (typeof window !== 'undefined' && window.__ENABLE_PDF_DEBUG) {
      window.__pdfCanvasImages = window.__pdfCanvasImages || [];
      window.__pdfCanvasImages.push({ page: i + 1, data: imgData });
    }

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  }

  onProgress?.('Saving PDF file...');
  const safeTitle = (magazineTitle || 'Reflection').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeTitle}_Issue_${issueNumber || '32'}.pdf`;
  pdf.save(filename);

  return filename;
}
