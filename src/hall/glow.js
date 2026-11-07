// Soft light around lamps: camera-facing quads, added on top of the scene.
// They fade with their own fog so far lamps don't shine through the haze. A fogScale
// below 1 lets a light carry further, as the mihrab's does down the whole nave.
// `fixed` quads face down the hall instead of the camera, like light spilling onto a wall
// (a camera-facing quad tilts into a wall it sits against as soon as you look up).
// `near` fades a glow out as you come close, between two distances in metres.
import * as THREE from 'three';

export class Glow {
  constructor(max, { color, intensity, fog, fogScale = 1, fixed = false, near = [-1, 0] }) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.attributes.position);
    this.data = new Float32Array(max * 4);
    this.attr = new THREE.InstancedBufferAttribute(this.data, 4); // x, y, z, size
    this.geometry.setAttribute('offset', this.attr);
    this.geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({
      defines: fixed ? { FIXED: '' } : {},
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uIntensity: { value: intensity },
        uFog: { value: fog * fogScale },
        uNear: { value: new THREE.Vector2(...near) },
      },
      vertexShader: /* glsl */`
        attribute vec4 offset;
        uniform float uFog;
        uniform vec2 uNear;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          #ifdef FIXED
            vec4 mv = modelViewMatrix * vec4(offset.xyz + vec3(position.xy * offset.w, 0.0), 1.0);
          #else
            vec4 mv = modelViewMatrix * vec4(offset.xyz, 1.0);
            mv.xy += position.xy * offset.w;
          #endif
          gl_Position = projectionMatrix * mv;
          vUv = position.xy * 2.0;
          float f = -mv.z * uFog;
          vFade = exp(-f * f) * smoothstep(uNear.x, uNear.y, -mv.z);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          float r2 = dot(vUv, vUv);
          if (r2 > 1.0) discard;
          float a = exp(-r2 * 5.0) * (1.0 - r2);
          gl_FragColor = vec4(uColor * (a * vFade * uIntensity), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }));
    this.fogScale = fogScale;
    this.mesh.frustumCulled = false; // the quads move in the shader; the base quad's bounds mean nothing
  }

  /** Brightness, and the haze it fades in (the fog density of the moment). */
  setStrength(intensity) {
    this.mesh.material.uniforms.uIntensity.value = intensity;
  }

  setFog(fog) {
    this.mesh.material.uniforms.uFog.value = fog * this.fogScale;
  }

  set(i, x, y, z, size) {
    this.data.set([x, y, z, size], i * 4);
  }

  commit(n) {
    this.geometry.instanceCount = n;
    this.attr.needsUpdate = true;
  }
}
