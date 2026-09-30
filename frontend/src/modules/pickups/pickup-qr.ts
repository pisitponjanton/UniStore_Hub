import QRCode from "qrcode";

type QrEncoder = (
  text: string,
  options?: QRCode.QRCodeToDataURLOptions,
) => Promise<string>;

export async function createPickupQrDataUrl(
  token: string,
  encoder: QrEncoder = QRCode.toDataURL,
): Promise<string> {
  return encoder(token, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
  });
}
