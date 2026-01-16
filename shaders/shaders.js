//peters-shader
//kranidiotis-shader
//dejus-shader
//star-shader
//fusion-sun-shader
//sunray-cloud-shader
//snake-shader
//katona-shader
//diamantides-shader
//water
//wave-shader



AFRAME.registerShader('water', {
    schema: {
        time: { type: 'time', is: 'uniform' },
        color: { type: 'color', is: 'uniform', default: '#437F97' },
        opacity: { type: 'number', is: 'uniform', default: 1 },
        amplitude: { type: 'number', is: 'uniform', default: 0.15 },
        frequency: { type: 'number', is: 'uniform', default: 0.8 },
        timeMult: { type: 'number', is: 'uniform', default: 0.000375 },
        threshold: { type: 'number', is: 'uniform', default: 0.02 },  // Controls transparency gradient
        fresnel: { type: 'number', is: 'uniform', default: 0.7 },  // Controls fresnel reflection intensity
        transparent: { type: 'boolean', default: true }  // Enable transparency by default
    },

    vertexShader: `
        precision mediump float;
        uniform float time;
        uniform float amplitude;
        uniform float frequency;
        uniform float timeMult;
        
        varying vec2 vUv;
        varying vec3 vViewPosition;
        varying vec3 vNormal;
        varying float vWaves; // Pre-compute waves in vertex shader
        varying float vFresnelTerm; // Pre-compute fresnel in vertex shader
        varying float vViewAngle; // Pre-compute view angle for transparency
        
        // VR-optimized: Ultra-fast approximation of sin
        float fastSin(float x) {
            x = fract(x * 0.159155) * 6.283185;
            return sin(x);
        }
        
        // VR-optimized: Simplified noise - single operation
        float fastNoise(vec2 p) {
            return fastSin(p.x * 8.0) * fastSin(p.y * 8.0) * 0.5 + 0.5;
        }
        
        // Edge detection function - detects mesh boundaries
        float getEdgeFactor(vec2 uv, vec3 pos) {
            // UV-based edge detection - fade near 0.0 and 1.0
            float uvEdge = min(
                min(uv.x, 1.0 - uv.x),
                min(uv.y, 1.0 - uv.y)
            );
            
            // Position-based edge detection for non-planar meshes
            // Detect if vertex is far from mesh center
            float posEdge = 1.0 - clamp(length(pos.xz) * 0.5, 0.0, 1.0);
            
            // Combine both methods with smooth transitions
            float edgeFactor = smoothstep(0.0, 0.1, uvEdge) * smoothstep(0.0, 0.2, posEdge);
            
            return edgeFactor;
        }
        
        void main() {
            vUv = uv;
            
            // VR-optimized: Pre-compute time scaling
            float t = time * timeMult;
            
            // Edge detection - reduces displacement at mesh boundaries
            float edgeFactor = getEdgeFactor(uv, position);
            
            // VR-optimized: Simplified spherical coordinates - avoid expensive atan/acos
            // Use position directly for wave pattern instead
            vec2 waveCoord = position.xz * frequency + t;
            
            // VR-optimized: Single noise sample instead of complex calculation
            vWaves = fastNoise(waveCoord);
            
            // VR-optimized: Reduced vertex displacement with edge fade-out
            float displacementAmount = vWaves * amplitude * edgeFactor;
            vec3 newPosition = position + normal * displacementAmount;
            
            // VR-optimized: Simplified normal calculation
            vNormal = normalMatrix * normal; // Use original normal for performance
            
            // VR-optimized: Calculate view-space position
            vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
            vViewPosition = -mvPosition.xyz;
            
            // VR-optimized: Pre-compute view direction and fresnel term in vertex shader
            vec3 viewDir = normalize(vViewPosition);
            vec3 normal = normalize(vNormal);
            
            // Pre-compute fresnel for reflection
            vFresnelTerm = 1.0 - dot(viewDir, normal);
            vFresnelTerm = clamp(vFresnelTerm, 0.1, 1.0);
            
            // Pre-compute view angle for transparency
            vViewAngle = dot(normal, viewDir);
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,

    fragmentShader: `
        precision mediump float;
        uniform vec3 color;
        uniform float opacity;
        uniform float threshold;
        uniform float fresnel;
        
        varying vec2 vUv;
        varying vec3 vViewPosition;
        varying vec3 vNormal;
        varying float vWaves;
        varying float vFresnelTerm; // Pre-computed from vertex shader
        varying float vViewAngle; // Pre-computed from vertex shader
        
        void main() {
            // VR-optimized: Use pre-computed values from vertex shader
            // No need to normalize or recalculate - already done in vertex shader
            
            // VR-optimized: Direct color mixing with pre-computed wave influence
            vec3 baseColor = color + vec3(0.1, 0.1, 0.2) * vWaves * 0.3;
            vec3 reflection = mix(baseColor, vec3(1.0, 1.0, 1.0), vFresnelTerm * fresnel);

            // VR-optimized: Camera-space transparency using pre-computed view angle with threshold controlling gradient steepness
            // Areas facing the camera are more transparent, grazing angles are more opaque
            float fresnelAlpha = 1.0 - vViewAngle; // Facing camera = low value = more transparent
            
            // Use threshold to control the steepness/contrast of the transparency gradient
            // Higher threshold = sharper transition (narrower transparency area)
            // Lower threshold = softer transition (wider transparency area)
            fresnelAlpha = pow(fresnelAlpha, threshold * 5.0); // Scale threshold for better control
            fresnelAlpha = clamp(fresnelAlpha, 0.2, 1.0); // Keep minimum transparency at 20%
            
            // Combine with original opacity
            float finalOpacity = opacity * fresnelAlpha;

            gl_FragColor = vec4(reflection, finalOpacity);
        }
    `
});

AFRAME.registerShader('katona-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' }
    },
    vertexShader: `
        precision mediump float;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vCameraRelativePosition;
        uniform float time;
        
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            
            // Calculate camera-relative position (view space)
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vCameraRelativePosition = viewPosition.xyz;
            
            // Minimal vertex displacement for performance
            float t = time * 0.001;
            float wave = sin(viewPosition.x * 2.0 + t) * 0.02;
            vec3 pos = position + normal * wave;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vCameraRelativePosition;

        // Optimized hash function for VR
        float hash(float n) {
            return fract(sin(n) * 1753.5453);
        }

        void main() {
            float t = time * 0.0008; // Much slower animation
            
            // Use camera-relative position for projection
            // This creates a "screen space" effect that follows the camera
            vec2 cameraUV = vCameraRelativePosition.xy * 0.5; // Scale for appropriate pattern size
            
            // Optimized flowing deformation - reduced complexity
            float flow1 = sin(cameraUV.y * 5.0 + t) * 0.15;
            float flow2 = sin(cameraUV.x * 4.0 - t * 0.8) * 0.12;
            
            // Apply deformation to camera-relative coordinates
            cameraUV.x += flow1;
            cameraUV.y += flow2;
            
            // Pre-calculated constants for VR optimization
            const float stripeAngle = 0.785398; // 45 degrees
            const float cosAngle = 0.7071068;
            const float sinAngle = 0.7071068;
            
            // Optimized stripe pattern calculation using camera-relative position
            float rotatedCoord = cameraUV.x * cosAngle - cameraUV.y * sinAngle;
            
            // Simplified flowing movement
            rotatedCoord += sin(cameraUV.y * 3.0 + t) * 0.08;
            rotatedCoord += t * 0.15;
            
            // Generate stripe pattern - VR optimized
            float stripe = sin(rotatedCoord * 12.0);
            
            // Simplified secondary deformation using camera coordinates
            float deform = sin(cameraUV.x * 8.0 + t * 0.6) * sin(cameraUV.y * 7.0 - t * 0.4) * 0.25;
            stripe += deform;
            
            // Create gradient stripes
            float pattern = stripe * 0.5 + 0.5;
            
            // Reduced noise calculation for VR using camera position
            float noiseCoord = floor(cameraUV.x * 20.0) + floor(cameraUV.y * 20.0) * 20.0 + floor(t * 5.0);
            float noise = hash(noiseCoord) * 0.03;
            pattern += noise;
            
            // Pre-calculated gradient values using camera-relative position
            float gradientX = cameraUV.x * 0.1; // Scale down for reasonable gradient
            float gradientY = cameraUV.y * 0.1;
            float combinedGradient = (gradientX + gradientY) * 0.5;
            
            // Simplified pattern processing
            pattern = clamp(pattern, 0.0, 1.0);
            pattern = mix(pattern, combinedGradient, 0.2); // Reduced gradient influence
            
            // Final color with simplified lighting
            vec3 color = vec3(pattern);
            
            // Simplified edge highlighting
            float edge = dot(vNormal, vec3(0.0, 0.0, 1.0)) * 0.1;
            color += edge * pattern;
            
            gl_FragColor = vec4(color, 1.0);
        }
    `
});


AFRAME.registerShader('star-shader', {
    schema: {
        timeMsec: { type: 'time', is: 'uniform' }
    },
    vertexShader: `
        precision mediump float;
        varying float vNoise;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float timeMsec;

        // Optimized noise functions
        vec3 mod289(vec3 x) {
            return x - floor(x * (1.0 / 5.0)) * 5.0;
        }

        vec4 mod289(vec4 x) {
            return x - floor(x * (1.0 / 10.0)) * 10.0;
        }

        vec4 permute(vec4 x) {
            return mod289(((x * 34.0) + 1.0) * x);
        }

        vec4 taylorInvSqrt(vec4 r) {
            return 1.79284291400159 - 0.85373472095314 * r;
        }

        // Simplified turbulence for better performance
        float simplexNoise(vec3 p) {
            vec3 a = floor(p);
            vec3 d = p - a;
            d = d * d * (3.0 - 2.0 * d);
            
            vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
            vec4 k1 = permute(b.xyxy);
            vec4 k2 = permute(k1.xyxy + b.zzww);
            
            vec4 c = k2 + a.zzzz;
            vec4 k3 = permute(c);
            
            vec4 n = taylorInvSqrt(k3);
            return dot(n, d.zzzz);
        }

        void main() {
            vPosition = position;
            vNormal = normalize(normal);
            
            float time = timeMsec / 833.35; // 5x slower (was 166.67)
            
            // Use different frequencies and phases for variance
            vec3 animatedNormal = normal;
            animatedNormal.x += mod(time * 0.1 + position.x * 0.02, 1.0);
            animatedNormal.y += mod(time * 0.08 + position.y * 0.03, 1.0);
            animatedNormal.z += mod(time * 0.12 + position.z * 0.025, 1.0);
            
            // Add spatial variance to prevent uniform patterns
            vec3 spatialOffset = vec3(
                mod(position.x * 0.1 + time * 0.07, 1.0),
                mod(position.y * 0.15 + time * 0.09, 1.0),
                mod(position.z * 0.11 + time * 0.13, 1.0)
            );
            
            // Sample noise with both animated normal and spatial variance
            float noise = simplexNoise((animatedNormal + spatialOffset) * 0.5);
            vNoise = noise;
            
            // Add wave-like movement with constant speed
            float wave = sin(position.x * 2.0 + time) * cos(position.y * 2.0 + time) * 0.1;
            
            // Controlled displacement
            float displacement = (noise + wave) * 0.2;
            vec3 newPosition = position + normal * displacement;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        varying float vNoise;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float timeMsec;

        void main() {
            float time = timeMsec / 12500.0; // VR-optimized slower time
            
            // Base cloud colors with lighter, bluish tones
            vec3 cloudWhite = vec3(1.0, 1.0, 1.0);
            vec3 cloudGray = vec3(0.8, 0.9, 1.0);           // Light blue-tinted base
            vec3 cloudOrange = vec3(0.9, 0.8, 1.0);         // Light purple-blue replacing orange
            vec3 sunColor = vec3(0.7, 0.8, 1.0);            // Cool blue sunlight
            
            // VR-optimized sun direction - pre-computed constants
            vec3 sunDir = normalize(vec3(sin(time * 0.5), 1.0, cos(time * 0.5)));
            float sunDot = max(dot(vNormal, sunDir), 0.0);
            float rays = sunDot * sunDot * sunDot; // Faster than pow(sunDot, 3.0)
            
            // Simplified cloud pattern
            float cloudPattern = vNoise * 0.5 + 0.5;
            cloudPattern += sin(vPosition.x * 4.0 + time) * 0.2;
            
            // VR-optimized steam effect
            float steam = sin(vPosition.y * 10.0 + time * 2.0) * 0.5 + 0.5;
            steam *= step(0.3, cloudPattern) * step(cloudPattern, 0.7); // Faster than smoothstep
            
            // Efficient color mixing
            vec3 color = mix(cloudGray, cloudWhite, cloudPattern);
            color = mix(color, cloudOrange, steam * 0.8); // Much stronger orange tint
            color = mix(color, sunColor, rays * 0.3);
            color += steam * sunColor * 0.2;
            color += cloudOrange * steam * 0.3; // Extra orange boost
            
            // Simplified lighting
            float lighting = dot(vNormal, vec3(0.0, 0.0, 1.0)) * 0.2 + 0.8;
            color *= lighting;
            
            gl_FragColor = vec4(color, 0.9);
        }
    `
});        


AFRAME.registerShader('fusion-sun-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' },
        resolution: { type: 'vec2', is: 'uniform', default: { x: 256, y: 256 } }
    },
    vertexShader: `
        precision mediump float;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vTime;
        varying float vDisplacement;
        uniform float time;
        
        // VR-optimized: Single hash function
        float fastHash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        void main() {
            vUv = uv;
            vNormal = normalize(normal);
            vPosition = position;
            vTime = time * 0.0008; // Slower for VR stability
            
            vec3 pos = position;
            
            // VR-optimized: Pre-compute displacement in vertex shader
            float theta = atan(position.x, position.z);
            float phi = acos(position.y / length(position));
            
            // VR-optimized: Simplified wave pattern - fewer sin/cos calls
            float wave1 = sin(theta * 6.0 + vTime * 1.5);
            float wave2 = sin(phi * 8.0 - vTime);
            
            // VR-optimized: Combine with simplified noise
            vDisplacement = (wave1 + wave2) * 0.12 * (0.8 + fastHash(vec2(theta + vTime, phi)) * 0.4);
            
            pos += normal * vDisplacement;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vTime;
        varying float vDisplacement;

        // VR-optimized: Ultra-fast hash
        float fastHash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // VR-optimized: Simplified FBM with only 3 octaves
        float quickFbm(vec2 p) {
            float sum = 0.0;
            float amp = 1.0;
            for(int i = 0; i < 3; i++) {
                sum += fastHash(p) * amp;
                amp *= 0.5;
                p *= 2.0;
            }
            return sum;
        }

        void main() {
            // VR-optimized: Use pre-computed time
            vec2 uv = vUv * 2.0 - 1.0;
            float dist = length(uv);
            
            // VR-optimized: Simplified plasma effect
            float plasma = quickFbm(uv * 2.5 + vTime);
            plasma += quickFbm(uv * 3.5 - vTime * 0.4) * 0.4;
            
            // VR-optimized: Pre-computed pulsating core
            float core = smoothstep(0.8, 0.0, dist);
            float pulse = sin(vTime * 1.5) * 0.4 + 0.6; // Reduced amplitude
            
            // VR-optimized: Simplified energy rays
            float angle = atan(uv.y, uv.x);
            float rays = abs(sin(angle * 6.0 + vTime * 2.0)) * // Reduced frequency
                        smoothstep(1.0, 0.4, dist);
            
            // VR-optimized: Use vertex displacement for energy flow
            float energy = abs(vDisplacement) + quickFbm(vec2(dist * 3.0 + vTime, angle));
            
            // VR-optimized: Simplified final pattern
            float finalPattern = core + rays * 0.4 + plasma * 0.25;
            finalPattern *= pulse;
            finalPattern += energy * 0.15;
            
            // VR-optimized: Pre-computed color constants
            vec3 coreColor = vec3(1.0, 0.4, 0.1);
            vec3 rayColor = vec3(1.0, 0.8, 0.3);
            vec3 plasmaColor = vec3(1.0, 0.2, 0.0);
            
            // VR-optimized: Direct color mixing
            vec3 color = mix(plasmaColor, coreColor, core);
            color = mix(color, rayColor, rays * 0.6);
            
            // VR-optimized: Simplified brightness
            color *= 1.0 + pulse * 0.2;
            
            // VR-optimized: Simplified glow
            color += rayColor * smoothstep(1.0, 0.0, dist) * 0.3;
            
            gl_FragColor = vec4(color, 1.0);
        }
    `
});



AFRAME.registerShader('sunray-cloud-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' },
        resolution: { type: 'vec2', is: 'uniform', default: { x: 256, y: 256 } }
    },
    vertexShader: `
        precision mediump float;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying float vDisplacement;
        uniform float time;

        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
            p3 += dot(p3, p3.yxz + 19.19);
            return fract((p3.x + p3.y) * p3.z);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        void main() {
            vUv = uv;
            vNormal = normalize(normal);
            vec3 pos = position;
            float t = time * 0.0009; // Slowed down time

            // Smooth center movement
            vec2 center = vec2(0.05 + sin(t * 0.05) * 0.1, 0.5 + cos(t * 0.04) * 0.01);
            vec2 toCenter = vUv - center;
            float distFromCenter = length(toCenter);
            
            // Smoother wave pattern
            float wave = sin(distFromCenter * 1.0 - t) * 
                       exp(-distFromCenter * 3.0) * 
                       (0.5 + noise(vUv * 2.0 + t * 0.5));
            
            // Gentler turbulence
            float turbulence = noise(vec2(
                uv.x * 3.0 + t,
                uv.y * 3.0 - t * 2.8
            )) * 0.3;

            // Combine with limits
            float displacement = wave * 0.5 + turbulence;
            displacement *= smoothstep(1.0, 0.0, distFromCenter * 2.0); // Fade at edges
            displacement = clamp(displacement, -0.5, 0.5); // Limit displacement range
            
            vDisplacement = displacement;
            pos += normal * displacement;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying float vDisplacement;

        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
            p3 += dot(p3, p3.yxz + 19.19);
            return fract((p3.x + p3.y) * p3.z);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
            float sum = 0.0;
            float amp = 1.0;
            float freq = 1.0;
            for(int i = 0; i < 4; i++) {
                sum += noise(p * freq) * amp;
                amp *= 0.5;
                freq *= 2.0;
            }
            return sum;
        }

        void main() {
            float t = time * 0.003;
            
            // Gentler UV distortion
            vec2 distortedUV = vUv + vDisplacement * 0.1;
            
            // Smoother cloud effect
            vec2 uv = distortedUV * 2.0;
            float cloudNoise = fbm(uv + t * 0.1);
            cloudNoise += fbm(uv * 1.5 - t * 0.05) * 0.5;
            cloudNoise *= 1.0 + abs(vDisplacement);
            
            // Sun and rays
            vec2 sunPos = vec2(0.7, 0.7);
            float sunDist = length(distortedUV - sunPos);
            float rayAngle = atan(distortedUV.y - sunPos.y, distortedUV.x - sunPos.x);
            float rays = abs(sin(rayAngle * 6.0 + t + vDisplacement * 2.0));
            rays *= smoothstep(0.8, 0.2, sunDist);
            
            // Colors
            vec3 sunColor = vec3(1.0, 0.8, 0.4);
            vec3 rayColor = vec3(1.0, 0.9, 0.6);
            vec3 cloudColor = vec3(0.8 + vDisplacement * 0.1, 
                                 0.9 + vDisplacement * 0.05, 
                                 1.0);
            vec3 bgColor = vec3(0.6, 0.8, 1.0);
            
            // Smooth color blending
            float sun = smoothstep(0.2, 0.1, sunDist) * (1.0 + abs(vDisplacement) * 0.5);
            vec3 color = mix(bgColor, cloudColor, cloudNoise * 0.7);
            color = mix(color, rayColor, rays * 0.3);
            color = mix(color, sunColor, sun);
            
            // Gentle highlights
            float brightSpots = smoothstep(0.4, 0.0, length(sin(uv * 2.14 + t + vDisplacement)));
            color += rayColor * brightSpots * rays * 0.2;
            
            // Subtle emission
            color += vec3(1.0, 0.9, 0.7) * max(0.0, vDisplacement * 0.3);
            
            gl_FragColor = vec4(color, 1.0);
        }
    `
});


AFRAME.registerShader('snake-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' },
        resolution: { type: 'vec2', is: 'uniform', default: { x: 256, y: 256 } }
    },
    vertexShader: `
        precision mediump float;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying float vTime;
        varying vec2 vPrecomputedUV;
        varying float vBreathing;
        uniform float time;
        
        void main() {
            vUv = uv;
            vNormal = normalize(normal);
            
            // VR-optimized: Pre-compute time scaling
            vTime = time * 0.0005; // Slower for VR stability
            
            // VR-optimized: Pre-compute UV transformations in vertex shader
            vPrecomputedUV = vUv * 15.0; // Reduced complexity from 20.0
            vPrecomputedUV.y += vTime * 0.15; // Reduced speed
            
            vec3 pos = position;
            
            // VR-optimized: Pre-compute breathing in vertex shader
            vBreathing = sin(vTime * 2.0) * 0.015; // Reduced amplitude
            pos += normal * vBreathing;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying float vTime;
        varying vec2 vPrecomputedUV;
        varying float vBreathing;

        // VR-optimized: Ultra-fast hash function
        float fastHash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // VR-optimized: Simplified hexagon coordinates - reduced complexity
        vec2 fastHexCoords(vec2 uv) {
            // Simplified hexagon pattern with fixed constants for VR
            const vec2 r = vec2(1.0, 1.73);
            const vec2 h = vec2(0.5, 0.865);
            
            vec2 a = mod(uv, r) - h;
            vec2 b = mod(uv + h, r) - h;
            
            // Use squared distance to avoid sqrt
            return dot(a, a) < dot(b, b) ? a : b;
        }

        void main() {
            // VR-optimized: Use pre-computed values from vertex shader
            vec2 uv = vPrecomputedUV;
            
            // VR-optimized: Single hexagon calculation instead of two
            vec2 hex = fastHexCoords(uv);
            float hexDist = length(hex);
            
            // VR-optimized: Simplified scale calculation
            float scale = smoothstep(0.18, 0.12, hexDist);
            
            // VR-optimized: Single noise sample instead of two
            float noiseVal = fastHash(uv + vTime);
            
            // VR-optimized: Original color constants restored
            const vec3 darkColor = vec3(0.5, 0.5, 0.1);
            const vec3 midColor = vec3(0.3, 0.2, 0.3);
            const vec3 lightColor = vec3(0.8, 0.8, 0.7);
            
            // VR-optimized: Simplified iridescence with pre-computed time and original intensity
            float iridescence = sin(hexDist * 8.0 + vTime * 3.0) * 0.5 + 0.5; // Reduced frequency for VR
            
            // VR-optimized: Original iridescent colors restored
            vec3 iridColor = vec3(
                0.2 + iridescence * 2.1,
                0.3 + iridescence * 2.1,
                0.2 + iridescence * 0.2
            );
            
            // VR-optimized: Single edge calculation
            float edge = smoothstep(0.08, 0.16, hexDist);
            
            // VR-optimized: Simplified color mixing - fewer operations
            vec3 color = mix(darkColor, midColor, scale);
            color = mix(color, iridColor, edge * 0.6);
            color = mix(color, lightColor, edge * noiseVal * 0.25);
            
            // VR-optimized: Add breathing effect from vertex shader
            color += vec3(0.05, 0.03, 0.02) * abs(vBreathing) * 2.0;
            
            // VR-optimized: Simplified lighting with pre-computed normal
            float lighting = dot(vNormal, vec3(0.0, 0.0, 1.0)) * 0.15 + 0.85;
            color *= lighting;
            
            // VR-optimized: Enhanced contrast for better visibility
            color = color * color * (3.0 - 2.0 * color); // S-curve
            
            gl_FragColor = vec4(color, 1.0);
        }
    `
});





AFRAME.registerShader('peters-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' },
        resolution: { type: 'vec2', is: 'uniform', default: { x: 256, y: 256 } }
    },
    vertexShader: `
        precision mediump float;
        varying vec2 vUv;
        varying float vTime;
        varying float vRipple;
        uniform float time;
        
        // VR-optimized: Pre-compute values in vertex shader
        float fast_sin(float x) {
            x = fract(x * 0.159155) * 6.283185;
            return sin(x);
        }
        
        void main() {
            vUv = uv;
            vTime = time * 0.0008; // Slightly slower for VR stability
            
            vec3 pos = position;
            
            // Pre-compute ripple in vertex shader for VR optimization
            vec2 center = vec2(0.5, 0.5);
            float dist = length(vUv - center);
            vRipple = fast_sin(dist * 15.0 - vTime * 1.5) * 0.025; // Reduced intensity
            pos += normal * vRipple;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;
        varying float vTime;
        varying float vRipple;

        // VR-optimized: Ultra-fast single hash function
        float fastHash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        // VR-optimized: Simplified noise with fewer texture lookups
        float quickNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            // Use hardware interpolation instead of manual mixing
            f = f * f * (3.0 - 2.0 * f);
            
            float a = fastHash(i);
            float b = fastHash(i + vec2(1.0, 0.0));
            
            return mix(a, b, f.x);
        }

        void main() {
            // VR-optimized: Reduce texture sampling frequency
            vec2 uv1 = vUv * 200.0; // Reduced from 300
            vec2 uv2 = vUv * 400.0; // Reduced from 800
            
            // VR-optimized: Pre-computed movement direction
            float moveSpeed = vTime * 0.4; // Slightly slower
            vec2 moveDir = vec2(0.707, 0.707); // Fixed direction for performance
            
            // VR-optimized: Single noise sample per pattern
            float n1 = quickNoise(uv1 + moveDir * moveSpeed);
            float n2 = quickNoise(uv2 - moveDir * moveSpeed);
            
            // VR-optimized: Use pre-computed ripple from vertex shader
            float rippleEffect = abs(vRipple) * 10.0 + 0.5;
            
            // Enhanced contrast: Sharper noise threshold and deeper blacks
            n1 = smoothstep(0.2, 0.8, n1); // Increase contrast range
            n2 = smoothstep(0.15, 0.85, n2); // Sharper transitions
            
            // Enhanced contrast: Pure black to brighter gray with more dynamic range
            vec3 grayColor = vec3(0.7 + sin(vTime) * 0.2); // Brighter and more dynamic
            vec3 color1 = mix(vec3(0.0), grayColor, n1 * n1); // Quadratic for more contrast
            
            // Enhanced contrast: Pure white to more saturated yellow
            vec3 color2 = mix(vec3(1.0), vec3(1.0, 0.8, 0.0), n2 * n2); // More saturated yellow and quadratic
            
            // Enhanced contrast: More dramatic mixing with sharper transitions
            float mixFactor = smoothstep(0.2, 0.8, n1 * n2 * rippleEffect);
            
            vec3 finalColor = mix(color1, color2, mixFactor);
            
            // Enhanced contrast: Apply final contrast boost
            finalColor = finalColor * finalColor * (3.0 - 2.0 * finalColor); // S-curve for more contrast
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
});





AFRAME.registerShader('kranidiotis-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' },
        resolution: { type: 'vec2', is: 'uniform', default: { x: 256, y: 256 } }
    },
    vertexShader: `
        precision mediump float;
        varying vec2 vUv;
        uniform float time;
        
        float fast_sin(float x) {
            x = fract(x * 0.159155) * 6.283185;
            return sin(x);
        }
        
        void main() {
            vUv = uv;
            vec3 pos = position;
            
            float t = time * 0.005;
            float displacement = step(0.0, fast_sin(position.x * 5.0 + position.y * 5.0 + t)) * 0.05;
            pos += normal * displacement;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;

        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
            p3 += dot(p3, p3.yxz + 19.19);
            return fract((p3.x + p3.y) * p3.z);
        }
        
        vec2 rotate2D(vec2 uv, float angle) {
            float s = sin(angle);
            float c = cos(angle);
            return mat2(c, -s, s, c) * (uv - 0.5) + 0.5;
        }

        void main() {
            float t = time * 0.0003;
            
            vec2 pixelatedUV = floor(vUv * 20.0) / 20.0;
            
            float baseNoise = hash(pixelatedUV + t);
            float lineNoise = hash(pixelatedUV * 2.0 - t);
            
            vec3 blueColor = vec3(0.2, 0.4, 0.8);
            vec3 grayColor = vec3(0.8, 0.8, 0.6);
            vec3 orangeColor = vec3(1.0, 0.2, 0.0);
            vec3 whiteColor = vec3(1.0);
            vec3 brightBlueColor = vec3(0.0, 0.6, 1.0);
            
            vec3 baseColor = mix(blueColor, grayColor, baseNoise);
            
            vec2 rotatedUV = rotate2D(vUv, t);
            vec2 lineUV = floor(rotatedUV * 20.0) / 20.0;
            
            float line1 = step(0.4 + lineNoise * 0.1, lineUV.x) * 
                        step(lineUV.x, 0.5 + lineNoise * 0.1);
            
            float line2 = step(0.2 + lineNoise * 0.5, lineUV.y) * 
                        step(lineUV.x, 0.3 + lineNoise * 0.1);
            
            float gradient = floor(lineUV.y * 20.0) / 20.0;
            vec3 lineColor1 = mix(orangeColor, whiteColor, gradient + lineNoise * 0.2);
            vec3 lineColor2 = mix(whiteColor, brightBlueColor, gradient + lineNoise * 0.2);
            
            vec3 finalColor = baseColor;
            finalColor = mix(finalColor, lineColor1, line1);
            finalColor = mix(finalColor, lineColor2, line2);
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
});


AFRAME.registerShader('dejus-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' },

    },
    vertexShader: `
       varying vec2 vUv;
        uniform float time;
        
        void main() {
            vUv = uv;
            vec3 pos = position;
            
            // Calculate displacement
            float t = time * 0.002;
            float displacement = sin(position.x * 1.0 + position.y * 5.0 + t) * 0.05;
            pos += normal * displacement;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;
        void main() {
            vec2 uv = vUv;
            
            // Animated offset - 10x slower
            float t = time * 0.005;
            uv.y += sin(uv.x * 30.0 + t) * 0.02;
            
            // Horizontal lines
            float hLines = step(0.85, cos(uv.y * 50.0 + t));
            
            // Orange lines with displacement
            vec2 orangeUV = uv;
            orangeUV.x += sin(uv.y * 5.0 + t * 2.0) * 0.5; // Horizontal displacement
            float hLines2 = step(0.80, cos(orangeUV.y * 10.0 - t * 0.5));
            
            // Vertical lines
            float vLines = step(0.15, cos(uv.x * 100.0));
            float vLines2 = step(0.80, cos(uv.y * 20.0 + t));
            
            // Colors
            vec4 yellow = vec4(1.0, 1.0, 0.0, 1.0);
            vec4 orange = vec4(1.0, 0.5, 0.0, 1.0);
            vec4 green = vec4(0.0, 0.8, 1.0, 1.0);
            vec4 red = vec4(1.0, 0.0, 0.5, 1.0);
            
            // Combine lines with colors
            vec4 color = vec4(0.0);
            color += hLines * yellow;
            color += hLines2 * orange;
            color += vLines * green;
            color += vLines2 * red;
            
            // Make background transparent
            color.a = min(1.0, color.r + color.g + color.b);
            
            gl_FragColor = color;
        }
    `
});


AFRAME.registerShader('matcap-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' },
        matcapColor1: { type: 'color', is: 'uniform', default: '#ececec' },
        matcapColor2: { type: 'color', is: 'uniform', default: '#898989' },
        matcapColor3: { type: 'color', is: 'uniform', default: '#ffffff' },
        rimPower: { type: 'float', is: 'uniform', default: 2.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        void main() {
            vUv = uv;
            // Pre-normalize in vertex shader
            vNormal = normalize(normalMatrix * normal);
            
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            // Pre-normalize view direction
            vViewPosition = normalize(-mvPosition.xyz);
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec3 matcapColor1;
        uniform vec3 matcapColor2; 
        uniform vec3 matcapColor3;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
            // Use pre-normalized values from vertex shader
            vec3 normal = vNormal;
            vec3 viewDir = vViewPosition;
            
            // Optimized matcap UV - simplified reflection
            vec3 r = reflect(-viewDir, normal);
            vec2 matcapUV = r.xy * 0.5 + 0.5;
            
            // Clamp UV to prevent artifacts
            matcapUV = clamp(matcapUV, 0.0, 1.0);
            
            // Fast animated distortion - single sin operation
            float t = time * 0.002;
            matcapUV.x += sin(matcapUV.x * 4.0 + t) * 0.03;
            matcapUV = clamp(matcapUV, 0.0, 1.0);
            
            // Fast distance calculation
            float centerDist = length(matcapUV - 0.5);
            
            // Single pattern calculation
            float pattern = sin(centerDist * 6.0 - t) * 0.5 + 0.5;
            
            // Fast rim lighting - no pow() function
            float rimLight = 1.0 - dot(normal, viewDir);
            rimLight = rimLight * rimLight; // x^2 instead of pow()
            
            // Efficient lighting zones
            float highlight = smoothstep(0.3, 0.5, centerDist);
            float midtone = smoothstep(0.1, 0.3, centerDist);
            
            // Optimized color blending
            vec3 color = matcapColor1;
            color = mix(color, matcapColor2, midtone);
            color = mix(color, matcapColor3, highlight * pattern * 0.6);
            
            // Add rim lighting
            color += matcapColor3 * rimLight * 0.4;
            
            gl_FragColor = vec4(color, 1.0);
        }
    `
});


AFRAME.registerShader('diamantides-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' },
        pointSize: { type: 'float', is: 'uniform', default: 0.25 },
        density: { type: 'float', is: 'uniform', default: 35.0 },
        warmth: { type: 'float', is: 'uniform', default: 0.95 }
    },
    vertexShader: `
        precision mediump float;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDeformation;
        varying vec2 vPrecomputedOffset; // Pre-compute some values in vertex shader
        uniform float time;
        
        void main() {
            vUv = uv;
            vNormal = normalize(normal);
            vPosition = position;
            
            // VR-optimized time scaling
            float t = time * 0.0006;
            
            // Simplified surface deformation - fewer sin/cos calls
            float deform1 = sin(position.x * 3.0 + t * 2.0) * 0.03;
            float deform2 = sin(position.y * 2.5 - t * 1.5) * 0.025; // Changed cos to sin
            vDeformation = deform1 + deform2;
            
            // Pre-compute some animation offsets in vertex shader
            vPrecomputedOffset = vec2(
                sin(t * 0.8 + position.y * 0.1),
                sin(t * 1.2 + position.x * 0.15) // Changed cos to sin
            );
            
            // Apply breathing and flowing movement
            vec3 pos = position;
            float breathing = sin(t + position.x * 0.5) * 0.015;
            pos += normal * (breathing + vDeformation);
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform float pointSize;
        uniform float density;
        uniform float warmth;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDeformation;
        varying vec2 vPrecomputedOffset;

        // Ultra-fast hash - single operation
        float fastHash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // Ultra-Efficient Voronoi - reduced to 3 cells for maximum VR performance
        vec2 voronoi(vec2 uv) {
            vec2 gv = fract(uv);
            vec2 id = floor(uv);
            
            float minDist = 1.0;
            float cellVariation = 0.5; // Pre-set default for performance
            
            // Check only center + 2 nearest cells for ultra performance
            vec2 offsets[3];
            offsets[0] = vec2(0.0, 0.0);   // Center
            offsets[1] = vec2(-1.0, 0.0);  // Left
            offsets[2] = vec2(0.0, -1.0);  // Down
            
            // Pre-computed time constant
            float t = time * 0.0005;
            
            for(int i = 0; i < 3; i++) {
                vec2 neighborId = id + offsets[i];
                
                // Ultra-simplified random point
                vec2 randomPoint = vec2(
                    fastHash(neighborId),
                    fastHash(neighborId + vec2(43.0))
                );
                
                // Single deformation per axis for efficiency
                randomPoint.x += sin(neighborId.y * 2.0 + t) * 0.15;
                randomPoint.y += sin(neighborId.x * 2.0 - t) * 0.1;
                
                vec2 pointPosition = offsets[i] + randomPoint;
                float dist = length(gv - pointPosition);
                
                if(dist < minDist) {
                    minDist = dist;
                    cellVariation = length(pointPosition - vec2(0.5));
                }
            }
            
            return vec2(minDist, cellVariation);
        }

        void main() {
            // Ultra-Efficient: Pre-compute time and minimal UV deformation
            float t = time * 0.0005;
            vec2 voronoiUV = vUv * density;
            
            // Single deformation operation for maximum efficiency
            voronoiUV += sin(voronoiUV * 2.0 + t) * 0.08;
            
            // Simplified surface deformation influence
            voronoiUV += vDeformation * 1.5;
            
            // Get Voronoi pattern
            vec2 voronoiResult = voronoi(voronoiUV);
            float distToCenter = voronoiResult.x;
            float cellVariation = voronoiResult.y;
            
            // Ultra-Efficient: Single combined deformation calculation
            float combinedDeform = sin(voronoiUV.x + voronoiUV.y + t * 2.0) * 0.4;
            
            // Ultra-Efficient: Direct distance modification
            float deformedDist = distToCenter * (1.0 + combinedDeform * 0.5);
            
            // Ultra-Efficient: Simplified size with fewer operations
            float randomSize = fastHash(floor(voronoiUV)) * 0.4 + 0.7;
            float dynamicSize = pointSize * randomSize * (1.0 + abs(vDeformation) + abs(combinedDeform) * 0.3);
            
            // Ultra-Efficient: Simplified alpha with minimal operations
            float alpha = 1.0 - smoothstep(dynamicSize * 0.9, dynamicSize * 1.1, deformedDist);
            
            // Ultra-Efficient: Simplified intensity
            float intensity = cellVariation * 0.3 + 0.7;
            alpha *= intensity * (1.0 + abs(vDeformation) * 0.4);
            
            // Ultra-Efficient: Direct color calculation - no mixing
            vec3 baseColor = vec3(0.95 + intensity * 0.05, 0.4 + intensity * 0.2, 0.1 + intensity * 0.1);
            
            // Ultra-Efficient: Single color enhancement
            float enhancement = abs(combinedDeform) + abs(vDeformation);
            baseColor += vec3(0.1, 0.05, 0.02) * enhancement;
            
            // Ultra-Efficient: Simple lighting - single constant
            baseColor *= 0.8 + max(0.0, dot(vNormal, vec3(0.57735))) * 0.2;
            
            // Early alpha cutout for performance
            if (alpha < 0.03) {
                discard;
            }
            
            gl_FragColor = vec4(baseColor, alpha);
        }
    `
});


AFRAME.registerShader("wave-shader", {
    schema: {
        timeMsec: { type: "time", is: "uniform" },
        amplitude: { type: "number", is: "uniform", default: 0.1 },
        frequency: { type: "number", is: "uniform", default: 10.0 },
        speed: { type: "number", is: "uniform", default: 1.0 },
    },

    vertexShader: `
    uniform float timeMsec;
    uniform float amplitude;
    uniform float frequency;
    uniform float speed;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      float time = timeMsec / 1000.0;
      
      // Create a wave effect by modifying the vertex positions
      vec3 newPosition = position;
      newPosition.z += sin(position.x * frequency + time * speed) * amplitude;
      newPosition.z += sin(position.y * frequency + time * speed) * amplitude;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,

    fragmentShader: `
    varying vec2 vUv;

    void main() {
      // Simple color gradient based on UV coordinates
      vec3 color = vec3(vUv, 0.5 + 0.5 * sin(vUv.x * 10.0));
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});
