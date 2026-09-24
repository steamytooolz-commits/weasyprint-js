// PDF fonts — mirrors weasyprint/text/fonts.py standard-font selection
// for the pdf-lib backend. Custom font embedding / subsetting guidance lives here.
import { standardPdfFont } from '../text/fonts.js';

export interface EmbeddedFont {
  family: string;
  bold: boolean;
  italic: boolean;
  data?: Uint8Array;
}

export const STANDARD_FONTS: string[] = [
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
  'Times-Roman',
  'Times-Bold',
  'Times-Italic',
  'Times-BoldItalic',
  'Courier',
  'Courier-Bold',
  'Courier-Oblique',
  'Courier-BoldOblique',
  'Symbol',
  'ZapfDingbats',
];

export function pickStandardFont(family: string, bold: boolean, italic: boolean): string {
  return standardPdfFont(family, bold, italic);
}

export function subsetNote(): string {
  return (
    'Full font subsetting is not built in: embed custom fonts with ' +
    'PDFDocument.embedFont() and use fontkit (npm i fontkit) for subsetting. ' +
    'Register the fontkit instance for pdf-lib so embedded custom fonts can be ' +
    'subset before saving; the 14 standard PDF fonts need no embedding.'
  );
}
