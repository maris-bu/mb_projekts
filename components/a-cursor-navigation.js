/**
 * A-CURSOR NAVIGATION COMPONENTS
 * ==============================
 * A-Frame teleportation system using the a-cursor for consistent navigation
 * in both desktop and VR modes.
 * 
 * COMPONENTS INCLUDED:
 * --------------------
 * 
 * 1. navmesh
 *    Marks a surface as teleportable. Add this attribute to any geometry
 *    where users should be able to teleport.
 * 
 *    Example:
 *    <a-plane navmesh position="0 0 0" rotation="-90 0 0" width="10" height="10"></a-plane>
 *    <a-entity navmesh gltf-model="#floor-model"></a-entity>
 * 
 * 
 * 2. raycast-exclude  
 *    Excludes an object from blocking teleportation. Objects with this
 *    attribute won't prevent teleporting to navmesh surfaces behind them.
 * 
 *    Example:
 *    <a-box raycast-exclude position="0 1 -3" material="opacity: 0.5"></a-box>
 * 
 * 
 * 3. a-cursor-teleport
 *    Main teleportation component. Attach to the camera rig entity.
 * 
 *    Schema Properties:
 *    - cameraRig: Selector for the camera rig entity (default: "")
 *    - cameraHead: Selector for the camera/head entity (default: "")  
 *    - landingMaxAngle: Max surface angle in degrees for valid landing (default: 45)
 *    - landingNormal: Expected up direction (default: {x:0, y:1, z:0})
 *    - transitionSpeed: Teleport animation speed (default: 0.0006)
 *    - cursorColor: Teleport indicator color (default: "#00ff00")
 *    - cursorOpacity: Teleport indicator opacity (default: 1)
 *    - alignToSurface: Align camera to surface normal (default: true)
 *    - rotationSmoothing: Rotation interpolation factor (default: 1.0)
 * 
 *    Basic Example:
 *    <a-entity id="cameraRig" a-cursor-teleport="cameraRig: #cameraRig; cameraHead: #head">
 *      <a-entity id="head" camera look-controls>
 *        <a-cursor></a-cursor>
 *      </a-entity>
 *    </a-entity>
 *    <a-plane navmesh position="0 0 -4" rotation="-90 0 0" width="10" height="10"></a-plane>
 * 
 *    Full Example with all options:
 *    <a-entity 
 *      id="cameraRig"
 *      a-cursor-teleport="
 *        cameraRig: #cameraRig; 
 *        cameraHead: #head;
 *        cursorColor: #00ff00;
 *        cursorOpacity: 0.8;
 *        landingMaxAngle: 30;
 *        transitionSpeed: 0.001">
 *      <a-entity id="head" position="0 1.6 0" camera look-controls>
 *        <a-cursor color="white"></a-cursor>
 *      </a-entity>
 *    </a-entity>
 * 
 * 
 * HOW IT WORKS:
 * -------------
 * - The a-cursor casts a ray from the center of the screen
 * - When hovering over a navmesh surface, a green ring indicator appears
 * - Clicking teleports the camera rig to that location
 * - Objects without raycast-exclude will block teleportation (occlusion)
 * - Works consistently in both desktop browser and VR headset modes
 * 
 * 
 * DEBUG MODE:
 * -----------
 * Add ?debug=true to URL to enable console logging for troubleshooting.
 * 
 */

// Simple navmesh component - just marks an entity as a navigation mesh for teleportation
AFRAME.registerComponent("navmesh", {
    init() {
        // Mark this entity as a navmesh for teleportation
        this.el.object3D.traverse((obj) => {
            if (obj.isMesh) {
                obj.userData.collision = true;
            }
        });
    }
});

// Exclude entity from raycast occlusion checking - objects with this won't block teleportation
AFRAME.registerComponent("raycast-exclude", {
    init() {
        // Mark this entity to be excluded from occlusion raycasting
        this.el.object3D.traverse((obj) => {
            if (obj.isMesh) {
                obj.userData.raycastExclude = true;
            }
        });
    }
});

