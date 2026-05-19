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

export function extractBookingTokenFromQr(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const tokenFromBRoute = parts[0] === 'b' ? parts[1] : null;
    const tokenFromApiRoute =
      parts[0] === 'api' && parts[1] === 'checkin' ? parts[2] : null;
    const token =
      tokenFromBRoute ?? tokenFromApiRoute ?? url.searchParams.get('token');
    return token && token.length >= 32 ? token : null;
  } catch {
    return trimmed.length >= 32 ? trimmed : null;
  }
}
