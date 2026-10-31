'use client';

import { useState } from 'react';

/** The wordmark stands alone until public/logo.png exists. */
export function Logo({ size = 34 }: { size?: number }) {
  const [hasImage, setHasImage] = useState(true);
  return (
    <span className="flex items-center gap-2">
      {hasImage && (
        // oxlint-disable-next-line nextjs/no-img-element -- must survive a missing file
        <img
          src="/logo.png"
          alt=""
          width={size}
          height={size}
          onError={() => setHasImage(false)}
        />
      )}
      <span className="text-lg font-extrabold text-ink">
        Reach<span className="text-primary-text">In</span>
      </span>
    </span>
  );
}
