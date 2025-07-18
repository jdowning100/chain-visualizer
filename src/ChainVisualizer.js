import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import './ChainVisualizer.css';

const MaxBlocksToFetch = 10;

const ChainVisualizer = ({ blockchainData }) => {
  // Extract data from props
  const {
    items,
    wsConnection,
    isConnected,
    connectionStatus,
    tipBlockHeight,
    maxHeightRef,
    fetchingParentsRef,
    missingParentsRef
  } = blockchainData;
  
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const prevMinHeightRef = useRef(null);
  const prevMaxHeightRef = useRef(0);

  // Configuration
  const config = {
    spacing: 120,
    arrowLength: 30,
    colors: {
      block: '#4CAF50',      // Green for zone blocks
      primeBlock: '#F44336', // Red for prime blocks
      regionBlock: '#FFEB3B', // Yellow for region blocks
      uncle: '#FF9800',      // Orange for uncles  
      workshare: '#2196F3',  // Blue for workshares
      arrow: '#888',         // Gray for arrows
      coincident: '#666',    // Gray for coincident lines
      text: '#fff'           // White for text
    },
    sizes: {
      zone: 50,              // Normal zone block size
      region: 75,            // Region block 50% larger
      prime: 100             // Prime block double size
    }
  };







  // D3.js visualization
  useEffect(() => {
    if (!svgRef.current || items.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    const svgNode = svgRef.current;
    const rect = svgNode.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    console.log(`Rendering ${items.length} items, SVG size: ${width}x${height}`);

    // Compute minHeight for normalization
    const minHeight = Math.min(...items.map(item => item.number ?? Infinity));
    const maxBlockSize = Math.max(...Object.values(config.sizes));

    const currentMaxHeight = maxHeightRef.current;
    const addedParent = prevMinHeightRef.current !== null && minHeight < prevMinHeightRef.current;
    const addedNewTip = currentMaxHeight > prevMaxHeightRef.current;

    // Base Y positions for chains
    const typeBaseY = {
      primeBlock: 100,
      regionBlock: 250,
      block: 400, // zone
      uncle: 400 + maxBlockSize + 50,
      workshare: 400 + 2 * (maxBlockSize + 50),
    };

    // Group items by height for stacking calculation
    const heightToItems = d3.group(items, d => d.number);

    // Compute workshare counts per parent
    const workshareCounts = d3.rollup(
      items.filter(i => i.type === 'workshare'),
      v => v.length,
      d => d.fullParentHash
    );

    // Compute max chain size per height
    const heightToMaxChainSize = new Map();
    for (const [height, group] of heightToItems) {
      const chainGroup = group.filter(i => ['block', 'primeBlock', 'regionBlock'].includes(i.type));
      if (chainGroup.length > 0) {
        const maxSize = Math.max(...chainGroup.map(i => {
          let base = config.sizes.zone;
          if (i.type === 'primeBlock') base = config.sizes.prime;
          else if (i.type === 'regionBlock') base = config.sizes.region;
          const count = workshareCounts.get(i.fullHash) || 0;
          return base * (1 + 0.1 * count);
        }));
        heightToMaxChainSize.set(height, maxSize);
      }
    }

    // Compute positionedItems with displayX and displayY
    const positionedItems = items.map(item => {
      let baseSize = config.sizes.zone;
      if (item.type === 'primeBlock') baseSize = config.sizes.prime;
      else if (item.type === 'regionBlock') baseSize = config.sizes.region;
      else baseSize = config.sizes.zone;

      let size = baseSize;
      if (['block', 'primeBlock', 'regionBlock'].includes(item.type)) {
        const count = workshareCounts.get(item.fullHash) || 0;
        size = baseSize * (1 + 0.1 * count);
      }

      let displayX = 0, displayY;

      if (item.number === null) {
        displayX = -size;
        displayY = Math.random() * 400 + 100;
      } else {
        const relativeHeight = item.number - minHeight;
        const baseX = relativeHeight * (maxBlockSize + config.spacing) + 100;

        const sameHeightItems = heightToItems.get(item.number) || [];
        const sameTypeItems = sameHeightItems.filter(i => i.type === item.type);
        const index = sameTypeItems.findIndex(i => i.id === item.id);
        
        const baseY = typeBaseY[item.type] || 200;
        const stackedY = baseY + index * (maxBlockSize + 20);
        displayY = stackedY - size / 2;

        if (['primeBlock', 'regionBlock', 'block'].includes(item.type)) {
          const heightMax = heightToMaxChainSize.get(item.number) || maxBlockSize;
          displayX = baseX + (heightMax - size) / 2;
        } else {
          displayX = baseX; // temporary, will adjust later
        }
      }

      return { ...item, displayX, displayY, size };
    });

    // Adjust displayX for uncles and workshares to center under zone
    positionedItems.forEach(item => {
      if (['uncle', 'workshare'].includes(item.type) && item.number !== null) {
        const zone = positionedItems.find(p => p.number === item.number && p.type === 'block');
        if (zone) {
          item.displayX = zone.displayX + (zone.size - item.size) / 2;
        }
      }
    });

    // Group coincident blocks for vertical lines (same number and fullHash, different types)
    const coincidentGroups = Array.from(d3.group(positionedItems, d => d.number + '-' + d.fullHash).values())
      .filter(group => group.length > 1 && group.every(g => ['primeBlock', 'regionBlock', 'block'].includes(g.type)));

    // Get or create main group for zoom/pan
    let mainGroup = svg.select('.main-group');
    if (mainGroup.empty()) {
      mainGroup = svg.append('g').attr('class', 'main-group');
    }

    // Create zoom if not exists
    if (!zoomRef.current) {
      zoomRef.current = d3.zoom()
        .scaleExtent([0.1, 5])
        .on('zoom', (event) => {
          mainGroup.attr('transform', event.transform);
        });
      svg.call(zoomRef.current);
    }

    // Add defs for arrowhead if not exists
    if (svg.select('defs').empty()) {
      const defs = svg.append('defs');
      defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 5)
        .attr('refY', 0)
        .attr('markerWidth', 4)
        .attr('markerHeight', 4)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', config.colors.arrow);
    }

    // Draw arrows FIRST (so they appear behind blocks)
    const arrowData = positionedItems.filter(item => {
      const parentType = ['primeBlock', 'regionBlock', 'block'].includes(item.type) ? item.type : 'block';
      const parent = positionedItems.find(p => p.fullHash === item.fullParentHash && p.type === parentType);
      return parent && item.fullParentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000';
    });

    const arrows = mainGroup.selectAll('.arrow')
      .data(arrowData, d => d.id);

    arrows.exit().remove();

    const arrowsEnter = arrows.enter()
      .append('line')
      .attr('class', 'arrow')
      .attr('stroke', config.colors.arrow)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)')
      .attr('x1', d => d.displayX)
      .attr('y1', d => d.displayY + d.size / 2)
      .attr('x2', d => {
        const parentType = ['primeBlock', 'regionBlock', 'block'].includes(d.type) ? d.type : 'block';
        const parent = positionedItems.find(p => p.fullHash === d.fullParentHash && p.type === parentType);
        return parent ? parent.displayX + parent.size : d.displayX;
      })
      .attr('y2', d => {
        const parentType = ['primeBlock', 'regionBlock', 'block'].includes(d.type) ? d.type : 'block';
        const parent = positionedItems.find(p => p.fullHash === d.fullParentHash && p.type === parentType);
        return parent ? parent.displayY + parent.size / 2 : d.displayY;
      })
      .style('opacity', 0);

    const arrowsUpdate = arrowsEnter.merge(arrows);

    arrowsUpdate
      .transition('arrow')
      .duration(300)
      .attr('x1', d => d.displayX)
      .attr('y1', d => d.displayY + d.size / 2)
      .attr('x2', d => {
        const parentType = ['primeBlock', 'regionBlock', 'block'].includes(d.type) ? d.type : 'block';
        const parent = positionedItems.find(p => p.fullHash === d.fullParentHash && p.type === parentType);
        return parent ? parent.displayX + parent.size : d.displayX;
      })
      .attr('y2', d => {
        const parentType = ['primeBlock', 'regionBlock', 'block'].includes(d.type) ? d.type : 'block';
        const parent = positionedItems.find(p => p.fullHash === d.fullParentHash && p.type === parentType);
        return parent ? parent.displayY + parent.size / 2 : d.displayY;
      })
      .style('opacity', 0.8);

    // Draw inclusion arrows for uncles and workshares
    const inclusionData = positionedItems.filter(item => item.includedIn && ['uncle', 'workshare'].includes(item.type)).map(item => {
      const includingBlock = positionedItems.find(p => p.fullHash === item.includedIn && p.type === 'block');
      if (includingBlock) {
        return {
          id: 'inclusion-' + item.id,
          x1: includingBlock.displayX + includingBlock.size / 2,
          y1: includingBlock.displayY + includingBlock.size,
          x2: item.displayX + item.size / 2,
          y2: item.displayY
        };
      }
      return null;
    }).filter(d => d !== null);

    const inclusionArrows = mainGroup.selectAll('.inclusion')
      .data(inclusionData, d => d.id);

    inclusionArrows.exit().remove();

    inclusionArrows.enter()
      .append('line')
      .attr('class', 'inclusion')
      .attr('stroke', config.colors.arrow)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)')
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.x2)
      .attr('y2', d => d.y2)
      .style('opacity', 0)
      .merge(inclusionArrows)
      .transition('inclusion')
      .duration(300)
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.x2)
      .attr('y2', d => d.y2)
      .style('opacity', 0.8);

    // Draw vertical coincident lines between blocks
    const coincidentData = [];
    coincidentGroups.forEach(group => {
      const sorted = group.sort((a, b) => typeBaseY[a.type] - typeBaseY[b.type]);
      for (let i = 0; i < sorted.length - 1; i++) {
        const upper = sorted[i];
        const lower = sorted[i + 1];
        coincidentData.push({
          id: 'coincident-' + upper.id + '-to-' + lower.id,
          x: upper.displayX + upper.size / 2,
          y1: upper.displayY + upper.size,
          y2: lower.displayY
        });
      }
    });

    const coincidentLines = mainGroup.selectAll('.coincident')
      .data(coincidentData, d => d.id);

    coincidentLines.exit().remove();

    coincidentLines.enter()
      .append('line')
      .attr('class', 'coincident')
      .attr('stroke', config.colors.coincident)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .merge(coincidentLines)
      .attr('x1', d => d.x)
      .attr('x2', d => d.x)
      .attr('y1', d => d.y1)
      .attr('y2', d => d.y2);

    // Update blocks AFTER arrows and lines
    const blocks = mainGroup.selectAll('.block')
      .data(positionedItems, d => d.id);

    // Remove old blocks
    blocks.exit().remove();

    // Add new blocks
    const blocksEnter = blocks.enter()
      .append('g')
      .attr('class', 'block')
      .attr('transform', d => `translate(${d.displayX}, ${d.displayY})`)
      .style('cursor', 'pointer');

    // Merge enter and update selections
    const blocksUpdate = blocksEnter.merge(blocks);

    // Update positions for all blocks
    blocksUpdate
      .transition('position')
      .duration(300)
      .attr('transform', d => `translate(${d.displayX}, ${d.displayY})`);

    // Add rectangles only to new blocks
    blocksEnter.append('rect')
      .attr('width', d => d.size)
      .attr('height', d => d.size)
      .attr('fill', d => config.colors[d.type])
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('opacity', 0)
      .transition('enter')
      .duration(800)
      .style('opacity', 1);

    // Add hash text only to new blocks
    blocksEnter.append('text')
      .attr('class', 'hash-text')
      .attr('x', d => d.size / 2)
      .attr('y', d => d.size / 2 - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', config.colors.text)
      .attr('font-family', 'monospace')
      .attr('font-size', '10px')
      .text(d => d.hash)
      .style('opacity', 0)
      .transition('enter')
      .delay(400)
      .duration(400)
      .style('opacity', 1);

    // Add block number only to new blocks
    blocksEnter.append('text')
      .attr('class', 'number-text')
      .attr('x', d => d.size / 2)
      .attr('y', d => d.size / 2 + 8)
      .attr('text-anchor', 'middle')
      .attr('fill', config.colors.text)
      .attr('font-family', 'monospace')
      .attr('font-size', '9px')
      .text(d => d.number !== null ? `#${d.number}` : '')
      .style('opacity', 0)
      .transition('enter')
      .delay(400)
      .duration(400)
      .style('opacity', 1);

    // Add type label only to new blocks
    blocksEnter.append('text')
      .attr('class', 'type-text')
      .attr('x', d => d.size / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('fill', config.colors.text)
      .attr('font-family', 'sans-serif')
      .attr('font-size', '8px')
      .text(d => {
        if (d.type === 'primeBlock') return 'PRIME BLOCK';
        if (d.type === 'regionBlock') return 'REGION BLOCK';
        if (d.type === 'block') return 'ZONE BLOCK';
        return d.type.toUpperCase();
      })
      .style('opacity', 0)
      .transition('enter')
      .delay(600)
      .duration(400)
      .style('opacity', 1);

    // Check for size increase and apply shake if needed
    blocksUpdate.each(function(d) {
      const group = d3.select(this);
      const rect = group.select('rect');
      const prevSize = rect.empty() ? 0 : +rect.attr('width');
      if (d.size > prevSize) {
        group.transition('shake')
          .duration(600)
          .attrTween('transform', function() {
            return function(t) {
              const wiggle = Math.sin(t * Math.PI * 8) * 3 * (1 - t);
              return `translate(${d.displayX + wiggle}, ${d.displayY})`;
            };
          })
          .on('end', function() {
            group.attr('transform', `translate(${d.displayX}, ${d.displayY})`);
          });
      }
    });

    // Transition size changes
    const sizeTransition = blocksUpdate.select('rect')
      .transition('size')
      .duration(600)
      .attr('width', d => d.size)
      .attr('height', d => d.size);

    blocksUpdate.select('.hash-text')
      .transition('size')
      .duration(600)
      .attr('x', d => d.size / 2)
      .attr('y', d => d.size / 2 - 5);

    blocksUpdate.select('.number-text')
      .transition('size')
      .duration(600)
      .attr('x', d => d.size / 2)
      .attr('y', d => d.size / 2 + 8);

    blocksUpdate.select('.type-text')
      .transition('size')
      .duration(600)
      .attr('x', d => d.size / 2);

    // Add hover effects only to new blocks
    blocksEnter
      .on('mouseover', function(event, d) {
        d3.select(this).select('rect')
          .transition('hover')
          .duration(200)
          .attr('stroke-width', 3)
          .attr('stroke', '#FFD700');
        
        // Show tooltip
        const tooltip = svg.append('g')
          .attr('class', 'tooltip');
        
        const tooltipRect = tooltip.append('rect')
          .attr('fill', 'rgba(0,0,0,0.8)')
          .attr('stroke', '#fff')
          .attr('rx', 5);
        
        const text = tooltip.append('text')
          .attr('fill', '#fff')
          .attr('font-family', 'monospace')
          .attr('font-size', '12px')
          .attr('x', 10)
          .attr('y', 20);
        
        text.append('tspan').text(`Hash: ${d.fullHash}`);
        text.append('tspan').attr('x', 10).attr('dy', 15).text(`Parent: ${d.fullParentHash || 'None'}`);
        text.append('tspan').attr('x', 10).attr('dy', 15).text(`Number: ${d.number || 'N/A'}`);
        text.append('tspan').attr('x', 10).attr('dy', 15).text(`Type: ${d.type}`);
        
        const bbox = text.node().getBBox();
        tooltipRect.attr('width', bbox.width + 20).attr('height', bbox.height + 20).attr('x', -10).attr('y', -20 + 10);
        
        // Position tooltip above the block, centered
        const tooltipX = d.displayX + d.size / 2 - (bbox.width + 20) / 2;
        const tooltipY = d.displayY - (bbox.height + 20) - 10;
        tooltip.attr('transform', `translate(${tooltipX}, ${tooltipY})`);
      })
      .on('mouseout', function() {
        d3.select(this).select('rect')
          .transition('hover')
          .duration(200)
          .attr('stroke-width', 1)
          .attr('stroke', '#fff');
        
        svg.select('.tooltip').remove();
      });

    // Auto-pan logic
    if (addedParent) {
      const shift = (prevMinHeightRef.current - minHeight) * (maxBlockSize + config.spacing);
      const currentTransform = d3.zoomTransform(svg.node());
      const newTx = currentTransform.x - shift * currentTransform.k;
      const stabilizeTransform = d3.zoomIdentity.translate(newTx, currentTransform.y).scale(currentTransform.k);
      svg.transition().duration(500).call(zoomRef.current.transform, stabilizeTransform);
    }

    if (addedNewTip) {
      let currentTransform = d3.zoomTransform(svg.node());
      const viewWidth = width / currentTransform.k;
      const rightEdge = -currentTransform.x / currentTransform.k + viewWidth;
      const maxX = Math.max(...positionedItems.map(d => d.displayX + d.size)) + 100;
      if (maxX > rightEdge) {
        const panX = -(maxX - viewWidth + 100) * currentTransform.k;
        const newTransform = d3.zoomIdentity.translate(panX, currentTransform.y).scale(currentTransform.k);
        svg.transition().duration(500).call(zoomRef.current.transform, newTransform);
      }
    }

    // Update prev refs
    prevMinHeightRef.current = minHeight;
    prevMaxHeightRef.current = currentMaxHeight;

  }, [items, tipBlockHeight, config]);

  // Legend
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    
    // Remove existing legend
    svg.select('.legend').remove();
    
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', 'translate(20, 20)');

    legend.append('text')
      .attr('fill', '#fff')
      .attr('font-family', 'sans-serif')
      .attr('font-size', '14px')
      .text('Legend:');

    const legendItems = [
      { type: 'primeBlock', color: config.colors.primeBlock, label: 'Prime Block', size: 20 },
      { type: 'regionBlock', color: config.colors.regionBlock, label: 'Region Block', size: 18 },
      { type: 'block', color: config.colors.block, label: 'Zone Block', size: 15 },
      { type: 'uncle', color: config.colors.uncle, label: 'Uncle', size: 15 },
      { type: 'workshare', color: config.colors.workshare, label: 'Workshare', size: 15 }
    ];
    
    const legendGroups = legend.selectAll('.legend-item')
      .data(legendItems)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${30 + i * 30})`);
    
    legendGroups.append('rect')
      .attr('width', d => d.size)
      .attr('height', d => d.size)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff');
    
    legendGroups.append('text')
      .attr('x', 30)
      .attr('y', d => d.size / 2 + 5)
      .attr('fill', '#fff')
      .attr('font-family', 'sans-serif')
      .attr('font-size', '12px')
      .text(d => d.label);

    // Connection status
    svg.select('.status').remove();
    const status = svg.append('g')
      .attr('class', 'status')
      .attr('transform', `translate(${parseInt(svg.style('width'), 10) - 150}, 30)`);
    
    status.append('text')
      .attr('fill', isConnected ? '#4CAF50' : '#F44336')
      .attr('font-family', 'sans-serif')
      .attr('font-size', '12px')
      .attr('text-anchor', 'end');
  }, [isConnected, connectionStatus, config]);

  return (
    <div className="chain-visualizer">
      <svg
        ref={svgRef}
        className="visualizer-svg"
        width="100%"
        height="100%"
      />
    </div>
  );
};

export default ChainVisualizer;