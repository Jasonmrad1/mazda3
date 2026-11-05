import type { ImgHTMLAttributes } from "react";
/** Mazda's winged emblem, supplied as a transparent image asset. */
export function MazdaIcon({
  size = 24,
  alt = "",
  strokeWidth: _strokeWidth,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "width" | "height"> & {
  size?: number | string;
  strokeWidth?: number | string;
}) {
  return (
    <img
      {...props}
      src="/mazdaLogo.png"
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      decoding="async"
    />
  );
}