// Enhanced cursor-teleport component that shows cursor when hovering over valid teleport locations
AFRAME.registerComponent("a-cursor-teleport", {
    schema: {
        cameraHead: { type: "selector", default: "" },
        cameraRig: { type: "selector", default: "" },
        collisionEntities: { type: "string", default: "[navmesh]" },
        ignoreEntities: { type: "string", default: "" },
        landingMaxAngle: { default: 45, min: 0, max: 360 },
        landingNormal: { type: "vec3", default: { x: 0, y: 1, z: 0 } },
        transitionSpeed: { type: "number", default: 0.0006 },
        cursorColor: { type: "color", default: "#00ff00" },
        cursorOpacity: { type: "number", default: 1 },
        alignToSurface: { type: "boolean", default: true },
        rotationSmoothing: { type: "number", default: 1.0 }
    },

    init() {
        // Performance: Only log in debug mode
        this.debugMode = window.location.search.includes('debug=true');
        if (this.debugMode) console.log("navigation-05: Initializing cursor-teleport component");
        
        this.mobile = AFRAME.utils.device.isMobile() || AFRAME.utils.device.isMobileDeviceRequestingDesktopSite();
        this.isVR = false;
        const sceneEl = this.el.sceneEl;
        this.canvas = sceneEl.renderer.domElement;
        
        // Check for VR mode once during initialization
        this.checkVRMode();
        
        // Listen for VR session changes
        this.setupVRSessionListeners();
        
        // Cache camera reference
        this.initializeCamera();
        
        // Initialize reusable objects to prevent garbage collection
        this.initializeReusableObjects();
        
        // Performance optimization: Cache teleport position results
        this.lastTeleportCheck = 0;
        this.cachedTeleportPos = null;
        this.teleportCheckInterval = 16; // ~60fps

        // Performance monitoring (only in debug mode)
        if (this.debugMode) {
            this.perfStats = {
                raycastCount: 0,
                lastPerfReport: 0,
                avgFrameTime: 0
            };
        }

        // Create teleport indicator once
        this.createTeleportIndicator();

        // Initialize VR properties
        this.vrCursorInitialized = false;
        this.vrCursorClickHandler = null;
        this.vrTransitionReady = false;

        // Mouse tracking (reused objects)
        this.mousePosition = { x: 0, y: 0 };
        this.mouseOriginalPosition = { x: 0, y: 0 };

        // Bind methods once
        this.bindMethods();

        // Initialize raycast objects
        this.updateRaycastObjects();

        // Set up cursor (works for both VR and desktop)
        this.setupCursor();
    },

    initializeCamera() {
        // Find camera once and cache it
        this.data.cameraHead.object3D.traverse((obj) => {
            if (obj instanceof THREE.Camera) {
                this.cam = obj;
                if (this.debugMode) console.log("navigation-05: Camera found");
                return; // Stop traversing once found
            }
        });
        this.camRig = this.data.cameraRig.object3D;
    },

    initializeReusableObjects() {
        // Pre-allocate all reusable objects to prevent garbage collection
        this.rayCaster = new THREE.Raycaster();
        this.collisionObjectNormalMatrix = new THREE.Matrix3();
        this.collisionWorldNormal = new THREE.Vector3();
        this.referenceNormal = new THREE.Vector3();
        this.rayCastObjects = [];
        this.referenceNormal.copy(this.data.landingNormal);

        // Transition properties (reusable objects)
        this.transitioning = false;
        this.transitionProgress = 0;
        this.transitionCamPosStart = new THREE.Vector3();
        this.transitionCamPosEnd = new THREE.Vector3();
        this.transitionRotStart = new THREE.Quaternion();
        this.transitionRotEnd = new THREE.Quaternion();
        this.currentSurfaceNormal = new THREE.Vector3(0, 1, 0);
        this.targetSurfaceNormal = new THREE.Vector3(0, 1, 0);

        // Pre-allocate temporary objects for calculations
        this.tempVector3 = new THREE.Vector3();
        this.tempVector3_2 = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
        this.teleportQuaternion = new THREE.Quaternion();
        this.upVector = new THREE.Vector3(0, 1, 0);
        this.ndcMouse = new THREE.Vector2();

        // Initialize counters
        this.lastCollisionCount = 0;
        this.lastRaycastCount = 0;
    },

    createTeleportIndicator() {
        const ringGeometry = new THREE.RingGeometry(0.25, 0.3, 32, 1);
        ringGeometry.rotateX(-Math.PI / 2);
        ringGeometry.translate(0, 0.02, 0);
        
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: this.data.cursorColor,
            transparent: true,
            opacity: this.data.cursorOpacity
        });
        
        this.teleportIndicator = new THREE.Mesh(ringGeometry, ringMaterial);
        this.teleportIndicator.visible = false;
        this.el.sceneEl.object3D.add(this.teleportIndicator);
        
        if (this.debugMode) console.log("navigation-05: Teleport indicator created");
    },

    bindMethods() {
        // Bind all methods once to prevent repeated binding
        this.updateRaycastObjects = this.updateRaycastObjects.bind(this);
        this.getMouseState = this.getMouseState.bind(this);
        this.getTeleportPosition = this.getTeleportPosition.bind(this);
        this.getTeleportPositionVR = this.getTeleportPositionVR.bind(this);
        this.isValidNormalsAngle = this.isValidNormalsAngle.bind(this);
        this.transition = this.transition.bind(this);
        this.triggerTunnelAnimation = this.triggerTunnelAnimation.bind(this);
        this.triggerTunnelUpAnimation = this.triggerTunnelUpAnimation.bind(this);
        this.mouseMove = this.mouseMove.bind(this);
        this.mouseDown = this.mouseDown.bind(this);
        this.mouseUp = this.mouseUp.bind(this);
        this.easeInOutQuad = this.easeInOutQuad.bind(this);
        this.hideCursor = this.hideCursor.bind(this);
        this.checkVRMode = this.checkVRMode.bind(this);
        this.setupVRSessionListeners = this.setupVRSessionListeners.bind(this);
    },

    checkVRMode() {
        // Optimized VR mode detection
        const urlParams = new URLSearchParams(window.location.search);
        const urlVRMode = urlParams.get('vr') === 'true';
        
        let sessionVRMode = false;
        if (this.el.sceneEl.xr && this.el.sceneEl.xr.isPresenting) {
            sessionVRMode = true;
        }
        
        const previousVRMode = this.isVR;
        this.isVR = urlVRMode || sessionVRMode;
        
        // Only log when VR mode actually changes
        if (this.debugMode && previousVRMode !== this.isVR) {
            console.log("navigation-05: VR Mode changed - Final:", this.isVR);
        }
    },

    setupVRSessionListeners() {
        // Optimized VR session listeners with immediate response
        this.el.sceneEl.addEventListener('enter-vr', () => {
            if (this.debugMode) console.log("navigation-05: Entered VR session");
            this.isVR = true;
            this.transitioning = false;
            this.transitionProgress = 0;
            
            // Immediate initialization without timeouts
            this.initializeTunnelForVR();
            this.setupVRCursor();
            this.vrTransitionReady = true;
        });
        
        this.el.sceneEl.addEventListener('exit-vr', () => {
            if (this.debugMode) console.log("navigation-05: Exited VR session");
            this.isVR = false;
        });

        // Optimized visibility change handler
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isVR && (!this.vrCursor || !this.vrRaycaster)) {
                if (this.debugMode) console.log("navigation-05: Re-initializing VR cursor on tab focus");
                this.setupVRCursor();
            }
        });
    },

    initializeTunnelForVR() {
        // Cache tunnel element for better performance
        if (!this.tunnelElement) {
            this.tunnelElement = this.el.sceneEl.querySelector("#tunnel");
        }
        
        if (this.tunnelElement) {
            // Immediate tunnel state reset
            this.tunnelElement.removeAttribute("animation__tunnel_down");
            this.tunnelElement.removeAttribute("animation__tunnel_up");
            this.tunnelElement.removeAttribute("animation__down");
            this.tunnelElement.removeAttribute("animation__up");
            this.tunnelElement.setAttribute("scale", "1 0.1 1");
            this.tunnelElement.setAttribute("visible", "true");
            
            if (this.debugMode) console.log("navigation-05: Tunnel initialized for VR");
        }
        
        this.vrTransitionReady = true;
    },

    setupCursor() {
        // Unified cursor setup - works for both VR and desktop
        this.cursorEl = this.el.sceneEl.querySelector('a-cursor');
        
        if (this.cursorEl && this.cursorEl.components.raycaster && this.cursorEl.components.raycaster.raycaster) {
            this.cursorRaycaster = this.cursorEl.components.raycaster;
            
            // Remove existing listener to prevent duplicates
            if (this.cursorClickHandler) {
                this.cursorEl.removeEventListener('click', this.cursorClickHandler);
            }
            
            // Create unified click handler for both VR and desktop
            this.cursorClickHandler = (event) => {
                if (this.debugMode) console.log("navigation-05: Cursor click (VR:", this.isVR, ")");
                
                const teleportData = this.getTeleportPositionFromCursor();
                if (teleportData) {
                    this.teleportIndicator.position.copy(teleportData.point);
                    
                    let targetQuaternion = null;
                    if (this.data.alignToSurface && teleportData.normal) {
                        this.teleportQuaternion.setFromUnitVectors(this.upVector, teleportData.normal);
                        targetQuaternion = this.teleportQuaternion.clone();
                    }
                    
                    this.transition(teleportData, targetQuaternion);
                }
            };
            
            this.cursorEl.addEventListener('click', this.cursorClickHandler);
            this.cursorInitialized = true;
            
            if (this.debugMode) console.log("navigation-05: Cursor setup completed");
        } else {
            // Single retry with short delay
            if (!this.cursorSetupRetried) {
                this.cursorSetupRetried = true;
                setTimeout(() => this.setupCursor(), 200);
            } else if (this.debugMode) {
                console.warn("navigation-05: Cursor setup failed after retry");
            }
        }
    },

    // Keep old method name as alias for backwards compatibility
    setupVRCursor() {
        this.setupCursor();
    },

    updateRaycastObjects() {
        const previousCount = this.rayCastObjects.length;
        this.rayCastObjects.length = 0;
        
        // Collect ALL scene meshes for occlusion checking (excluding marked objects)
        this.allSceneMeshes = [];
        this.el.sceneEl.object3D.traverse((obj) => {
            if (obj.isMesh && obj.visible && !obj.userData.raycastExclude) {
                this.allSceneMeshes.push(obj);
            }
        });
        
        if (this.data.collisionEntities !== "") {
            const collisionEntities = this.el.sceneEl.querySelectorAll(this.data.collisionEntities);
            
            // Only log changes for debugging
            if (this.debugMode && collisionEntities.length !== this.lastCollisionCount) {
                console.log("navigation-05: Collision entities count:", collisionEntities.length);
            }
            this.lastCollisionCount = collisionEntities.length;
            
            // Optimized loop with early continue
            for (let i = 0; i < collisionEntities.length; i++) {
                const entity = collisionEntities[i];
                entity.object3D.traverse((obj) => {
                    if (obj.isMesh) {
                        obj.userData.collision = true;
                        obj.userData.isNavmesh = true;
                        this.rayCastObjects.push(obj);
                    }
                });
            }
        } else {
            // Create default plane only once
            if (!this.collisionMesh) {
                const planeGeometry = new THREE.PlaneGeometry(100, 100, 1);
                planeGeometry.rotateX(-Math.PI / 2);
                const planeMaterial = new THREE.MeshNormalMaterial();
                this.collisionMesh = new THREE.Mesh(planeGeometry, planeMaterial);
                this.collisionMesh.userData.collision = true;
                if (this.debugMode) console.log("navigation-05: Created default collision plane");
            }
            this.rayCastObjects.push(this.collisionMesh);
        }
        
        // Critical warning only when objects are lost
        if (this.rayCastObjects.length === 0 && previousCount > 0) {
            console.warn("navigation-05: CRITICAL - Lost all collision objects! VR teleportation disabled.");
        }
        
        this.lastRaycastCount = this.rayCastObjects.length;

        // Handle ignore entities
        if (this.data.ignoreEntities !== "") {
            const ignoreEntities = this.el.sceneEl.querySelectorAll(this.data.ignoreEntities);
            for (let i = 0; i < ignoreEntities.length; i++) {
                const entity = ignoreEntities[i];
                entity.object3D.traverse((obj) => {
                    if (obj.isMesh) {
                        this.rayCastObjects.push(obj);
                    }
                });
            }
        }
    },

    getMouseState() {
        // Optimized mouse state using cached objects
        return (event) => {
            const rect = this.canvas.getBoundingClientRect();
            if (event.clientX != null) {
                this.mousePosition.x = event.clientX - rect.left;
                this.mousePosition.y = event.clientY - rect.top;
                return this.mousePosition;
            } else if (event.touches && event.touches[0]) {
                this.mousePosition.x = event.touches[0].clientX - rect.left;
                this.mousePosition.y = event.touches[0].clientY - rect.top;
                return this.mousePosition;
            }
        };
    },

    getTeleportPositionFromCursor() {
        // Unified teleport position calculation using a-cursor raycaster
        if (!this.cursorRaycaster?.raycaster) {
            // Single attempt to re-establish connection
            if (this.cursorEl?.components.raycaster?.raycaster) {
                this.cursorRaycaster = this.cursorEl.components.raycaster;
            } else {
                return false;
            }
        }
        
        if (this.rayCastObjects.length === 0) return false;
        
        // First, raycast against ALL scene objects to check for occlusion
        const allIntersects = this.cursorRaycaster.raycaster.intersectObjects(this.allSceneMeshes || [], true);
        
        if (allIntersects.length === 0) return false;
        
        // Get the first (closest) intersection
        const firstHit = allIntersects[0];
        
        // Check if the first hit is a navmesh object
        // If something else is in front of the navmesh, teleportation is blocked
        if (!firstHit.object.userData.isNavmesh) {
            return false; // Something is occluding the navmesh
        }
        
        const intersect = firstHit;
        
        if (!this.isValidNormalsAngle(intersect.face.normal, intersect.object) || 
            intersect.object.userData.collision !== true) {
            return false;
        }

        // Reuse matrix calculation
        this.collisionObjectNormalMatrix.getNormalMatrix(intersect.object.matrixWorld);
        const worldNormal = this.tempVector3.copy(intersect.face.normal)
            .applyMatrix3(this.collisionObjectNormalMatrix).normalize();

        return {
            point: intersect.point,
            normal: worldNormal
        };
    },

    // Keep old method name as alias for backwards compatibility
    getTeleportPositionVR() {
        return this.getTeleportPositionFromCursor();
    },

    getTeleportPosition() {
        // Optimized teleport position calculation with cached objects
        return (x, y) => {
            if (this.rayCastObjects.length === 0 || !this.cam || !this.canvas) return false;

            const rect = this.canvas.getBoundingClientRect();
            this.ndcMouse.x = (x / (rect.right - rect.left)) * 2 - 1;
            this.ndcMouse.y = -(y / (rect.bottom - rect.top)) * 2 + 1;

            this.rayCaster.setFromCamera(this.ndcMouse, this.cam);
            const intersects = this.rayCaster.intersectObjects(this.rayCastObjects);

            if (intersects.length === 0) return false;
            
            const intersect = intersects[0];
            if (!this.isValidNormalsAngle(intersect.face.normal, intersect.object) || 
                intersect.object.userData.collision !== true) return false;

            // Reuse matrix and vector calculations
            this.collisionObjectNormalMatrix.getNormalMatrix(intersect.object.matrixWorld);
            const worldNormal = this.tempVector3.copy(intersect.face.normal)
                .applyMatrix3(this.collisionObjectNormalMatrix).normalize();

            return {
                point: intersect.point,
                normal: worldNormal
            };
        };
    },

    isValidNormalsAngle(normal, object) {
        this.collisionObjectNormalMatrix.getNormalMatrix(object.matrixWorld);
        this.collisionWorldNormal.copy(normal).applyNormalMatrix(this.collisionObjectNormalMatrix);
        const angle = this.referenceNormal.angleTo(this.collisionWorldNormal);
        return (THREE.MathUtils.RAD2DEG * angle) <= this.data.landingMaxAngle;
    },

    transition(positionData, targetQuaternion) {
        this.transitionProgress = 0;
        
        // Handle both formats efficiently
        if (positionData.point) {
            this.transitionCamPosEnd.copy(positionData.point);
            this.targetSurfaceNormal.copy(positionData.normal);
        } else {
            this.transitionCamPosEnd.copy(positionData);
            this.targetSurfaceNormal.set(0, 1, 0);
        }
        
        this.transitionCamPosStart.copy(this.camRig.position);
        this.transitioning = true;
        this.el.emit("navigation-start");
        
        // Handle rotation transition
        this.transitionRotStart.copy(this.camRig.quaternion);
        
        if (targetQuaternion) {
            this.transitionRotEnd.copy(targetQuaternion);
        } else if (this.data.alignToSurface && positionData.normal) {
            this.transitionRotEnd.setFromUnitVectors(this.upVector, this.targetSurfaceNormal);
        } else {
            this.transitionRotEnd.copy(this.camRig.quaternion);
        }
        
        // Immediate tunnel animation for VR
        if (this.isVR && this.tunnelElement) {
            this.triggerTunnelAnimation();
        }
    },

    triggerTunnelAnimation() {
        if (this.tunnelElement) {
            this.tunnelElement.removeAttribute("animation__tunnel_down");
            this.tunnelElement.removeAttribute("animation__tunnel_up");
            
            this.tunnelElement.setAttribute("animation__tunnel_down", {
                property: "scale.y",
                to: -1,
                dur: 250,
                easing: "easeInQuad"
            });
        }
    },

    triggerTunnelUpAnimation() {
        if (this.tunnelElement) {
            this.tunnelElement.removeAttribute("animation__tunnel_down");
            this.tunnelElement.removeAttribute("animation__tunnel_up");
            
            this.tunnelElement.setAttribute("animation__tunnel_up", {
                property: "scale.y", 
                to: -0.1,
                dur: 500,
                easing: "easeOutQuad"
            });
        }
    },

    hideCursor() {
        this.teleportIndicator.visible = false;
    },

    mouseMove(event) {
        const mouseState = this.getMouseState()(event);
        if (mouseState) {
            this.mousePosition.x = mouseState.x;
            this.mousePosition.y = mouseState.y;
        }
    },

    mouseDown(event) {
        this.updateRaycastObjects();
        const mouseState = this.getMouseState()(event);
        if (mouseState) {
            this.mouseOriginalPosition.x = mouseState.x;
            this.mouseOriginalPosition.y = mouseState.y;
        }
    },

    mouseUp(event) {
        // Optimized mouse up with precise click detection
        if (this.mousePosition.x === this.mouseOriginalPosition.x && 
            this.mousePosition.y === this.mouseOriginalPosition.y) {
            
            const teleportData = this.getTeleportPosition()(this.mousePosition.x, this.mousePosition.y);
            if (teleportData) {
                this.teleportIndicator.position.copy(teleportData.point);
                
                let targetQuaternion = null;
                if (this.data.alignToSurface && teleportData.normal) {
                    this.teleportQuaternion.setFromUnitVectors(this.upVector, teleportData.normal);
                    targetQuaternion = this.teleportQuaternion.clone();
                }
                
                this.transition(teleportData, targetQuaternion);
            }
        }
    },

    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : (4 - 2 * t) * t - 1;
    },

    play() {
        // Setup cursor for all modes (VR and desktop)
        this.setupCursor();
        window.addEventListener("keydown", this.hideCursor, false);
        
        if (this.isVR) {
            this.initializeTunnelForVR();
        }
    },

    pause() {
        this.transitioning = false;
        this.hideCursor();
        window.removeEventListener("keydown", this.hideCursor);
    },

    tick(time, deltaTime) {
        // Performance monitoring (debug only)
        if (this.debugMode && this.perfStats) {
            this.perfStats.avgFrameTime = (this.perfStats.avgFrameTime * 0.9) + (deltaTime * 0.1);
            if (time - this.perfStats.lastPerfReport > 10000) {
                console.log("navigation-05 Performance:", {
                    avgFrameTime: this.perfStats.avgFrameTime.toFixed(2) + "ms",
                    raycastCount: this.perfStats.raycastCount,
                    raycastObjects: this.rayCastObjects.length
                });
                this.perfStats.raycastCount = 0;
                this.perfStats.lastPerfReport = time;
            }
        }

        // Optimized raycast object updates (less frequent)
        if (!this.lastRaycastUpdate || time - this.lastRaycastUpdate > 15000) {
            const previousCount = this.rayCastObjects.length;
            this.updateRaycastObjects();
            if (this.debugMode && this.rayCastObjects.length !== previousCount) {
                console.log("navigation-05: Raycast objects updated - count:", this.rayCastObjects.length);
            }
            this.lastRaycastUpdate = time;
        }
        
        // Optimized cursor display with throttled checks
        if (!this.transitioning) {
            let teleportPos = false;
            
            if (time - this.lastTeleportCheck > this.teleportCheckInterval) {
                // Always use cursor raycaster for consistent behavior
                teleportPos = this.getTeleportPositionFromCursor();
                if (this.debugMode && this.perfStats) this.perfStats.raycastCount++;
                
                this.cachedTeleportPos = teleportPos;
                this.lastTeleportCheck = time;
            } else {
                teleportPos = this.cachedTeleportPos;
            }
            
            if (teleportPos) {
                this.teleportIndicator.visible = true;
                const position = teleportPos.point || teleportPos;
                this.teleportIndicator.position.copy(position);
                
                if (this.data.alignToSurface && teleportPos.normal) {
                    const offsetPosition = this.tempVector3_2.copy(position)
                        .add(this.tempVector3.copy(teleportPos.normal).multiplyScalar(0.01));
                    this.teleportIndicator.position.copy(offsetPosition);
                    
                    this.teleportQuaternion.setFromUnitVectors(this.upVector, teleportPos.normal);
                    this.teleportIndicator.quaternion.copy(this.teleportQuaternion);
                } else {
                    this.teleportIndicator.quaternion.identity();
                }
            } else {
                this.teleportIndicator.visible = false;
            }
        }

        // Optimized transition animation
        if (this.transitioning) {
            this.transitionProgress += deltaTime * this.data.transitionSpeed;
            const easedProgress = this.easeInOutQuad(this.transitionProgress);
            const camPos = this.camRig.position;
            
            camPos.lerpVectors(this.transitionCamPosStart, this.transitionCamPosEnd, easedProgress);
            
            if (this.data.alignToSurface && this.transitionRotStart && this.transitionRotEnd) {
                const rotationProgress = Math.min(easedProgress * this.data.rotationSmoothing, 1.0);
                this.camRig.quaternion.slerpQuaternions(this.transitionRotStart, this.transitionRotEnd, rotationProgress);
            }
            
            if (this.transitionProgress >= 1) {
                this.transitioning = false;
                camPos.copy(this.transitionCamPosEnd);
                
                if (this.data.alignToSurface && this.transitionRotEnd) {
                    this.camRig.quaternion.copy(this.transitionRotEnd);
                }
                
                this.el.emit("navigation-end");
                
                if (this.isVR && this.tunnelElement) {
                    this.triggerTunnelUpAnimation();
                }
            }
        }
    },

    remove() {
        // Proper cleanup to prevent memory leaks
        this.cam = null;
        this.canvas = null;
        this.rayCastObjects.length = 0;
        
        if (this.vrCursor && this.vrCursorClickHandler) {
            this.vrCursor.removeEventListener('click', this.vrCursorClickHandler);
            this.vrCursorClickHandler = null;
        }
        
        if (this.teleportIndicator) {
            this.el.sceneEl.object3D.remove(this.teleportIndicator);
            this.teleportIndicator.material.dispose();
            this.teleportIndicator.geometry.dispose();
            this.teleportIndicator = null;
        }
        
        if (this.collisionMesh) {
            this.collisionMesh.geometry.dispose();
            this.collisionMesh.material.dispose();
            this.collisionMesh = null;
        }
        
        // Clean up cached references
        this.tunnelElement = null;
        this.vrCursor = null;
        this.vrRaycaster = null;
    }
});

