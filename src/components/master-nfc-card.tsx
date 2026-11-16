import { QRCodeSVG } from "qrcode.react";
import defaultArtwork from "@/assets/master-nfc.png";

/** Keep the uploaded pixels intact; replace only the QR and printed ID slots. */
export function MasterNfcCard({
  code,
  url,
  artwork = defaultArtwork,
  alt = "Google Review NFC card",
  qrClassName,
  idClassName,
  cardClassName,
}: {
  code: string;
  url: string;
  artwork?: string;
  alt?: string;
  qrClassName?: string;
  idClassName?: string;
  cardClassName?: string;
}) {
  return (
    <div className={`master-nfc-card ${cardClassName ?? ""}`}>
      <img
        className="master-nfc-artwork"
        src={artwork}
        alt={alt}
        draggable={false}
      />
      <div className={qrClassName || "master-nfc-qr"}>
        <QRCodeSVG value={url} size={232} marginSize={4} level="M" />
      </div>
      <div
        className={
          idClassName ||
          `master-nfc-id${code.length > 10 ? " master-nfc-id-long" : ""}`
        }
      >
        {code}
      </div>
    </div>
  );
}
