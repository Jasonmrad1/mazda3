import type { SVGProps } from "react";
import emblem from "../../public/mazda-emblem.svg?raw";

/** Mazda trademark, reproduced from the Simple Icons Mazda asset. */
export function MazdaIcon({
  size = 24,
  strokeWidth: _strokeWidth,
  ...props
}: SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number | string;
}) {
  const path = emblem.match(/<path d="([^"]+)"/)?.[1];
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