// Optimized VR Pinch-to-Teleport Component
AFRAME.registerComponent("pinch-teleport-02", {
    schema: {
        cameraRig: { type: "selector", default: "" },
        collisionEntities: { type: "string", default: ".collision" }
    },

    init() {
        this.debugMode = window.location.search.includes('debug=true');
        if (this.debugMode) console.log("navigation-05: Initializing optimized pinch-teleport");
        
        // Pre-allocate reusable objects
        this.rayCaster = new THREE.Raycaster();
        this.rayCastObjects = [];
        this.handDirection = new THREE.Vector3();
        this.handPosition = new THREE.Vector3();
        
        this.lastCollisionCount = 0;
        this.lastRaycastCount = 0;
        
        this.createTeleportRing();
        this.updateRaycastObjects();

        // Bind methods once
        this.onPinchStarted = this.onPinchStarted.bind(this);
        this.onPinchEnded = this.onPinchEnded.bind(this);

        // Add all event listeners
        const events = ['pinchstarted', 'triggerdown', 'gripdown'];
        const endEvents = ['pinchended', 'triggerup', 'gripup'];
        
        events.forEach(event => this.el.addEventListener(event, this.onPinchStarted));
        endEvents.forEach(event => this.el.addEventListener(event, this.onPinchEnded));
    },

    createTeleportRing() {
        const ringGeometry = new THREE.RingGeometry(0.2, 0.25, 32, 1);
        ringGeometry.rotateX(-Math.PI / 2);
        ringGeometry.translate(0, 0.02, 0);
        
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: "#00ff00",
            transparent: true,
            opacity: 0.8
        });
        
        this.teleportRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.teleportRing.visible = false;
        this.el.sceneEl.object3D.add(this.teleportRing);
    },

    updateRaycastObjects() {
        const previousCount = this.rayCastObjects.length;
        this.rayCastObjects.length = 0;
        
        if (this.data.collisionEntities) {
            const collisionEntities = this.el.sceneEl.querySelectorAll(this.data.collisionEntities);
            
            if (this.debugMode && collisionEntities.length !== this.lastCollisionCount) {
                console.log("navigation-05: Pinch-teleport collision entities:", collisionEntities.length);
                this.lastCollisionCount = collisionEntities.length;
            }
            
            for (let i = 0; i < collisionEntities.length; i++) {
                const entity = collisionEntities[i];
                entity.object3D.traverse((obj) => {
                    if (obj.isMesh) {
                        obj.userData.collision = true;
                        this.rayCastObjects.push(obj);
                    }
                });
            }
        }
        
        if (this.debugMode && this.rayCastObjects.length !== this.lastRaycastCount) {
            console.log("navigation-05: Pinch-teleport raycast objects:", this.rayCastObjects.length);
            this.lastRaycastCount = this.rayCastObjects.length;
        }
    },

    getTeleportPosition() {
        const handObject = this.el.object3D;
        handObject.getWorldPosition(this.handPosition);
        
        // Reuse direction vector
        this.handDirection.set(0, 0, -1).applyQuaternion(handObject.quaternion);
        this.rayCaster.set(this.handPosition, this.handDirection);
        
        const intersects = this.rayCaster.intersectObjects(this.rayCastObjects);
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            if (intersect.object.userData.collision === true) {
                return intersect.point;
            }
        }
        
        return null;
    },

    onPinchStarted(event) {
        if (this.debugMode) console.log("navigation-05: Pinch started:", event.type);
        const teleportPos = this.getTeleportPosition();
        if (teleportPos) {
            this.teleportRing.position.copy(teleportPos);
            this.teleportRing.visible = true;
        }
    },

    onPinchEnded(event) {
        if (this.debugMode) console.log("navigation-05: Pinch ended:", event.type);
        if (this.teleportRing.visible) {
            const teleportPos = this.teleportRing.position.clone();
            this.teleportToCameraRig(teleportPos);
            this.teleportRing.visible = false;
        }
    },

    teleportToCameraRig(position) {
        if (!this.data.cameraRig) return;
        
        if (this.debugMode) console.log("navigation-05: Teleporting to:", position);
        
        const startPos = this.data.cameraRig.object3D.position.clone();
        const endPos = position.clone();
        
        let progress = 0;
        const duration = 500;
        const startTime = performance.now();
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            progress = Math.min(elapsed / duration, 1);
            
            const easedProgress = progress < 0.5 ? 2 * progress * progress : (4 - 2 * progress) * progress - 1;
            this.data.cameraRig.object3D.position.lerpVectors(startPos, endPos, easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.data.cameraRig.object3D.position.copy(endPos);
                if (this.debugMode) console.log("navigation-05: Teleport complete");
            }
        };
        
        animate();
    },

    tick() {
        // Less frequent updates for better performance
        if (!this.lastUpdate || performance.now() - this.lastUpdate > 30000) {
            this.updateRaycastObjects();
            this.lastUpdate = performance.now();
        }
        
        // Update ring position efficiently
        if (this.teleportRing.visible) {
            const teleportPos = this.getTeleportPosition();
            if (teleportPos) {
                this.teleportRing.position.copy(teleportPos);
            } else {
                this.teleportRing.visible = false;
            }
        }
    },

    remove() {
        // Proper cleanup
        if (this.teleportRing) {
            this.el.sceneEl.object3D.remove(this.teleportRing);
            this.teleportRing.material.dispose();
            this.teleportRing.geometry.dispose();
            this.teleportRing = null;
        }

        // Remove all event listeners
        const events = ['pinchstarted', 'triggerdown', 'gripdown', 'pinchended', 'triggerup', 'gripup'];
        events.forEach(event => this.el.removeEventListener(event, this.onPinchStarted));
        events.forEach(event => this.el.removeEventListener(event, this.onPinchEnded));
    }
});

