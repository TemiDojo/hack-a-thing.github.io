import React, { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';


const HIGHLIGHT_COLOR = '#ff5722'; 
const DEFAULT_NODE_COLOR = '#ffffff'; 

const MyForceGraph = () => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const ORBIT_DISTANCE = 1300; // Fixed distance from the center
  const distance = 1300; // Fixed distance from the center

  const ORBIT_ELEVATION = 0; 
  const ORBIT_SPEED = Math.PI / 40000; 
  const [loading, setLoading] = useState(true);

  // State to control orbiting
  const [isOrbiting, setIsOrbiting] = useState(true); // Controlled by button and 'f' key

  // State for search input
  const [searchQuery, setSearchQuery] = useState('');

  // State for the currently highlighted node (from click or search)
  const [highlightNode, setHighlightNode] = useState(null);

  // State for the currently hovered node
  const [hoverNode, setHoverNode] = useState(null);

  // Ref to access current isOrbiting state inside animation loop
  const isOrbitingRef = useRef(isOrbiting);

  // Ref to track if the user is typing in the search bar
  const isTypingRef = useRef(false);

  // Ref to store the previous highlight (for reverting after hover)
  const previousHighlightRef = useRef(null);

  // State to track if a transition is in progress
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Ref to track the current orbit angle
  const angleRef = useRef(0);
  const prevCameraPosRef = useRef(null); // To store previous camera position
  const prevCameraTargetRef = useRef(null); // To store previous camera target
  const isClicked = useRef(false);


  useEffect(() => {
    isOrbitingRef.current = isOrbiting;
  }, [isOrbiting]);

  useEffect(() => {
    fetch('../datasets/blocks.json') 
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data); 
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching graph data:', error);
        setLoading(false);
      });
  }, []);

  // Orbiting animation via camera rotation
  useEffect(() => {
    if (fgRef.current) {
      // Initialize camera position
      fgRef.current.cameraPosition({ z: distance });

      const orbitCamera = () => {
        // Only update camera if orbiting is active and not transitioning
        if (isOrbitingRef.current && !isTransitioning) {
          angleRef.current += ORBIT_SPEED; // Increment the angle by a fixed speed

            // Get current camera and controls
            const camera = fgRef.current.camera();
            const controls = fgRef.current.controls();

            // Store current camera position
            prevCameraPosRef.current = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            };

            // Store current camera target
            prevCameraTargetRef.current = {
            x: controls.target.x,
            y: controls.target.y,
            z: controls.target.z,
            };
            
          const x = ORBIT_DISTANCE * Math.sin(angleRef.current);
          const z = ORBIT_DISTANCE * Math.cos(angleRef.current);
          fgRef.current.cameraPosition(
            { x, y: ORBIT_ELEVATION, z },
            prevCameraTargetRef
          );

          if (angleRef.current >= 2 * Math.PI) {
            angleRef.current -= 2 * Math.PI;
          }
        }
        requestAnimationFrame(orbitCamera); // Continue the animation
      };

      requestAnimationFrame(orbitCamera); // Start the animation
    }
  }, [distance, isTransitioning, ORBIT_SPEED]);

  // Reverse focus smoothly
  const reverseFocus = useCallback(() => {
    if (prevCameraPosRef.current && prevCameraTargetRef.current) {
      setIsTransitioning(true);
      
      fgRef.current.cameraPosition(
        prevCameraPosRef.current,
        prevCameraTargetRef.current,
        3000 
      );
      isClicked.current = false;

      setIsTransitioning(false);
    }
  }, []);
  // Handle node click: Pause orbiting and focus camera on node
  const handleNodeClick = (node) => {
    console.log(node);
    isClicked.current = true;
    setIsOrbiting(false); // Pause orbiting on node click
    setHighlightNode(node); // Highlight the clicked node
    previousHighlightRef.current = node; // Store as previous highlight

    // Calculate focus position
    const focusDistance = 40;
    const distRatio = 1 + focusDistance / Math.hypot(node.x, node.y, node.z);

    // Move camera to focus on the node
    fgRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node,
      3000 // Transition duration in milliseconds
    );
  };

  const resumeOrbitingSmoothly = useCallback(() => {
    if (prevCameraPosRef.current && prevCameraTargetRef.current && isClicked.current) {
      reverseFocus();
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const asyncFunction = async () => {
        await delay(3000);
        setIsOrbiting(true);
      };

      asyncFunction();
    } else {
      setIsOrbiting(true);
    }
    
  }, [reverseFocus]);

  // Toggle orbiting state with smooth transition
  const toggleOrbit = useCallback(() => {
    if (!isOrbiting) {
      resumeOrbitingSmoothly();
    } else {
      setIsOrbiting(false);
      setHighlightNode(null);
      previousHighlightRef.current = null;
    }
  }, [isOrbiting, resumeOrbitingSmoothly]);



  // Handle 'f' key press to toggle orbiting
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.key === 'f' || event.key === 'F') && !isTypingRef.current) {
        toggleOrbit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleOrbit]);

  // Handle search form submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Search for the node by id or name
    const node = graphData.nodes.find(
      (n) =>
        n.id.toLowerCase() === searchQuery.trim().toLowerCase() ||
        (n.name && n.name.toLowerCase() === searchQuery.trim().toLowerCase())
    );

    if (node) {
      isClicked.current = true;
      // Pause orbiting
      setIsOrbiting(false);
      setHighlightNode(node); // Highlight the found node
      previousHighlightRef.current = node; // Store as previous highlight

      // Focus camera on the node
      const focusDistance = 40;
      const distRatio = 1 + focusDistance / Math.hypot(node.x, node.y, node.z);

      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        3000 // Transition duration in milliseconds
      );
    }

    // Clear the search input
    setSearchQuery('');
  };

  // Handle input focus: pause orbiting and set isTypingRef to true
  const handleInputFocus = () => {
    console.log("Focusing on search bar");
    isTypingRef.current = true;
  };


  // Handle node hover: set hoverNode
  const handleNodeHover = (node) => {
    if (node) {
      setHoverNode(node);
    } else {
      setHoverNode(null);
    }
  };

  // Update previousHighlightRef when highlightNode changes due to click or search
  useEffect(() => {
    if (highlightNode && !previousHighlightRef.current) {
      previousHighlightRef.current = highlightNode;
    }
    if (!highlightNode) {
      previousHighlightRef.current = null;
    }
  }, [highlightNode]);

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.container}>
      <button
        onClick={toggleOrbit}
        style={{
          ...styles.button,
          backgroundColor: isOrbiting ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)',
        }}
        aria-label={isOrbiting ? 'Pause Orbit' : 'Resume Orbit'}
      >
        {isOrbiting ? 'Pause Orbit' : 'Resume Orbit'}
      </button>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={handleInputFocus}
          placeholder="Search node by ID or name..."
          style={styles.searchInput}
        />
      </form>

      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeAutoColorBy={'description'}
        nodeColor={(node) => {
          if (hoverNode && node.id === hoverNode.id) {
            return HIGHLIGHT_COLOR; 
          }
          if (highlightNode && node.id === highlightNode.id) {
            return HIGHLIGHT_COLOR; 
          }
          return DEFAULT_NODE_COLOR; 
        }}
        linkWidth={0}
        // linkColor={() => 'rgba(0,0,0,0)'} 
        linkDirectionalArrowLength={null}
        linkDirectionalArrowRelPos={null}
        nodeLabel="id"
        nodeRelSize={3}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        numDimensions={3}
        backgroundColor="#0d0d0d" 
        enableNavigationControls={false}
        showNavInfo={false}
      />
    </div>
  );
};

// Styles
const styles = {
  container: {
    position: 'relative',
    height: '100vh',
    width: '100%',
    backgroundColor: '#0d0d0d', 
    overflow: 'hidden',
  },
  button: {
    position: 'absolute',
    zIndex: 2,
    top: 20,
    left: 20,
    padding: '12px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    borderRadius: '30px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    fontWeight: '600',
    transition: 'background-color 0.3s, transform 0.2s',
  },
  searchForm: {
    position: 'absolute',
    zIndex: 2,
    bottom: 30,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80%',
    maxWidth: '400px',
  },
  searchInput: {
    width: '100%',
    padding: '12px 20px',
    borderRadius: '30px',
    border: 'none',
    outline: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    fontSize: '16px',
    transition: 'box-shadow 0.3s, transform 0.2s',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#333',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    color: '#ffffff',
    backgroundColor: '#0d0d0d',
    fontSize: '24px',
  },
};

export default MyForceGraph;
