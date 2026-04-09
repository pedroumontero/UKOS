"use client";

import * as React from "react";

import { QRCodeSVG as QRCodeSVGVendor } from "@/lib/qrcode-react-vendor";

type Props = {
  value: string;
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  marginSize?: number;
  className?: string;
};

/** Wrapper tipado sobre el bundle vendeado de `qrcode.react` (generación local, sin servicios externos). */
export function InventoryQrCode(props: Props) {
  const Q = QRCodeSVGVendor as React.ComponentType<Props>;
  return <Q {...props} />;
}