// Optimized click-teleport component
AFRAME.registerComponent("click-teleport-03", {
    schema: {
        cameraRig: { type: "selector", default: "#cameraRig" }
    },

    init() {
        this.debugMode = window.location.search.includes('debug=true');
        
        this.onClick = (event) => {
            if (this.debugMode) console.log("navigation-05: Click-teleport activated");
            
            if (this.data.cameraRig && event.detail.intersection) {
                const teleportPos = event.detail.intersection.point;
                this.data.cameraRig.object3D.position.copy(teleportPos);
                
                this.el.sceneEl.emit("navigation-start");
                setTimeout(() => this.el.sceneEl.emit("navigation-end"), 100);
            }
        };
        
        this.el.addEventListener('click', this.onClick);
    },

    remove() {
        this.el.removeEventListener('click', this.onClick);
    }
});

// Optimized go-to component with better performance
AFRAME.registerComponent("go-to", {
    schema: {
        position: { type: "vec3" },
        rotation: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
        unload: { type: "string", default: "" },
        load: { type: "asset", default: "" },
        duration: { type: "number", default: 2000 },
        easing: { type: "string", default: "easeInOutQuad" },
    },

    init: function () {
        this.rigEl = document.getElementById("cameraRig");
        this.sceneEl = this.el.sceneEl;
        this.debugMode = window.location.search.includes('debug=true');

        // Pre-allocate reusable objects
        this.tempVector3 = new THREE.Vector3();
        this.transitionRotStart = new THREE.Quaternion();
        this.transitionRotEnd = new THREE.Quaternion();

        // Initialize properties
        this.animatingRotation = false;
        this.rotationStartTime = 0;
        this.rotationDuration = this.data.duration;
        
        // Bind methods
        this.onClick = this.onClick.bind(this);
        this.onAnimEnd = this.onAnimEnd.bind(this);
        this.hideTunnel = this.hideTunnel.bind(this);

        this.el.addEventListener("click", this.onClick);
        window.addEventListener("keydown", this.hideTunnel);
    },

    onClick: function (evt) {
        var intersection = evt.detail && evt.detail.intersection;
        if (!intersection) return;

        // Cache tunnel element for performance
        if (!this.tunnelElement) {
            this.tunnelElement = this.sceneEl.querySelector("#tunnel");
        }

        if (this.tunnelElement) {
            this.tunnelElement.removeAttribute("animation__down");
            this.tunnelElement.setAttribute("animation__down", {
                property: "scale.y",
                to: -1,
                dur: 500,
                easing: this.data.easing,
            });
        }

        this.moveCamera();
    },

    moveCamera: function () {
        this.tempVector3.copy(this.rigEl.object3D.position);

        const hasRotation = (Math.abs(this.data.rotation.x) > 0.001) || 
                          (Math.abs(this.data.rotation.y) > 0.001) || 
                          (Math.abs(this.data.rotation.z) > 0.001);

        if (hasRotation) {
            this.transitionRotStart.copy(this.rigEl.object3D.quaternion);
            
            const targetEuler = new THREE.Euler(
                THREE.MathUtils.degToRad(this.data.rotation.x),
                THREE.MathUtils.degToRad(this.data.rotation.y),
                THREE.MathUtils.degToRad(this.data.rotation.z),
                'YXZ'
            );
            this.transitionRotEnd.setFromEuler(targetEuler);

            this.animatingRotation = true;
            this.rotationStartTime = performance.now();
            this.rotationDuration = this.data.duration;
        } else {
            this.animatingRotation = false;
        }

        this.rigEl.removeAttribute("animation__go");
        this.rigEl.setAttribute("animation__go", {
            property: "position",
            dur: this.data.duration,
            easing: this.data.easing,
            from: this.tempVector3.x + " " + this.tempVector3.y + " " + this.tempVector3.z,
            to: this.data.position.x + " " + this.data.position.y + " " + this.data.position.z,
        });

        if (this.debugMode) {
            console.log("go-to: Moving to:", this.data.position);
            if (hasRotation) console.log("go-to: Rotating to:", this.data.rotation);
        }

        this.rigEl.addEventListener("animationcomplete__go", this.onAnimEnd, { once: true });
    },

    onAnimEnd: function () {
        if (this.animatingRotation) {
            this.rigEl.object3D.quaternion.copy(this.transitionRotEnd);
            this.animatingRotation = false;
        }

        var hasReplace = this.data.unload && this.data.load;
        if (hasReplace) {
            var el = document.querySelector(this.data.unload);
            if (el && el.getObject3D("mesh")) {
                this._disposeOldMesh(el.getObject3D("mesh"));
                el.removeObject3D("mesh");
                el.removeAttribute("gltf-model");
                el.setAttribute("gltf-model", this.data.load);
                el.addEventListener("model-loaded", () => {
                    this._tunnelUp();
                    this.rigEl.emit("go-to-complete");
                }, { once: true });
                return;
            }
        }
        
        this._tunnelUp();
        this.rigEl.emit("go-to-complete");
    },

    _disposeOldMesh: function(mesh) {
        // Proper mesh disposal to prevent memory leaks
        mesh.traverse(function (node) {
            if (node.isMesh) {
                if (node.geometry) node.geometry.dispose();
                
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach(function (material) {
                    if (material) {
                        Object.values(material).forEach(function (value) {
                            if (value && value.isTexture) value.dispose();
                        });
                        material.dispose();
                    }
                });
            }
        });
    },

    tick: function(time, deltaTime) {
        if (this.animatingRotation) {
            const currentTime = performance.now();
            const elapsed = currentTime - this.rotationStartTime;
            const progress = Math.min(elapsed / this.rotationDuration, 1.0);

            const easedProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

            this.rigEl.object3D.quaternion.slerpQuaternions(
                this.transitionRotStart, 
                this.transitionRotEnd, 
                easedProgress
            );

            if (progress >= 1.0) {
                this.animatingRotation = false;
                this.rigEl.object3D.quaternion.copy(this.transitionRotEnd);
            }
        }
    },

    _tunnelUp: function () {
        if (this.tunnelElement) {
            this.tunnelElement.removeAttribute("animation__up");
            this.tunnelElement.setAttribute("animation__up", {
                property: "scale.y",
                to: 0.1,
                dur: 500,
                easing: this.data.easing,
            });
        }
    },

    hideTunnel: function() {
        if (this.tunnelElement) {
            this.tunnelElement.setAttribute("visible", false);
        }
    },

    remove: function () {
        this.el.removeEventListener("click", this.onClick);
        window.removeEventListener("keydown", this.hideTunnel);
    }
});

