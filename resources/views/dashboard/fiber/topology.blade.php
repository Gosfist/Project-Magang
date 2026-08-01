@extends('layouts.dashboard')
@section('page-title', 'Peta Topologi')
@section('content')
    <div class="space-y-5">
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div class="border-b border-gray-200 px-5 py-4">
                <h2 class="font-semibold">Peta Topologi Main Core UNZANET</h2>
            </div>
            <div class="topology-scroll overflow-x-auto overflow-y-visible p-5">
                @if ($roots->isEmpty())
                    <div class="py-12 text-center text-sm text-gray-400">Belum ada data topologi.</div>
                @else
                    <div id="topologyTree" class="topology-canvas"></div>
                @endif
            </div>
        </div>
    </div>

    <style>
        .topology-canvas {
            display: inline-block;
            min-width: 100%;
            padding: 24px 16px 36px;
            position: relative;
        }

        .topology-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
        }

        .topology-scroll::-webkit-scrollbar {
            display: none;
        }

        .tree-root {
            align-items: flex-start;
            display: flex;
            gap: 72px;
            justify-content: center;
            margin: 0 auto;
        }

        .tree-branch {
            align-items: center;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        .tree-children {
            align-items: flex-start;
            display: flex;
            gap: 34px;
            justify-content: center;
            padding-top: 64px;
            position: relative;
        }

        .tree-node {
            width: 200px;
            border: 1px solid #1e40af;
            border-radius: 8px;
            background: #1e40af;
            overflow: hidden;
            padding: 18px 12px 14px;
            position: relative;
            box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
            text-align: center;
        }

        .tree-node strong {
            display: block;
            color: #ffffff;
            font-size: 15px;
        }

        .tree-node .tree-badge {
            background: #ffffff;
            color: #1e40af;
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            margin: 0;
            padding: 4px 16px;
            position: absolute;
            right: -18px;
            top: 9px;
            transform: rotate(36deg);
            transform-origin: center;
            width: 82px;
        }

        .tree-node span {
            display: block;
            color: #dbeafe;
            font-size: 13px;
            margin-top: 4px;
        }

        .tree-node .tree-meta {
            color: #bfdbfe;
            font-size: 12px;
        }

        .tree-line-layer {
            height: 100%;
            left: 0;
            pointer-events: none;
            position: absolute;
            top: 0;
            width: 100%;
            z-index: 0;
        }

        .tree-line-layer svg {
            display: block;
            overflow: visible;
        }

        .tree-line-layer path {
            fill: none;
            stroke: #ef4444;
            stroke-width: 2;
        }
    </style>

    <script>
        const topologyData = @json($treeData);
        const mount = document.getElementById('topologyTree');

        function renderNode(node) {
            const branch = document.createElement('div');
            branch.className = 'tree-branch';

            const card = document.createElement('div');
            card.className = 'tree-node';
            const meta = [
                node.port ? `Port ${node.port}` : '',
                node.output ? `${node.output} output` : '',
                node.redaman === null ? '' : `${node.redaman} dBm`,
            ].filter(Boolean).join(' Dan ');
            card.innerHTML = `
            <span class="tree-badge">${escapeHtml(node.type)}</span>
            <strong>${escapeHtml(node.name)}</strong>
            <span class="tree-meta">${escapeHtml(meta)}</span>
        `;
            branch.appendChild(card);

            if (node.children.length) {
                const children = document.createElement('div');
                children.className = 'tree-children';
                node.children.forEach((child) => children.appendChild(renderNode(child)));
                branch.appendChild(children);
            }

            return branch;
        }

        function escapeHtml(value) {
            return String(value).replace(/[&<>"']/g, (char) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;',
            } [char]));
        }

        if (mount) {
            const root = document.createElement('div');
            root.className = 'tree-root';
            topologyData.forEach((node) => root.appendChild(renderNode(node)));
            mount.appendChild(root);
            requestAnimationFrame(drawTreeLines);
            window.addEventListener('resize', drawTreeLines);
        }

        function drawTreeLines() {
            if (!mount) return;
            mount.querySelector('.tree-line-layer')?.remove();

            const mountBox = mount.getBoundingClientRect();
            const layer = document.createElement('div');
            layer.className = 'tree-line-layer';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', mount.scrollWidth);
            svg.setAttribute('height', mount.scrollHeight);
            layer.appendChild(svg);
            mount.prepend(layer);

            mount.querySelectorAll('.tree-branch').forEach((branch) => {
                const parentCard = branch.querySelector(':scope > .tree-node');
                const children = branch.querySelector(':scope > .tree-children');

                if (!parentCard || !children) return;

                children.querySelectorAll(':scope > .tree-branch > .tree-node').forEach((childCard) => {
                    const parentBox = parentCard.getBoundingClientRect();
                    const childBox = childCard.getBoundingClientRect();
                    const startX = parentBox.left - mountBox.left + parentBox.width / 2 + mount.scrollLeft;
                    const startY = parentBox.bottom - mountBox.top + mount.scrollTop;
                    const endX = childBox.left - mountBox.left + childBox.width / 2 + mount.scrollLeft;
                    const endY = childBox.top - mountBox.top + mount.scrollTop;
                    const midY = startY + Math.max(28, (endY - startY) / 2);
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`);
                    svg.appendChild(path);
                });
            });
        }
    </script>
@endsection
