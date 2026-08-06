import QRCode from 'qrcode';
export async function generateBookingQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0A0A0A',
      light: '#FFFFFF',
    },
  });
}
