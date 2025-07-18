import { useState, useCallback, useRef, useEffect } from 'react';

const MaxBlocksToFetch = 10;
const MaxItemsToKeep = 500; // Keep only the most recent 300 items for performance

export const useBlockchainData2x2 = (isEnabled = false) => {
  const [items, setItems] = useState([]);
  const [wsConnections, setWsConnections] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [tipBlockHeight, setTipBlockHeight] = useState(0);
  const maxHeightRef = useRef(0);
  const fetchingParentsRef = useRef(new Set());
  const missingParentsRef = useRef(new Map());

  // 2x2 hierarchy network configuration
  const networkConfig = {
    prime: {
      ws: 'ws://demo.rpc.quai.network:8001',
      http: 'http://demo.rpc.quai.network:9001',
      name: 'Prime'
    },
    regions: [
      {
        ws: 'ws://demo.rpc.quai.network:8002',
        http: 'http://demo.rpc.quai.network:9002',
        name: 'Region-0'
      },
      {
        ws: 'ws://demo.rpc.quai.network:8003',
        http: 'http://demo.rpc.quai.network:9003',
        name: 'Region-1'
      }
    ],
    zones: [
      // Region 1 zones
      {
        ws: 'ws://demo.rpc.quai.network:8200',
        http: 'http://demo.rpc.quai.network:9200',
        name: 'Zone-0-0',
        region: 0
      },
      {
        ws: 'ws://demo.rpc.quai.network:8201',
        http: 'http://demo.rpc.quai.network:9201',
        name: 'Zone-0-1',
        region: 0
      },
      // Region 2 zones
      {
        ws: 'ws://demo.rpc.quai.network:8220',
        http: 'http://demo.rpc.quai.network:9220',
        name: 'Zone-1-0',
        region: 1
      },
      {
        ws: 'ws://demo.rpc.quai.network:8221',
        http: 'http://demo.rpc.quai.network:9221',
        name: 'Zone-1-1',
        region: 1
      }
    ]
  };

  // Cleanup function to keep only the most recent items
  const cleanupOldItems = useCallback((itemsList) => {
    if (itemsList.length <= MaxItemsToKeep) {
      return itemsList;
    }
    
    // Sort by number (block height) and timestamp, keep only the most recent
    const sortedItems = itemsList.sort((a, b) => {
      // First sort by block number (higher numbers are newer)
      const numDiff = (b.number || 0) - (a.number || 0);
      if (numDiff !== 0) return numDiff;
      // Then sort by timestamp (more recent first)
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
    
    const keptItems = sortedItems.slice(0, MaxItemsToKeep);
      
    return keptItems;
  }, []);

  // Add new item (block, uncle, or workshare) - with proper hierarchy
  const addItem = useCallback((type, hash, parentHash, number = null, order = null, headerParentHashes = null, includingHash = null, chainName = null) => {
    const shortHash = hash.slice(0, 8);
    
    setItems(prevItems => {
      if (type !== 'block') {
        let decimalNumber = null;
        if (number) {
          decimalNumber = parseInt(number, 16);
        }
        
        const existingIndex = prevItems.findIndex(item => item.fullHash === hash && item.type === type);
        if (existingIndex !== -1) {
          if (includingHash) {
            // Update existing with includedIn
            const updatedItem = { ...prevItems[existingIndex], includedIn: includingHash };
            const newItems = [...prevItems];
            newItems[existingIndex] = updatedItem;
            return newItems;
          } else {
            return prevItems;
          }
        }
        
        const newItem = {
          id: `${type}-${shortHash}-${Date.now()}`,
          type: type,
          hash: shortHash,
          fullHash: hash,
          parentHash: parentHash ? parentHash.slice(0, 8) : null,
          fullParentHash: parentHash,
          number: decimalNumber,
          order: order,
          timestamp: Date.now(),
          includedIn: includingHash || null,
          chainName: chainName
        };

        console.log(`Added ${type}: ${shortHash} -> ${newItem.fullParentHash} (${decimalNumber}) on ${chainName} includedIn: ${newItem.includedIn}`);
        
        if (decimalNumber !== null && decimalNumber > maxHeightRef.current) {
          maxHeightRef.current = decimalNumber;
        }
        
        const updatedItems = [...prevItems, newItem].sort((a, b) => (a.number || 0) - (b.number || 0));
        
        // Check for missing parent and fetch it (one level only)
        if (newItem.fullParentHash && 
            newItem.fullParentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
            !missingParentsRef.current.has(newItem.fullParentHash) && 
            !fetchingParentsRef.current.has(newItem.fullParentHash)) {
          
          // Check if parent exists in current items
          const parentExists = updatedItems.some(item => 
            item.fullHash === newItem.fullParentHash && item.type === newItem.type
          );
          
          if (!parentExists) {
            console.log(`🔍 Missing parent detected for ${type} ${shortHash}, fetching: ${newItem.fullParentHash.slice(0, 8)}`);
            missingParentsRef.current.set(newItem.fullParentHash, true);
            fetchMissingParent(newItem.fullParentHash, chainName);
          }
        }
        
        return cleanupOldItems(updatedItems);
      } else {
        // For 'block' type, create multiple representations based on order and chain type
        let decimalNumber = parseInt(number, 16);
        const orderNum = parseInt(order, 16);
        const newItems = [];
        
        console.log(`🏗️ Creating block representations for ${chainName}: hash=${shortHash}, order=${orderNum}, headerParents=${JSON.stringify(headerParentHashes)}`);

        let idCounter = 0;
        const addRepresentation = (blockType, parent) => {
          const existing = prevItems.find(item => item.fullHash === hash && item.type === blockType);
          if (existing) {
            return;
          }
          
          const timestamp = Date.now();
          const item = {
            id: `${blockType}-${shortHash}-${timestamp}-${idCounter++}`,
            type: blockType,
            hash: shortHash,
            fullHash: hash,
            parentHash: parent ? parent.slice(0, 8) : null,
            fullParentHash: parent,
            number: decimalNumber,
            order: order,
            timestamp: timestamp,
            chainName: chainName
          };

          newItems.push(item);
          console.log(`➕ Added ${blockType}: ${shortHash} on ${chainName}`);
        };

        // For 2x2 demo, create representations based on chain name instead of order
        if (chainName === 'Prime') {
          // Prime chain: add all three representations
          addRepresentation('primeBlock', headerParentHashes?.[0] || parentHash);
          addRepresentation('regionBlock', headerParentHashes?.[1] || parentHash);
          addRepresentation('block', parentHash);
        } else if (chainName && chainName.startsWith('Region')) {
          // Region chains: add region and zone representations
          addRepresentation('regionBlock', headerParentHashes?.[1] || headerParentHashes?.[0] || parentHash);
          addRepresentation('block', parentHash);
        } else {
          // Zone chains: add zone representation only
          addRepresentation('block', parentHash);
        }
        
        // Fallback for nodes without chain name - use original order logic
        if (newItems.length === 0) {
          if (orderNum === 0) {
            // Prime: add prime, region, zone
            addRepresentation('primeBlock', headerParentHashes?.[0] || parentHash);
            addRepresentation('regionBlock', headerParentHashes?.[1] || parentHash);
            addRepresentation('block', parentHash);
          } else if (orderNum === 1) {
            // Region: add region, zone
            addRepresentation('regionBlock', headerParentHashes?.[1] || headerParentHashes?.[0] || parentHash);
            addRepresentation('block', parentHash);
          } else {
            // Zone: add zone
            addRepresentation('block', parentHash);
          }
        }

        if (newItems.length === 0) return prevItems;

        if (decimalNumber > maxHeightRef.current) {
          maxHeightRef.current = decimalNumber;
        }

        const updatedItems = [...prevItems, ...newItems].sort((a, b) => (a.number || 0) - (b.number || 0));
        
        // Check for missing parents for each new block representation (one level only)
        newItems.forEach(newItem => {
          if (newItem.fullParentHash && 
              newItem.fullParentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
              !missingParentsRef.current.has(newItem.fullParentHash) && 
              !fetchingParentsRef.current.has(newItem.fullParentHash)) {
            
            // Check if parent exists in current items
            const parentExists = updatedItems.some(item => 
              item.fullHash === newItem.fullParentHash && item.type === newItem.type
            );
            
            if (!parentExists) {
              console.log(`🔍 Missing parent detected for ${newItem.type} ${shortHash}, fetching: ${newItem.fullParentHash.slice(0, 8)}`);
              missingParentsRef.current.set(newItem.fullParentHash, true);
              fetchMissingParent(newItem.fullParentHash, chainName);
            }
          }
        });
        
        return cleanupOldItems(updatedItems);
      }
    });
  }, [cleanupOldItems]);

  // Fetch missing parent block via HTTP
  const fetchMissingParent = useCallback(async (parentHash, chainName) => {
    if (fetchingParentsRef.current.has(parentHash)) {
      return;
    }

    try {
      fetchingParentsRef.current.add(parentHash);
      console.log(`🔍 Fetching missing parent ${parentHash.slice(0, 8)} via HTTP from ${chainName}`);
      
      // Find the appropriate HTTP URL based on chain name
      let httpUrl = networkConfig.prime.http; // Default fallback
      
      if (chainName && chainName.startsWith('Region')) {
        const regionIndex = parseInt(chainName.split('-')[1]);
        httpUrl = networkConfig.regions[regionIndex]?.http || networkConfig.prime.http;
      } else if (chainName && chainName.startsWith('Zone')) {
        const zoneIndex = networkConfig.zones.findIndex(zone => zone.name === chainName);
        httpUrl = networkConfig.zones[zoneIndex]?.http || networkConfig.prime.http;
      }
      
      const response = await fetch(httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'quai_getBlockByHash',
          params: [parentHash, false]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Failed to fetch block');
      }

      const blockData = data.result;
      if (blockData && blockData.woHeader) {
        const hash = blockData.hash;
        const zoneParent = blockData.woHeader.parentHash;
        const number = blockData.woHeader.number;
        const order = blockData.order;
        const headerParentHashes = blockData.header ? blockData.header.parentHash : [];
        
        // Mark this parent's parent as already processed to prevent recursive fetching
        if (zoneParent && zoneParent !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          missingParentsRef.current.set(zoneParent, true);
        }
        if (headerParentHashes && headerParentHashes[0] && headerParentHashes[0] !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          missingParentsRef.current.set(headerParentHashes[0], true);
        }
        if (headerParentHashes && headerParentHashes[1] && headerParentHashes[1] !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          missingParentsRef.current.set(headerParentHashes[1], true);
        }
        
        addItem('block', hash, zoneParent, number, order, headerParentHashes, null, chainName);
      }
    } catch (error) {
      console.error(`❌ Failed to fetch parent ${parentHash.slice(0, 8)} via HTTP from ${chainName}:`, error);
    } finally {
      fetchingParentsRef.current.delete(parentHash);
    }
  }, [addItem]);

  // Poll for latest block from a specific chain
  const pollLatestBlock = useCallback(async (chainConfig, chainName) => {
    console.log(`🔄 Polling ${chainName} at ${chainConfig.http}`);
    try {
      const response = await fetch(chainConfig.http, {
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
      console.log(`📊 Received data from ${chainName}:`, data.result ? 'Block found' : 'No result', data.error ? `Error: ${data.error.message}` : '');
      
      if (data.result && data.result.hash && data.result.woHeader) {
        const hash = data.result.hash;
        const zoneParent = data.result.woHeader.parentHash;
        const number = data.result.woHeader.number;
        const order = data.result.order;
        const headerParentHashes = data.result.header ? data.result.header.parentHash : [];
        setTipBlockHeight(parseInt(number, 16));
        addItem('block', hash, zoneParent, number, order, headerParentHashes, null, chainName);
        
        if (data.result.uncles && data.result.uncles.length > 0) {
          data.result.uncles.forEach((uncle, index) => {
            if (uncle.hash && uncle.parentHash) {
              addItem('uncle', uncle.hash, uncle.parentHash, uncle.number, null, null, hash, chainName);
            }
          });
        }
        
        if (data.result.workshares && data.result.workshares.length > 0) {
          data.result.workshares.forEach((workshare, index) => {
            if (workshare.hash && workshare.parentHash) {
              addItem('workshare', workshare.hash, workshare.parentHash, workshare.number, null, null, hash, chainName);
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error polling latest block from ${chainName}:`, error);
    }
  }, [addItem]);

  // WebSocket connection management for all chains
  useEffect(() => {
    if (!isEnabled) {
      console.log('🔴 2x2 visualization disabled, skipping connections');
      return;
    }

    console.log('🚀 Starting 2x2 WebSocket connections');
    const connections = {};
    let connectedCount = 0;
    
    const connectWebSocket = (config, chainName) => {
      try {
        console.log(`🔗 Connecting to ${chainName}: ${config.ws}`);
        const ws = new WebSocket(config.ws);
        
        ws.onopen = () => {
          console.log(`✅ ${chainName} WebSocket connected to ${config.ws}`);
          connectedCount++;
          connections[chainName] = ws;
          
          // Update connection status when all chains are connected
          const totalChains = 1 + networkConfig.regions.length + networkConfig.zones.length; // 1 prime + regions + zones
          if (connectedCount >= totalChains) {
            setIsConnected(true);
            setConnectionStatus('Connected');
            setWsConnections(connections);
            
            console.log('🔄 Starting initial polls for all chains');
            // Initial polls for all chains
            setTimeout(() => {
              pollLatestBlock(networkConfig.prime, 'Prime');
              networkConfig.regions.forEach((region, idx) => {
                pollLatestBlock(region, `Region-${idx}`);
              });
              networkConfig.zones.forEach((zone) => {
                pollLatestBlock(zone, zone.name);
              });
            }, 100);
          }

          // Subscribe to workshares for each chain
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
                const parsedNumber = parseInt(result.number, 16);
                addItem('workshare', result.hash, result.parentHash, result.number, null, null, null, chainName);
              }
            }
          } catch (error) {
            console.error(`Error parsing WebSocket message from ${chainName}:`, error);
          }
        };

        ws.onclose = () => {
          console.log(`WebSocket disconnected: ${chainName}`);
          connectedCount--;
          delete connections[chainName];
          
          if (connectedCount === 0) {
            setIsConnected(false);
            setConnectionStatus('Disconnected');
            setWsConnections({});
          }
          
          // Reconnect after delay
          setTimeout(() => connectWebSocket(config, chainName), 5000);
        };

        ws.onerror = (error) => {
          console.error(`❌ WebSocket error ${chainName} (${config.ws}):`, error);
          setConnectionStatus('Error');
        };

      } catch (error) {
        console.error(`Failed to connect to WebSocket ${chainName}:`, error);
        setConnectionStatus('Error');
        setTimeout(() => connectWebSocket(config, chainName), 5000);
      }
    };

    // Connect to all chains
    connectWebSocket(networkConfig.prime, 'Prime');
    networkConfig.regions.forEach((region, idx) => {
      connectWebSocket(region, `Region-${idx}`);
    });
    networkConfig.zones.forEach((zone) => {
      connectWebSocket(zone, zone.name);
    });

    return () => {
      Object.values(connections).forEach(ws => {
        if (ws) {
          ws.close();
        }
      });
    };
  }, [isEnabled, addItem]);

  // Set up polling interval for all chains
  useEffect(() => {
    if (!isConnected || !isEnabled) return;
    
    const pollAllChains = () => {
      pollLatestBlock(networkConfig.prime, 'Prime');
      networkConfig.regions.forEach((region, idx) => {
        pollLatestBlock(region, `Region-${idx}`);
      });
      networkConfig.zones.forEach((zone) => {
        pollLatestBlock(zone, zone.name);
      });
    };
    
    pollAllChains();
    const interval = setInterval(pollAllChains, 2000); // Poll every 2 seconds for demo
    
    return () => clearInterval(interval);
  }, [isConnected, isEnabled, pollLatestBlock]);

  // Periodic cleanup to ensure application stays light
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setItems(prevItems => {
        if (prevItems.length <= MaxItemsToKeep) {
          return prevItems;
        }
        console.log(`🕐 Periodic cleanup: ${prevItems.length} items`);
        return cleanupOldItems(prevItems);
      });
    }, 30000); // Clean up every 30 seconds

    return () => clearInterval(cleanupInterval);
  }, [cleanupOldItems]);

  return {
    items,
    wsConnections,
    isConnected,
    connectionStatus,
    tipBlockHeight,
    maxHeightRef,
    fetchingParentsRef,
    missingParentsRef,
    addItem,
    fetchMissingParent,
    pollLatestBlock,
    networkConfig
  };
};