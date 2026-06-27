/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { markdownToHtml } from './markdown';

// ---------------------------------------------------------------------------
// PortalTooltip — renders a markdown tooltip into document.body so it
// escapes the React Flow viewport's CSS transform stacking context.
//
// Usage:
//   const [show, setShow] = useState(false);
//   const triggerRef = useRef<HTMLDivElement>(null);
//   <div ref={triggerRef} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>…</div>
//   <PortalTooltip text="..." triggerRef={triggerRef} visible={show} direction="down" />
// ---------------------------------------------------------------------------

interface Props {
	text: string;
	triggerRef: React.RefObject<HTMLDivElement | null>;
	visible: boolean;
	direction?: 'up' | 'down';
}

export function PortalTooltip({ text, triggerRef, visible, direction = 'up' }: Props) {
	const tooltipRef = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

	useLayoutEffect(() => {
		if (visible && triggerRef.current) {
			const r = triggerRef.current.getBoundingClientRect();
			const top = direction === 'up' ? r.top - 8 : r.bottom + 6;
			setPos({ top: Math.max(0, top), left: r.left, width: r.width });
		}
	}, [visible, triggerRef, direction]);

	if (!visible || !text) { return null; }

	return createPortal(
		<div
			ref={tooltipRef}
			className="portal-tooltip"
			style={{ top: pos.top, left: pos.left, maxWidth: Math.max(pos.width, 380) }}
		>
			<div
				className="portal-tooltip-content"
				dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }}
			/>
		</div>,
		document.body,
	);
}

