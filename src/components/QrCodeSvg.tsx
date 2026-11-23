import React from 'react';
import type { StudentRecord } from '../data/pasData';
import type { QrPayloadFormat } from '../types/prepress';
import { formatStudentQrPayload, getQrSymbolData } from '../utils/qrGenerator';

interface QrCodeSvgProps {
  student?: StudentRecord;
  payloadOverride?: string;
  format?: QrPayloadFormat;
  mejaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({
  student,
  payloadOverride,
  format = 'full_no',
  mejaLabel,
  className,
  style,
}) => {
  const payload =
    payloadOverride ??
    (student ? formatStudentQrPayload(student, format, mejaLabel) : '2026/SMAN 1 ALALAK/001');
  const sym = getQrSymbolData(payload);

  return (
    <svg
      viewBox={`0 0 ${sym.viewBoxSize} ${sym.viewBoxSize}`}
      shapeRendering="crispEdges"
      className={className}
      style={{
        display: 'block',
        backgroundColor: '#FFFFFF',
        ...style,
      }}
      aria-label={`QR Code ${payload}`}
    >
      <rect x="0" y="0" width={sym.viewBoxSize} height={sym.viewBoxSize} fill="#FFFFFF" />
      <path d={sym.pathData} fill="#000000" />
    </svg>
  );
};
