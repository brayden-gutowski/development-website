import * as THREE from 'three';

// Native-speed photographic far field, with a continuous sky above the footage.
export function createTokyoExterior(texture, camera, time = { value: 0 }) {
  const group = new THREE.Group(); group.name = 'Tokyo exterior';
  const filmedHeight = 86;
  const geometry = new THREE.PlaneGeometry(filmedHeight*16/9,300);
  // Preserve the film's aspect; smaller angular scale gives the skyline distance.
  const uv = geometry.attributes.uv;
  for (let i=0;i<uv.count;i++) uv.setY(i,uv.getY(i)*300/filmedHeight);
  const material = new THREE.MeshBasicMaterial({
    map:texture,fog:false,toneMapped:false,color:0xffffff,
  });
  const westernBlend={value:0};
  material.onBeforeCompile = shader => {
    shader.uniforms.fogTime = time;
    shader.uniforms.westernBlend=westernBlend;
    shader.fragmentShader = `
      uniform float fogTime,westernBlend;
      float fogHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float fogNoise(vec2 p) {
        vec2 cell = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(fogHash(cell), fogHash(cell + vec2(1, 0)), f.x),
          mix(fogHash(cell + vec2(0, 1)), fogHash(cell + vec2(1, 1)), f.x), f.y);
      }
      float flyingSand(vec2 uv,float density,float speed,float seed){
        vec2 p=uv*vec2(density,density*.55);
        p+=vec2(-fogTime*speed*density,fogTime*speed*density*.045);
        p.y+=sin(uv.x*12.+fogTime*1.4+seed)*.45;
        vec2 cell=floor(p),local=fract(p);
        vec2 center=vec2(.35+.3*fogHash(cell+seed),.2+.6*fogHash(cell+seed+17.));
        vec2 d=local-center;d.y+=d.x*.11;
        vec2 aa=max(fwidth(p)*.7,vec2(.001));
        float streak=(1.-smoothstep(.25,.25+aa.x,abs(d.x)))
          *(1.-smoothstep(.028,.028+aa.y,abs(d.y)));
        return streak*step(.72,fogHash(cell+seed+39.));
      }
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      // Blend from the actual sky edge into a warm horizon and cooler upper air.
      // No stretched rows of video, hard seam, or oversized foreground towers.
      vec3 horizonSky = vec3(.66, .62, .57);
      vec3 upperSky = vec3(.24, .34, .48);
      float elevation = max(vMapUv.y - .96, 0.0);
      vec3 sky = mix(horizonSky, upperSky, 1.0 - exp(-elevation * 1.7));
      float wisps = sin(vMapUv.x * 15.0 + elevation * 6.0 + fogTime * .007) * sin(elevation * 24.0 + vMapUv.x * 4.0);
      sky += vec3(.02, .017, .014) * smoothstep(.15, .8, wisps) * exp(-elevation * 2.0);
      vec3 city = diffuseColor.rgb;
      // Subtle evening adaptation, while preserving traffic lights and facades.
      city *= vec3(1.48, 1.39, 1.28);
      vec3 view = mix(city, sky, smoothstep(.96, 1.075, vMapUv.y));
      // Broad, overlapping banks drift very slowly across the actual footage.
      // The distant skyline carries denser mist; nearby facades keep detail.
      vec2 wind = vec2(fogTime * .003, -fogTime * .0007);
      vec2 p = vMapUv * vec2(5.0, 2.8) - wind;
      float banks = fogNoise(p) * .6 + fogNoise(p * 2.03 + 13.7) * .28 + fogNoise(p * 4.1) * .12;
      float distanceHaze = mix(.12, .32, smoothstep(.1, .95, vMapUv.y));
      float movingMist = smoothstep(.2, .8, banks) * .14;
      float fog = (distanceHaze + movingMist) * (1.0 - smoothstep(1.08, 1.7, vMapUv.y));
      vec3 fogColor = mix(vec3(.68, .63, .56), horizonSky, .45);
      diffuseColor.rgb = mix(view, fogColor, fog);
      if(westernBlend>0.){
        // Keep the actual city behind the storm. All layers are drawn on the
        // exterior, so the room, curtains and window frame naturally occlude it.
        vec3 western=diffuseColor.rgb*vec3(1.12,.94,.76)+vec3(.025,.009,0.);
        vec2 gustUV=vMapUv*vec2(6.,4.)-vec2(fogTime*.23,fogTime*.025);
        gustUV+=vec2(sin(vMapUv.y*13.-fogTime*.7)*.16,sin(vMapUv.x*9.+fogTime*.9)*.08);
        float gust=fogNoise(gustUV)*.7+fogNoise(gustUV*2.1+8.3)*.3;
        float dust=.12+smoothstep(.22,.82,gust)*.20;
        western=mix(western,vec3(.64,.46,.27),dust);
        // Two depths of fast sideways grains, with antialiased short trails.
        float distant=flyingSand(vMapUv,220.,.13,13.7);
        float nearby=flyingSand(vMapUv,95.,.29,41.3);
        western=mix(western,vec3(.83,.66,.40),distant*.42);
        western=mix(western,vec3(.95,.78,.49),nearby*.76);
        diffuseColor.rgb=mix(diffuseColor.rgb,western,westernBlend);
      }
    `);
  };
  material.customProgramCacheKey = () => 'tokyo-spin-city-sandstorm-v1';
  const horizon = new THREE.Mesh(geometry,material);
  horizon.name = 'Tokyo apartment view';
  // Keep the footage parallel to the camera's initial image plane. Putting it
  // parallel to the window wall foreshortened the city and stretched its pixels.
  horizon.quaternion.copy(camera.quaternion);
  const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const sightline = new THREE.Vector3(4.65,2.4,4.6).sub(camera.position).normalize();
  const filmedHorizon = -150 + .94*filmedHeight;
  horizon.position.copy(camera.position).addScaledVector(sightline,250).addScaledVector(up,-filmedHorizon);
  group.add(horizon);
  return {
    group,horizon,
    get blend(){return westernBlend.value;},
    update(dt,playing,reducedMotion){
      const target=playing&&!document.hidden?1:0;
      westernBlend.value=reducedMotion?target:THREE.MathUtils.damp(westernBlend.value,target,4.5,Math.min(dt,.1));
      if(Math.abs(westernBlend.value-target)<.002)westernBlend.value=target;
    },
    reset(){westernBlend.value=0;},
  };
}
