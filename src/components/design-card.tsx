import { QRCodeSVG } from "qrcode.react";
import googleArtwork from "@/assets/google-card.png";
import instagramArtwork from "@/assets/instagram-card.png";
import type { CardDesign } from "@/lib/card-designs";

export function DesignCard({
  design,
  code,
  url,
}: {
  design: CardDesign;
  code: string;
  url: string;
}) {
  if (design === "instagram") {
    return (
      <div className="card-design-canvas instagram-card-container">
        <img
          className="master-nfc-artwork card-artwork-img"
          src={instagramArtwork}
          alt="Instagram NFC Card"
          draggable={false}
        />
        <div className="master-nfc-qr instagram-qr-slot">
          <QRCodeSVG value={url} size={232} marginSize={4} level="M" />
        </div>
        <div className="master-nfc-id instagram-id-slot">
          {code}
        </div>
      </div>
    );
  }

  // Google Review Card Design
  return (
    <div className="card-design-canvas google-card-container">
      <img
        className="master-nfc-artwork card-artwork-img"
        src={googleArtwork}
        alt="Google Review NFC Card"
        draggable={false}
      />
      <div className="master-nfc-qr google-qr-slot">
        <QRCodeSVG value={url} size={232} marginSize={4} level="M" />
      </div>
      <div className="master-nfc-id google-id-slot">
        {code}
      </div>
    </div>
  );
}
