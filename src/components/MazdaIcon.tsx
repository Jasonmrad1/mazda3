import type { ImgHTMLAttributes } from "react";
import emblem from "../assets/mazda-emblem-clean.png";

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
      src={emblem}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      decoding="async"
    />
  );
}
