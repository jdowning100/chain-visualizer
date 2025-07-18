import { useState, useCallback, useRef, useEffect } from 'react';

const MaxBlocksToFetch = 10;
const MaxItemsToKeep = 300; // Keep only the most recent 200 items for performance

export const useBlockchainData = () => {
  const [items, setItems] = useState([]);
  const [wsConnection, setWsConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [tipBlockHeight, setTipBlockHeight] = useState(0);
  const maxHeightRef = useRef(0);
  const fetchingParentsRef = useRef(new Set());
  const missingParentsRef = useRef(new Map());

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
  const addItem = useCallback((type, hash, parentHash, number = null, order = null, headerParentHashes = null, includingHash = null) => {
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
          includedIn: includingHash || null
        };

        console.log(`Added ${type}: ${shortHash} -> ${newItem.fullParentHash} (${decimalNumber}) includedIn: ${newItem.includedIn}`);
        
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
            fetchMissingParent(newItem.fullParentHash);
          }
        }
        
        return cleanupOldItems(updatedItems);
      } else {
        // For 'block' type, create multiple representations based on order
        let decimalNumber = parseInt(number, 16);
        const orderNum = parseInt(order, 16);
        const newItems = [];

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
            timestamp: timestamp
          };

          newItems.push(item);
        };

        if (orderNum === 0) {
          // Prime: add prime, region, zone
          addRepresentation('primeBlock', headerParentHashes[0]);
          addRepresentation('regionBlock', headerParentHashes[1]);
          addRepresentation('block', parentHash);
        } else if (orderNum === 1) {
          // Region: add region, zone
          addRepresentation('regionBlock', headerParentHashes[1] || headerParentHashes[0]);
          addRepresentation('block', parentHash);
        } else {
          // Zone: add zone
          addRepresentation('block', parentHash);
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
              fetchMissingParent(newItem.fullParentHash);
            }
          }
        });
        
        return cleanupOldItems(updatedItems);
      }
    });
  }, [cleanupOldItems]);

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

  // Fetch missing parent block via HTTP
  const fetchMissingParent = useCallback(async (parentHash) => {
    if (fetchingParentsRef.current.has(parentHash)) {
      return;
    }

    try {
      fetchingParentsRef.current.add(parentHash);
      console.log(`🔍 Fetching missing parent ${parentHash.slice(0, 8)} via HTTP`);
      
      // Use HTTP instead of WebSocket for more reliable fetching
      const httpUrl = 'https://debug.rpc.quai.network/cyprus1'; // Convert WebSocket URL to HTTP
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
        
        addItem('block', hash, zoneParent, number, order, headerParentHashes);
      }
    } catch (error) {
      console.error(`❌ Failed to fetch parent ${parentHash.slice(0, 8)} via HTTP:`, error);
    } finally {
      fetchingParentsRef.current.delete(parentHash);
    }
  }, [addItem]);

  // Poll for latest block
  const pollLatestBlock = useCallback(async () => {
    console.log('🔍 Poll attempt - isConnected:', isConnected);
    
    // Don't check wsConnection here since it's an HTTP request
    if (!isConnected) {
      console.log('⏭️ Skipping poll - not connected');
      return;
    }
    
    try {
      const response = await fetch('https://debug.rpc.quai.network/cyprus1', {
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
        const zoneParent = data.result.woHeader.parentHash;
        const number = data.result.woHeader.number;
        const order = data.result.order;
        const headerParentHashes = data.result.header ? data.result.header.parentHash : [];
        setTipBlockHeight(parseInt(number, 16));
        addItem('block', hash, zoneParent, number, order, headerParentHashes);
        
        if (data.result.uncles && data.result.uncles.length > 0) {
          data.result.uncles.forEach((uncle, index) => {
            if (uncle.hash && uncle.parentHash) {
              addItem('uncle', uncle.hash, uncle.parentHash, uncle.number, null, null, hash);
            }
          });
        }
        
        if (data.result.workshares && data.result.workshares.length > 0) {
          data.result.workshares.forEach((workshare, index) => {
            if (workshare.hash && workshare.parentHash) {
              addItem('workshare', workshare.hash, workshare.parentHash, workshare.number, null, null, hash);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error polling latest block:', error);
    }
  }, [isConnected, addItem]);

  // WebSocket connection management
  useEffect(() => {
    console.log('🚀 Starting WebSocket connection');
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('wss://debug.rpc.quai.network/cyprus1');
        
        ws.onopen = () => {
          console.log('✅ WebSocket connected');
          setIsConnected(true);
          setConnectionStatus('Connected');
          setWsConnection(ws);

          console.log('🔄 Starting initial poll for latest block');
          // Delay initial poll to ensure wsConnection is set
          setTimeout(() => pollLatestBlock(), 100);

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
                addItem('workshare', result.hash, result.parentHash, result.number);
              } else {
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
  }, [addItem]); // Remove pollLatestBlock from dependencies to avoid recreation

  // Set up polling interval
  useEffect(() => {
    if (!isConnected) return;
    
    pollLatestBlock();
    const interval = setInterval(pollLatestBlock, 1000);
    
    return () => clearInterval(interval);
  }, [isConnected, pollLatestBlock]);

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
    wsConnection,
    isConnected,
    connectionStatus,
    tipBlockHeight,
    maxHeightRef,
    fetchingParentsRef,
    missingParentsRef,
    addItem,
    fetchBlockByHash,
    fetchMissingParent,
    pollLatestBlock
  };
};