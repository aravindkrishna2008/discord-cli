import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { renderImageFromUrl, placeholderFor } from "../image/render.js";
import { resolveProtocolForInk, type RenderProtocol } from "../image/protocol.js";
import type { Attachment } from "../store/types.js";
import type { ImageProtocol } from "../config/config.js";
import { toFixedHeightBlock, toFixedHeightPlainTextBlock } from "./image-block.js";

interface Props {
  a: Attachment;
  protocolChoice: ImageProtocol;
  contentWidth: number;
  maxHeight: number;
}

export function ImageView({ a, protocolChoice, contentWidth, maxHeight }: Props) {
  const [rendered, setRendered] = useState<string | null>(null);
  const protocol: RenderProtocol = resolveProtocolForInk(protocolChoice, process.env);
  const isImage = a.contentType?.startsWith("image/") ?? false;
  const blockHeight = Math.max(1, maxHeight);
  useEffect(() => {
    setRendered(null);
    if (!isImage || protocol === "none" || maxHeight < 2) return;
    let alive = true;
    renderImageFromUrl(a.url, {
      protocol,
      maxWidth: contentWidth,
      maxHeight,
    }).then((r) => {
      if (alive) setRendered(r);
    });
    return () => {
      alive = false;
    };
  }, [a.url, contentWidth, isImage, maxHeight, protocol]);
  if (!isImage) return <Text color="gray">  {placeholderFor(a.name, a.size)}</Text>;
  if (!rendered) {
    return (
      <Text color="gray">
        {toFixedHeightPlainTextBlock(`  ${placeholderFor(a.name, a.size)}`, contentWidth, blockHeight)}
      </Text>
    );
  }
  return <Text>{toFixedHeightBlock(rendered, blockHeight)}</Text>;
}
