"use client";

import { useEffect, useState } from "react";

/**
 * A div of our own inside the editor's container, for overlays drawn over
 * the page (block handles, comment counts). Rendering straight into the
 * container breaks on leaving the page: Tiptap moves the container's
 * children elsewhere as the editor unmounts, and React can no longer find
 * its nodes to remove them. Inside this div they move along with it.
 * (Being inside the container also keeps a dragged block's id: see
 * block-handle.tsx.) Only mount this once the editor exists (client only).
 */
export function useOverlayRoot(host: HTMLElement | null): HTMLElement | null {
  const [root] = useState(() => {
    const el = document.createElement("div");
    el.dataset.editorOverlay = "";
    return el;
  });
  useEffect(() => {
    if (!host) return;
    host.appendChild(root);
    return () => root.remove();
  }, [host, root]);
  return host ? root : null;
}