// Optimized save position component
AFRAME.registerComponent("save-position-and-rotation", {
    schema: {},
    init: function () {
        this.debugMode = window.location.search.includes('debug=true');
        if (this.debugMode) console.log("navigation-05: save-position-and-rotation initialized");

        const cameraRig = this.el;
        const head = cameraRig.querySelector("[camera]");

        const recordPositionAndRotation = () => {
            try {
                const position = cameraRig.getAttribute("position");
                const rotation = head.getAttribute("rotation");
                localStorage.setItem("position", JSON.stringify(position));
                localStorage.setItem("rotation", JSON.stringify(rotation));
            } catch (e) {
                if (this.debugMode) console.warn("Failed to save position/rotation:", e);
            }
        };

        this.saveInterval = setInterval(recordPositionAndRotation, 5000); // Less frequent saves
    },

    remove: function() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
    }
});

// Optimized diagnostic functions
const TeleportDiagnostic = {
    run() {
        if (!window.location.search.includes('debug=true')) return; // Only run in debug mode
        
        console.log("=== navigation-05 OPTIMIZED DIAGNOSTIC ===");
        
        const scene = document.querySelector('a-scene');
        const cameraRig = document.querySelector('#cameraRig');
        const vrCursor = document.querySelector('a-cursor');
        const collisionEntities = document.querySelectorAll('.collision');
        
        console.log("Scene:", !!scene, "| CameraRig:", !!cameraRig, "| VRCursor:", !!vrCursor, "| Collisions:", collisionEntities.length);
        
        if (cameraRig?.components['a-cursor-teleport']) {
            const comp = cameraRig.components['a-cursor-teleport'];
            console.log("Teleport Component - VR:", comp.isVR, "| Objects:", comp.rayCastObjects.length, "| Ready:", comp.vrCursorInitialized);
        }
        
        console.log("=== END OPTIMIZED DIAGNOSTIC ===");
    },

    debugCurrentRoom() {
        if (!window.location.search.includes('debug=true')) return;
        
        console.log("=== OPTIMIZED ROOM DEBUG ===");
        const cameraRig = document.querySelector('#cameraRig');
        if (cameraRig?.components['a-cursor-teleport']) {
            const comp = cameraRig.components['a-cursor-teleport'];
            console.log("Collision Objects:", comp.rayCastObjects.length, "| VR Ready:", comp.vrCursorInitialized);
            
            if (comp.rayCastObjects.length === 0) {
                console.warn("NO COLLISION OBJECTS - checking alternatives...");
                ['.collision', '.teleport-surface', 'a-plane'].forEach(sel => {
                    const found = document.querySelectorAll(sel).length;
                    if (found > 0) console.log(`Found ${found} elements with '${sel}'`);
                });
            }
        }
        console.log("=== END ROOM DEBUG ===");
    }
};

// Auto-run diagnostic (debug mode only)
if (window.location.search.includes('debug=true')) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(TeleportDiagnostic.run, 2000));
    } else {
        setTimeout(TeleportDiagnostic.run, 2000);
    }
}

window.TeleportDiagnostic = TeleportDiagnostic;
