import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import './ChainVisualizer.css';

const MaxBlocksToFetch = 10;
const MissingParents = new Map();

const ChainVisualizer = () => {
  const svgRef = useRef(null);
  const [items, setItems] = useState([]);
  const [wsConnection, setWsConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [tipBlockHeight, setTipBlockHeight] = useState(0);
  const maxHeightRef = useRef(0);
  const fetchingParentsRef = useRef(new Set());
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
      text: '#fff'           // White for text
    },
    sizes: {
      zone: 50,              // Normal zone block size
      region: 75,            // Region block 50% larger
      prime: 100             // Prime block double size
    }
  };

  // Add new item (block, uncle, or workshare)
  const addItem = useCallback((type, hash, parentHash, number = null, order = null) => {
    const shortHash = hash.slice(0, 8);
    
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.fullHash === hash);
      if (existingItem) {
        console.log(`Duplicate ${type} detected, skipping: ${shortHash}`);
        return prevItems;
      }
      
      let decimalNumber = null;
      if (number) {
        decimalNumber = parseInt(number, 16);
      }
      
      // Determine block type based on order
      let blockType = type;
      if (type === 'block' && order !== null) {
        const orderNum = typeof order === 'string' ? parseInt(order, 16) : order;
        if (orderNum === 0) {
          blockType = 'primeBlock';
        } else if (orderNum === 1) {
          blockType = 'regionBlock'; 
        } else {
          blockType = 'block';
        }
      }
      
      const newItem = {
        id: `${blockType}-${shortHash}-${Date.now()}`,
        type: blockType,
        hash: shortHash,
        fullHash: hash,
        parentHash: parentHash ? parentHash.slice(0, 8) : null,
        fullParentHash: parentHash,
        number: decimalNumber,
        order: order,
        timestamp: Date.now()
      };

      console.log(`Added ${blockType}: ${shortHash} -> ${newItem.fullParentHash} (${decimalNumber})`);
      
      if (decimalNumber !== null && decimalNumber > maxHeightRef.current) {
        maxHeightRef.current = decimalNumber;
      }
      
      return [...prevItems, newItem].sort((a, b) => (a.number || 0) - (b.number || 0));
    });
  }, []);

  // Fetch block by hash from the blockchain node
  const fetchBlockByHash = useCallback((hash) => {
    return new Promise((resolve, reject) => {
      if (!wsConnection || !isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = Date.now() + Math.random();
      
      const handleMessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id === requestId) {
            wsConnection.removeEventListener('message', handleMessage);
            if (data.error) {
              reject(new Error(data.error.message || 'Failed to fetch block'));
            } else {
              resolve(data.result);
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      wsConnection.addEventListener('message', handleMessage);

      wsConnection.send(JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method: 'quai_getBlockByHash',
        params: [hash, false]
      }));

      setTimeout(() => {
        wsConnection.removeEventListener('message', handleMessage);
        reject(new Error('Request timeout'));
      }, 10000);
    });
  }, [wsConnection, isConnected]);

  // Fetch and add missing parent block
  const fetchMissingParent = useCallback(async (parentHash) => {
    if (fetchingParentsRef.current.has(parentHash)) {
      return;
    }

    const existingParent = items.find(item => item.fullHash === parentHash);
    if (existingParent) {
      return;
    }

    try {
      fetchingParentsRef.current.add(parentHash);
      console.log(`Fetching parent ${parentHash}`);
      
      const blockData = await fetchBlockByHash(parentHash);
      if (blockData && blockData.woHeader) {
        const hash = blockData.hash;
        const parentHash = blockData.woHeader.parentHash;
        const number = blockData.woHeader.number;
        const order = blockData.order;
        addItem('block', hash, parentHash, number, order);
      }
    } catch (error) {
      console.error(`Failed to fetch parent ${parentHash}:`, error);
    } finally {
      fetchingParentsRef.current.delete(parentHash);
    }
  }, [fetchBlockByHash, addItem, items]);

  // Poll for latest block
  const pollLatestBlock = useCallback(async () => {
    if (!wsConnection || !isConnected) return;
    
    try {
      const response = await fetch('http://24.243.151.245/cyprus1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'quai_getBlockByNumber',
          params: ['latest', true]
        })
      });
      
      const data = await response.json();
      if (data.result && data.result.hash && data.result.woHeader) {
        const hash = data.result.hash;
        const parentHash = data.result.woHeader.parentHash;
        const number = data.result.woHeader.number;
        const order = data.result.order;
        
        console.log('✅ Polled latest block:', hash, 'parent:', parentHash, 'number:', number, 'order:', order);
        setTipBlockHeight(parseInt(number, 16));
        addItem('block', hash, parentHash, number, order);
        
        if (data.result.uncles && data.result.uncles.length > 0) {
          console.log('Found uncles:', data.result.uncles.length);
          data.result.uncles.forEach((uncle, index) => {
            console.log(`Uncle ${index}:`, uncle);
            if (uncle.headerHash && uncle.parentHash) {
              addItem('uncle', uncle.headerHash, uncle.parentHash, uncle.number);
            }
          });
        }
        
        if (data.result.workshares && data.result.workshares.length > 0) {
          console.log('Found workshares in block:', data.result.workshares.length);
          data.result.workshares.forEach((workshare, index) => {
            console.log(`Workshare ${index}:`, workshare);
            if (workshare.headerHash && workshare.parentHash) {
              addItem('workshare', workshare.headerHash, workshare.parentHash, workshare.number);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error polling latest block:', error);
    }
  }, [wsConnection, isConnected, addItem]);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('ws://24.243.151.245/ws/cyprus1');
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          setConnectionStatus('Connected');
          setWsConnection(ws);

          pollLatestBlock();

          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'quai_subscribe',
            params: ['newWorkshares']
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);            
            if (data.method === 'quai_subscription') {
              const result = data.params.result;
              
              if (result.hash && result.parentHash && result.number && result.type === 'workshare') {
                console.log('Found workshare:', result.hash, 'parent:', result.parentHash, 'number:', result.number);
                addItem('workshare', result.hash, result.parentHash, result.number);
              }
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          setConnectionStatus('Disconnected');
          setWsConnection(null);
          setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('Error');
        };

      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        setConnectionStatus('Error');
        setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [addItem]);

  // Set up polling interval
  useEffect(() => {
    if (!isConnected) return;
    
    pollLatestBlock();
    const interval = setInterval(pollLatestBlock, 1000);
    
    return () => clearInterval(interval);
  }, [isConnected, pollLatestBlock]);

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

    // Base Y positions by type
    const typeBaseY = {
      block: 200,
      primeBlock: 200,
      regionBlock: 200,
      uncle: 200 + maxBlockSize + 50,
      workshare: 200 + 2 * (maxBlockSize + 50),
    };

    // Group items by height for stacking calculation
    const heightToItems = d3.group(items, d => d.number);

    // Compute workshare counts per parent
    const workshareCounts = d3.rollup(
      items.filter(i => i.type === 'workshare'),
      v => v.length,
      d => d.fullParentHash
    );

    // Compute positionedItems with displayX and displayY
    const positionedItems = items.map(item => {
      let baseSize = config.sizes.zone;
      if (item.type === 'primeBlock') baseSize = config.sizes.prime;
      else if (item.type === 'regionBlock') baseSize = config.sizes.region;
      else baseSize = config.sizes.zone;

      let size = baseSize;
      if (['block', 'primeBlock', 'regionBlock'].includes(item.type)) {
        const count = workshareCounts.get(item.fullHash) || 0;
        size = baseSize * (1 + 0.2 * count);
      }

      let displayX, displayY;

      if (item.number === null) {
        displayX = -size;
        displayY = Math.random() * 400 + 100;
      } else {
        const relativeHeight = item.number - minHeight;
        displayX = relativeHeight * (maxBlockSize + config.spacing) + 100;

        const sameHeightItems = heightToItems.get(item.number) || [];
        // Group blocks (zone/region/prime) as same "type" for stacking
        const sameTypeItems = sameHeightItems.filter(i => 
          i.type === item.type || 
          (['block', 'primeBlock', 'regionBlock'].includes(i.type) && ['block', 'primeBlock', 'regionBlock'].includes(item.type))
        );
        // Find index for stacking (assumes items are in add order)
        const index = sameTypeItems.findIndex(i => i.id === item.id);
        
        const baseY = typeBaseY[item.type] || 200;
        const stackedY = baseY + index * (maxBlockSize + 20);
        displayY = stackedY - size / 2;
      }

      return { ...item, displayX, displayY, size };
    });

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
      const parent = positionedItems.find(p => p.fullHash === item.fullParentHash);
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
      .attr('x1', d => {
        const parent = positionedItems.find(p => p.fullHash === d.fullParentHash);
        return parent ? parent.displayX + parent.size : d.displayX;
      })
      .attr('y1', d => {
        const parent = positionedItems.find(p => p.fullHash === d.fullParentHash);
        return parent ? parent.displayY + parent.size / 2 : d.displayY;
      })
      .attr('x2', d => d.displayX)
      .attr('y2', d => d.displayY + d.size / 2)
      .style('opacity', 0);

    const arrowsUpdate = arrowsEnter.merge(arrows);

    arrowsUpdate
      .transition('arrow')
      .duration(300)
      .attr('x1', d => {
        const parent = positionedItems.find(p => p.fullHash === d.fullParentHash);
        return parent ? parent.displayX + parent.size : d.displayX;
      })
      .attr('y1', d => {
        const parent = positionedItems.find(p => p.fullHash === d.fullParentHash);
        return parent ? parent.displayY + parent.size / 2 : d.displayY;
      })
      .attr('x2', d => d.displayX)
      .attr('y2', d => d.displayY + d.size / 2)
      .style('opacity', 0.8);

    // Update blocks AFTER arrows (so they appear on top)
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
      .attr('fill', d => d.type === 'regionBlock' ? '#000' : config.colors.text)
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
      .attr('fill', d => d.type === 'regionBlock' ? '#000' : config.colors.text)
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
      .attr('fill', d => d.type === 'regionBlock' ? '#000' : config.colors.text)
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

    // Check for size increase and apply rotation shake if needed
    blocksUpdate.each(function(d) {
      const group = d3.select(this);
      const rect = group.select('rect');
      const prevSize = rect.empty() ? 0 : +rect.attr('width');
      if (d.size > prevSize) {
        // Stop any existing transitions first
        group.interrupt();
        
        // Apply rotation shake animation - wiggling left and right
        group.transition('shake')
          .duration(1500)
          .attrTween('transform', function() {
            return function(t) {
              const frequency = 15; // Number of oscillations
              const maxAngle = 8; // Maximum rotation angle in degrees
              const decay = 1 - t; // Decay over time
              
              // Oscillating rotation angle
              const angle = Math.sin(t * Math.PI * frequency) * maxAngle * decay;
              
              return `translate(${d.displayX}, ${d.displayY}) rotate(${angle}, ${d.size / 2}, ${d.size / 2})`;
            };
          })
          .on('end', function() {
            // Ensure final position and rotation are exact
            group.attr('transform', `translate(${d.displayX}, ${d.displayY})`);
          });
        
        // Add a brief flash effect to make it even more noticeable
        group.select('rect')
          .transition('flash')
          .duration(200)
          .attr('stroke', '#FFD700')
          .attr('stroke-width', 4)
          .transition('flash-back')
          .duration(300)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);
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
          .attr('class', 'tooltip')
          .attr('transform', `translate(${d.displayX + d.size + 10}, ${d.displayY})`);
        
        const rect = tooltip.append('rect')
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
        rect.attr('width', bbox.width + 20).attr('height', bbox.height + 20);
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

    // Handle missing parents
    items.forEach(item => {
      if (item.fullParentHash && 
          item.fullParentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && 
          item.number > tipBlockHeight - MaxBlocksToFetch) {
        const parent = items.find(p => p.fullHash === item.fullParentHash);
        if (!parent && !MissingParents.has(item.fullParentHash)) {
          MissingParents.set(item.fullParentHash, item.fullHash);
          fetchMissingParent(item.fullParentHash);
        }
      }
    });

    // Update prev refs
    prevMinHeightRef.current = minHeight;
    prevMaxHeightRef.current = currentMaxHeight;

  }, [items, fetchMissingParent, tipBlockHeight, config]);

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
      .attr('text-anchor', 'end')
      .text(`Status: ${connectionStatus}`);

  }, [isConnected, connectionStatus, config]);

  return (
    <div className="chain-visualizer">
      <div className="visualizer-controls">
        <div className="status-info">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢' : '🔴'}
          </span>
          <span>{connectionStatus}</span>
          {!isConnected && <span className="demo-note"> (Demo Mode)</span>}
        </div>
        <div className="item-count">
          Items: {items.length}
        </div>
      </div>
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