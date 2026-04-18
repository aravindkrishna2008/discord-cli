import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { renderImageFromUrl, placeholderFor } from "../image/render.js";
import { resolveProtocol, type RenderProtocol } from "../image/protocol.js";
import type { Attachment } from "../store/types.js";
import type { ImageProtocol } from "../config/config.js";

interface Props {
  a: Attachment;
  protocolChoice: ImageProtocol;
}

export function ImageView({ a, protocolChoice }: Props) {
  const [rendered, setRendered] = useState<string | null>(null);
  const protocol: RenderProtocol = resolveProtocol(protocolChoice, process.env);
  const isImage = a.contentType?.startsWith("image/") ?? false;
  useEffect(() => {
    if (!isImage || protocol === "none") return;
    let alive = true;
    renderImageFromUrl(a.url, { protocol }).then((r) => {
      if (alive) setRendered(r);
    });
    return () => {
      alive = false;
    };
  }, [a.url, isImage, protocol]);
  if (!isImage) return <Text color="gray">  {placeholderFor(a.name, a.size)}</Text>;
  if (!rendered) return <Text color="gray">  {placeholderFor(a.name, a.size)}</Text>;
  return <Text>{rendered}</Text>;
}
