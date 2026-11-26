'use client';

import type { RxTemplateFields } from '@/data/default-config';
import { DEFAULT_RX_TEMPLATE_FIELDS } from '@/data/default-config';

export interface RxPdfMedicationLine {
  medicineName: string;
  genericName?: string;
  dispensedQuantity?: number | string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface RxPdfDocumentPayload {
  clinicName?: string;
  branchName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  footerText?: string;
  patientName: string;
  patientDisplayId?: string;
  patientAge?: number | string;
  patientGender?: string;
  patientPhone?: string;
  bloodGroup?: string | null;
  visitDate: string;
  slotTime?: string;
  tokenNumber?: string;
  doctorName: string;
  doctorSpecialization?: string;
  clinicalNotes?: string;
  nextVisitDate?: string;
  medications: RxPdfMedicationLine[];
}

export interface CustomRxPdfRenderOptions {
  payload: RxPdfDocumentPayload;
  templateUrl?: string;
  printBg?: boolean;
  fields?: RxTemplateFields;
}

function sanitizePdfText(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00D7/g, 'x')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfLiteral(text: string): string {
  return sanitizePdfText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapTextLines(text: string, maxChars: number): string[] {
  const clean = sanitizePdfText(text);
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Builds a valid single-page A4 vector PDF (595.28 x 841.89 pt) using Helvetica fonts.
 */
export function buildPrescriptionPdfBytes(payload: RxPdfDocumentPayload): Uint8Array {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 48;
  const contentWidth = pageWidth - marginX * 2;

  const ops: string[] = [];

  const drawText = (
    x: number,
    y: number,
    text: string,
    options?: { font?: 'F1' | 'F2'; size?: number; color?: [number, number, number] }
  ) => {
    const font = options?.font || 'F1';
    const size = options?.size || 10;
    const [r, g, b] = options?.color || [0.09, 0.1, 0.12];
    ops.push(
      `BT /${font} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfLiteral(text)}) Tj ET`
    );
  };

  const drawRightText = (
    rightX: number,
    y: number,
    text: string,
    options?: { font?: 'F1' | 'F2'; size?: number; color?: [number, number, number] }
  ) => {
    const size = options?.size || 10;
    const clean = sanitizePdfText(text);
    const estWidth = clean.length * size * 0.51;
    drawText(Math.max(marginX, rightX - estWidth), y, clean, options);
  };

  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width = 0.75,
    color: [number, number, number] = [0.85, 0.87, 0.91]
  ) => {
    ops.push(
      `${width.toFixed(2)} w ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`
    );
  };

  const drawRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor: [number, number, number],
    strokeColor?: [number, number, number]
  ) => {
    ops.push(
      `${fillColor[0].toFixed(3)} ${fillColor[1].toFixed(3)} ${fillColor[2].toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${strokeColor ? 'B' : 'f'}`
    );
    if (strokeColor) {
      ops.push(
        `0.75 w ${strokeColor[0].toFixed(3)} ${strokeColor[1].toFixed(3)} ${strokeColor[2].toFixed(3)} RG ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`
      );
    }
  };

  drawRect(0, pageHeight - 10, pageWidth, 10, [0.145, 0.388, 0.922]);

  let y = pageHeight - 46;
  const clinicTitle = sanitizePdfText(payload.clinicName || 'HealthSync Clinic');
  drawText(marginX, y, clinicTitle, { font: 'F2', size: 18, color: [0.086, 0.098, 0.118] });

  const dateStr = sanitizePdfText(payload.visitDate || '');
  drawRightText(pageWidth - marginX, y + 2, dateStr, { font: 'F2', size: 11, color: [0.086, 0.098, 0.118] });

  y -= 16;
  const branchLine = [payload.branchName, payload.clinicAddress, payload.clinicPhone].filter(Boolean).join(' - ');
  if (branchLine) {
    drawText(marginX, y, branchLine, { font: 'F1', size: 9.5, color: [0.37, 0.39, 0.44] });
  }
  if (payload.tokenNumber && payload.tokenNumber !== '--') {
    drawRightText(pageWidth - marginX, y, `Token: ${payload.tokenNumber}`, {
      font: 'F2',
      size: 10,
      color: [0.145, 0.388, 0.922],
    });
  }

  y -= 14;
  drawLine(marginX, y, pageWidth - marginX, y, 1.4, [0.086, 0.098, 0.118]);

  y -= 18;
  const docLine = [
    payload.doctorName || 'Consultant Physician',
    payload.doctorSpecialization || 'General Medicine',
  ]
    .filter(Boolean)
    .join(' - ');
  drawText(marginX, y, docLine, { font: 'F2', size: 10.5, color: [0.145, 0.388, 0.922] });
  if (payload.slotTime) {
    drawRightText(pageWidth - marginX, y, `Slot: ${payload.slotTime}`, {
      font: 'F1',
      size: 9.5,
      color: [0.37, 0.39, 0.44],
    });
  }

  y -= 66;
  drawRect(marginX, y, contentWidth, 54, [0.973, 0.976, 0.984], [0.91, 0.925, 0.945]);

  const patientTopY = y + 34;
  const patientBottomY = y + 14;
  const idLabel = payload.patientDisplayId ? ` (P${sanitizePdfText(payload.patientDisplayId).replace(/^P/i, '')})` : '';
  drawText(marginX + 12, patientTopY, `Patient: ${payload.patientName}${idLabel}`, {
    font: 'F2',
    size: 11,
    color: [0.086, 0.098, 0.118],
  });

  if (payload.bloodGroup) {
    drawRightText(pageWidth - marginX - 12, patientTopY, `Blood Group: ${payload.bloodGroup}`, {
      font: 'F2',
      size: 9.5,
      color: [0.75, 0.12, 0.25],
    });
  }

  const demoParts = [
    payload.patientAge ? `${payload.patientAge} Yrs` : '',
    payload.patientGender || '',
    payload.patientPhone ? `Ph: ${payload.patientPhone}` : '',
  ].filter(Boolean);
  drawText(marginX + 12, patientBottomY, demoParts.join('  |  ') || 'Outpatient Visit Record', {
    font: 'F1',
    size: 9.5,
    color: [0.37, 0.39, 0.44],
  });

  y -= 26;
  drawText(marginX, y, 'CLINICAL DIAGNOSTICS & NOTES', {
    font: 'F2',
    size: 9.5,
    color: [0.35, 0.38, 0.45],
  });
  y -= 6;
  drawLine(marginX, y, pageWidth - marginX, y, 0.8, [0.85, 0.87, 0.91]);

  const notesLines = wrapTextLines(payload.clinicalNotes || 'Routine consultation', 88).slice(0, 6);
  y -= 16;
  for (const line of notesLines) {
    drawText(marginX, y, line, { font: 'F1', size: 10, color: [0.22, 0.25, 0.31] });
    y -= 14;
  }

  y -= 14;
  drawText(marginX, y, 'PRESCRIPTION (Rx)', {
    font: 'F2',
    size: 10.5,
    color: [0.086, 0.098, 0.118],
  });
  y -= 10;

  drawRect(marginX, y - 16, contentWidth, 22, [0.945, 0.957, 0.98]);
  drawText(marginX + 10, y - 9, '#', { font: 'F2', size: 9, color: [0.28, 0.33, 0.42] });
  drawText(marginX + 34, y - 9, 'MEDICINE NAME', { font: 'F2', size: 9, color: [0.28, 0.33, 0.42] });
  drawText(marginX + 275, y - 9, 'DOSAGE / INSTRUCTIONS', { font: 'F2', size: 9, color: [0.28, 0.33, 0.42] });
  drawRightText(pageWidth - marginX - 10, y - 9, 'QTY', { font: 'F2', size: 9, color: [0.28, 0.33, 0.42] });

  y -= 32;

  const meds = payload.medications || [];
  if (meds.length === 0) {
    drawText(marginX + 10, y, 'No prescribed medications recorded for this visit.', {
      font: 'F1',
      size: 10,
      color: [0.54, 0.56, 0.61],
    });
    y -= 24;
  } else {
    for (let i = 0; i < Math.min(meds.length, 16); i++) {
      const m = meds[i];
      if (y < 145) break;

      const medName = sanitizePdfText(m.medicineName || 'Prescribed Medicine').slice(0, 40);
      const sigParts = [m.dosage, m.frequency, m.duration, m.instructions].filter(Boolean).join(' - ');
      const sigText = sanitizePdfText(sigParts || 'As directed by physician').slice(0, 42);
      const qtyText = m.dispensedQuantity !== undefined && m.dispensedQuantity !== null ? String(m.dispensedQuantity) : '1';

      drawText(marginX + 10, y, `${i + 1}.`, { font: 'F2', size: 10, color: [0.09, 0.1, 0.12] });
      drawText(marginX + 34, y, medName, { font: 'F2', size: 10, color: [0.09, 0.1, 0.12] });
      drawText(marginX + 275, y, sigText, { font: 'F1', size: 9.5, color: [0.145, 0.388, 0.922] });
      drawRightText(pageWidth - marginX - 10, y, qtyText, { font: 'F2', size: 10, color: [0.09, 0.1, 0.12] });

      y -= 10;
      drawLine(marginX, y, pageWidth - marginX, y, 0.5, [0.92, 0.93, 0.95]);
      y -= 16;
    }
  }

  if (payload.nextVisitDate && y > 135) {
    y -= 10;
    drawRect(marginX, y - 20, contentWidth, 28, [0.937, 0.965, 1], [0.75, 0.85, 0.99]);
    drawText(marginX + 12, y - 9, 'Next Review / Follow-Up Scheduled:', {
      font: 'F2',
      size: 9.5,
      color: [0.11, 0.25, 0.69],
    });
    drawRightText(pageWidth - marginX - 12, y - 9, payload.nextVisitDate, {
      font: 'F2',
      size: 10,
      color: [0.11, 0.25, 0.69],
    });
  }

  const sigY = 86;
  drawLine(pageWidth - marginX - 180, sigY + 18, pageWidth - marginX, sigY + 18, 0.9, [0.6, 0.63, 0.68]);
  drawRightText(pageWidth - marginX, sigY + 4, payload.doctorName || 'Consultant Physician', {
    font: 'F2',
    size: 10.5,
    color: [0.09, 0.1, 0.12],
  });
  drawRightText(pageWidth - marginX, sigY - 9, 'Authorized Medical Practitioner', {
    font: 'F1',
    size: 8.5,
    color: [0.45, 0.48, 0.54],
  });

  drawLine(marginX, 52, pageWidth - marginX, 52, 0.6, [0.9, 0.91, 0.94]);
  const footer = sanitizePdfText(
    payload.footerText || `Generated digitally by HealthSync CLMS - ${payload.clinicName || 'Clinic Record'}`
  );
  drawText(marginX, 38, footer, { font: 'F1', size: 8, color: [0.54, 0.56, 0.61] });

  const streamContent = ops.join('\n');
  const encoder = new TextEncoder();
  const streamByteLen = encoder.encode(streamContent).length;

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${streamByteLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  const header = '%PDF-1.4\n';
  let body = header;
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(encoder.encode(body).length);
    body += obj;
  }

  const xrefStart = encoder.encode(body).length;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return encoder.encode(body + xref + trailer);
}

/**
 * Wraps a JPEG byte buffer inside a crisp single-page A4 %PDF-1.4 document.
 */
function buildJpegPagePdfBytes(jpegBytes: Uint8Array, widthPx: number, heightPx: number): Uint8Array {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const encoder = new TextEncoder();

  const contentStream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentLen = encoder.encode(contentStream).length;

  const chunks: Uint8Array[] = [];
  let cursor = 0;
  const offsets: number[] = [0];

  const pushStr = (s: string) => {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    cursor += bytes.length;
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  offsets.push(cursor);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets.push(cursor);
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets.push(cursor);
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  offsets.push(cursor);
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  chunks.push(jpegBytes);
  cursor += jpegBytes.length;
  pushStr('\nendstream\nendobj\n');

  offsets.push(cursor);
  pushStr(`5 0 obj\n<< /Length ${contentLen} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefStart = cursor;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pushStr(xref);
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const out = new Uint8Array(cursor);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number
): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidthPx || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Generates an A4 PDF reflecting the clinic's calibrated custom prescription pad if active,
 * falling back cleanly to the clean vector A4 Rx PDF when no custom template image is usable.
 */
export async function generatePrescriptionPdfBytes(
  options: CustomRxPdfRenderOptions
): Promise<Uint8Array> {
  const { payload, templateUrl, printBg = true, fields = DEFAULT_RX_TEMPLATE_FIELDS } = options;

  if (!templateUrl || typeof document === 'undefined') {
    return buildPrescriptionPdfBytes(payload);
  }

  try {
    const canvasW = 1240;
    const canvasH = 1754;
    // Modal preview container is max-w-xl (576px wide) so scale font sizes consistently
    const scale = canvasW / 576;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return buildPrescriptionPdfBytes(payload);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (printBg) {
      const bgImg = await loadImageElement(templateUrl);
      ctx.drawImage(bgImg, 0, 0, canvasW, canvasH);
    }

    const drawField = (
      coord: RxTemplateFields[keyof RxTemplateFields] | undefined,
      text: string,
      opts?: { multiline?: boolean; maxLines?: number }
    ) => {
      if (!coord || coord.visible === false || !text) return;
      const fontSizePx = Math.round((coord.fontSize || 12) * scale);
      const weight =
        coord.fontWeight === 'bold'
          ? '700'
          : coord.fontWeight === 'semibold'
            ? '600'
            : coord.fontWeight === 'medium'
              ? '500'
              : '400';
      ctx.font = `${weight} ${fontSizePx}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
      ctx.fillStyle = coord.color || '#16191E';
      ctx.textBaseline = 'top';

      const boxX = (coord.x / 100) * canvasW;
      const boxY = (coord.y / 100) * canvasH;
      const boxW = ((coord.width || 40) / 100) * canvasW;
      const align = coord.align || 'left';
      ctx.textAlign = align;

      const anchorX =
        align === 'center' ? boxX + boxW / 2 : align === 'right' ? boxX + (coord.width ? boxW : 0) : boxX;

      if (opts?.multiline) {
        const rawParagraphs = text.split(/\r?\n/);
        let lineY = boxY;
        const lineHeight = fontSizePx * 1.45;
        let drawn = 0;
        for (const para of rawParagraphs) {
          const wrapped = wrapCanvasText(ctx, para, boxW);
          for (const line of wrapped) {
            if (opts.maxLines && drawn >= opts.maxLines) return;
            ctx.fillText(line, anchorX, lineY);
            lineY += lineHeight;
            drawn++;
          }
        }
      } else {
        ctx.fillText(text, anchorX, boxY);
      }
    };

    drawField(fields.patientName, payload.patientName);
    if (payload.patientAge) {
      drawField(fields.patientAge, `${payload.patientAge} Yrs`);
    }
    if (payload.patientGender) {
      const gLabel =
        payload.patientGender === 'Male'
          ? 'Male [ ✓ ]'
          : payload.patientGender === 'Female'
            ? 'Female [ ✓ ]'
            : payload.patientGender;
      drawField(fields.patientGender, gLabel);
    }
    if (payload.patientPhone) {
      drawField(fields.patientPhone, payload.patientPhone);
    }
    if (payload.tokenNumber && payload.tokenNumber !== '--') {
      drawField(fields.tokenNumber, `Token: ${payload.tokenNumber}`);
    }
    if (payload.clinicalNotes) {
      drawField(fields.diagnostics, payload.clinicalNotes, { multiline: true, maxLines: 5 });
    }

    // Medications block
    if (fields.medications?.visible !== false) {
      const mc = fields.medications;
      const medX = (mc.x / 100) * canvasW;
      let medY = (mc.y / 100) * canvasH;
      const medW = ((mc.width || 72) / 100) * canvasW;
      const baseSize = Math.round((mc.fontSize || 12) * scale);
      ctx.textBaseline = 'top';

      const meds = payload.medications || [];
      if (meds.length === 0) {
        ctx.font = `italic ${baseSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        ctx.fillStyle = '#6B7280';
        ctx.textAlign = 'left';
        ctx.fillText('No medication prescribed during this visit.', medX, medY);
      } else {
        for (let idx = 0; idx < meds.length; idx++) {
          const m = meds[idx];
          if (medY > canvasH * 0.78) break;

          ctx.font = `700 ${baseSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
          ctx.fillStyle = '#16191E';
          ctx.textAlign = 'left';
          const title = `${idx + 1}. ${m.medicineName}${m.genericName ? ` (${m.genericName.toUpperCase()})` : ''}`;
          ctx.fillText(title, medX, medY, medW * 0.78);

          ctx.textAlign = 'right';
          ctx.fillText(`Qty: ${m.dispensedQuantity ?? 1}`, medX + medW, medY);
          medY += baseSize * 1.35;

          const sig = [m.dosage, m.frequency, m.duration].filter(Boolean).join(' • ').replace(/^\+\s*/, '');
          if (sig) {
            ctx.font = `600 ${Math.round(baseSize * 0.9)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
            ctx.fillStyle = '#2563EB';
            ctx.textAlign = 'left';
            ctx.fillText(`Sig: ${sig}`, medX + 18, medY, medW - 18);
            medY += baseSize * 1.2;
          }
          if (m.instructions) {
            ctx.font = `italic ${Math.round(baseSize * 0.85)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
            ctx.fillStyle = '#555555';
            ctx.textAlign = 'left';
            ctx.fillText(m.instructions, medX + 18, medY, medW - 18);
            medY += baseSize * 1.15;
          }
          medY += baseSize * 0.45;
        }
      }

      if (payload.nextVisitDate && medY < canvasH * 0.79) {
        ctx.font = `600 ${Math.round(baseSize * 0.9)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        ctx.fillStyle = '#047857';
        ctx.textAlign = 'left';
        ctx.fillText(`Follow-up Visit: ${payload.nextVisitDate}`, medX, medY + 6);
      }
    }

    drawField(fields.consultationDate, payload.visitDate);
    drawField(fields.doctorName, payload.doctorName);
    drawField(fields.doctorSignature, payload.doctorName);

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = jpegDataUrl.split(',')[1];
    if (!base64) return buildPrescriptionPdfBytes(payload);

    const binary = atob(base64);
    const jpegBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      jpegBytes[i] = binary.charCodeAt(i);
    }
    return buildJpegPagePdfBytes(jpegBytes, canvasW, canvasH);
  } catch (err) {
    console.warn('Custom template canvas PDF fallback to vector PDF:', err);
    return buildPrescriptionPdfBytes(payload);
  }
}

export function triggerPdfDownload(bytes: Uint8Array, payload: RxPdfDocumentPayload, fileName?: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const safePatient = sanitizePdfText(payload.patientName || 'Patient').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const safeDate = sanitizePdfText(payload.visitDate || 'Rx').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const safeToken = payload.tokenNumber && payload.tokenNumber !== '--' ? `_${sanitizePdfText(payload.tokenNumber)}` : '';
  const downloadName = fileName || `Rx_${safePatient}${safeToken}_${safeDate}.pdf`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadCustomPrescriptionPdf(
  options: CustomRxPdfRenderOptions,
  fileName?: string
): Promise<void> {
  const bytes = await generatePrescriptionPdfBytes(options);
  triggerPdfDownload(bytes, options.payload, fileName);
}

export function downloadPrescriptionPdf(payload: RxPdfDocumentPayload, fileName?: string): void {
  const bytes = buildPrescriptionPdfBytes(payload);
  triggerPdfDownload(bytes, payload, fileName);
}
