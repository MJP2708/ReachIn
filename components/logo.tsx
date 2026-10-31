'use client';

import { useEffect, useRef, useState } from 'react';

/** The wordmark stands alone until public/logo.png exists. */
export function Logo({ size = 34 }: { size?: number }) {
  const [hasImage, setHasImage] = useState(true);
  const image = useRef<HTMLImageElement>(null);

  // A server-rendered image can fail before React attaches onError.
  useEffect(() => {
    const element = image.current;
    if (element?.complete && element.naturalWidth === 0) {
      const timer = setTimeout(() => setHasImage(false), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <span className="flex items-center gap-2">
      {hasImage && (
        // oxlint-disable-next-line nextjs/no-img-element -- must survive a missing file
        <img
          ref={image}
          src="/logo.png"
          alt=""
          width={size}
          height={size}
          onError={() => setHasImage(false)}
          className="mix-blend-multiply"
        />
      )}
      <span className="text-lg font-extrabold text-ink">
        Reach<span className="text-primary-text">In</span>
      </span>
    </span>
  );
}
