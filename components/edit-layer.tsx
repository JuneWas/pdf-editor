'use client';
import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Text, Rect, Image as KonvaImage, Transformer } from 'react-konva';
import Konva from 'konva';
import type { PageViewport } from 'pdfjs-dist';
import type { EditObject } from '@/lib/edit-state';

function Bitmap({ src, ...props }: Omit<React.ComponentProps<typeof KonvaImage>, 'image'> & { src: string }) {
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => { const img = new window.Image(); let active = true; img.onload = () => { if (active) setImage(img); }; img.src = src; return () => { active = false; }; }, [src]);
  return <KonvaImage {...props} image={image} />;
}
export default function EditLayer({ viewport, scale, objects, selected, onSelect, onChange, tool, onAdd }: {
  viewport: PageViewport; scale: number; objects: EditObject[]; selected: string | null;
  onSelect: (id: string | null) => void; onChange: (objects: EditObject[]) => void;
  tool: 'select' | 'text' | 'highlight'; onAdd: (x: number, y: number) => void;
}) {
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const factor = Math.hypot(viewport.transform[0], viewport.transform[1]);
  useEffect(() => {
    const node = stage.current?.findOne(`#${selected}`);
    transformer.current?.nodes(node ? [node] : []);
  }, [selected, objects]);
  const update = (item: EditObject, node: Konva.Node, resize = false) => {
    const [x, y] = viewport.convertToPdfPoint(node.x(), node.y());
    const next = { ...item, x, y, ...(resize ? { width: Math.max(8, item.width * node.scaleX()), height: Math.max(8, item.height * node.scaleY()) } : {}) };
    node.scaleX(1); node.scaleY(1);
    onChange(objects.map(object => object.id === item.id ? next : object));
  };
  return <div className="edit-overlay" aria-label="PDF編集キャンバス"><Stage ref={stage} width={viewport.width * scale} height={viewport.height * scale} scaleX={scale} scaleY={scale} onMouseDown={event => {
    if (event.target !== event.target.getStage()) return;
    const point = event.target.getStage()?.getPointerPosition();
    if (tool !== 'select' && point) { const [x, y] = viewport.convertToPdfPoint(point.x / scale, point.y / scale); onAdd(x, y); }
    else onSelect(null);
  }}><Layer>{objects.map(item => {
    const [x, y] = viewport.convertToViewportPoint(item.x, item.y);
    const props = { id: item.id, x, y, width: item.width * factor, height: item.height * factor, draggable: tool === 'select', onClick: () => onSelect(item.id), onTap: () => onSelect(item.id), onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => update(item, event.target), onTransformEnd: (event: Konva.KonvaEventObject<Event>) => update(item, event.target, true) };
    if (item.kind === 'text') return <Text key={item.id} {...props} text={item.text} fontSize={item.fontSize * factor} fill={item.color} fontFamily="sans-serif" />;
    if (item.kind === 'image') return <Bitmap key={item.id} {...props} src={item.src!} />;
    return <Rect key={item.id} {...props} fill={item.color} opacity={item.opacity} />;
  })}<Transformer ref={transformer} rotateEnabled={false} flipEnabled={false} resizeEnabled={objects.find(item => item.id === selected)?.kind !== 'text'} keepRatio={objects.find(item => item.id === selected)?.kind === 'image'} boundBoxFunc={(oldBox, box) => box.width < 8 || box.height < 8 ? oldBox : box} /></Layer></Stage></div>;
}
