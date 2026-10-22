const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 845, height: 767 } });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
    const result = await page.evaluate(async () => {
      const THREE = await import('three');
      const { createTokyoFlight } = await import('/tokyo-flight.js');
      const renderer = new THREE.WebGLRenderer();
      const earthGroup = new THREE.Group();
      const flight = await createTokyoFlight({ renderer, earthGroup, radius: 1.22, location: { lat: 35.6762, lon: 139.6503 } });
      flight.setOpacity(1); flight.setProgress(2);
      const cloud = earthGroup.getObjectByName('tokyo-cloud-bank');
      if (!cloud) throw new Error('The cloud must exist above Tokyo in the 3D scene');
      const cloudLayer = earthGroup.getObjectByName('tokyo-city-clouds');
      if (!cloudLayer || cloudLayer.children.length !== 1) throw new Error('Clouds should form one connected weather field');
      if (cloud.scale.x < .03 || cloud.scale.y < .025) throw new Error('The cloud field must cover the surrounding approach area');
      const volume = cloud.material.uniforms.cloudMap.value.image;
      let clear = 0, dense = 0, wispy = 0;
      for (let y = 24; y < volume.height - 24; y++) {
        for (let x = 24; x < volume.width - 24; x++) {
          let column = 0;
          for (let z = 0; z < volume.depth; z++) column += volume.data[(x + y * volume.width + z * volume.width * volume.height) * 2];
          const average = column / volume.depth;
          if (average < 2) clear++;
          else if (average < 20) wispy++;
          else dense++;
        }
      }
      if (!clear || !dense || !wispy) throw new Error('Weather field needs clear openings, thin wisps and denser connected banks');
      for (let z = 0; z < volume.depth; z++) {
        if (volume.data[z * volume.width * volume.height * 2] !== 0) throw new Error('Cloud density must taper away at the field boundary');
      }
      for (const mesh of cloudLayer.children) {
        if (mesh.geometry.type !== 'BoxGeometry' || !mesh.material.uniforms?.cloudMap?.value.isData3DTexture) throw new Error('Clouds need volume density, rather than flat repeated pictures');
      }
      flight.update(0);
      const beforeDrift = cloud.position.clone();
      flight.update(60);
      if (cloud.position.distanceTo(beforeDrift) <= 0 || cloud.position.distanceTo(beforeDrift) > .0003) throw new Error('Clouds should drift slowly above their neighborhood');
      flight.update(0);
      flight.setProgress(8);
      if (earthGroup.getObjectByName('tokyo-aerial-8').material.opacity !== 1) throw new Error('Regional imagery must replace the magnified globe before the city approach');
      cloud.updateWorldMatrix(true, false);
      const cloudPosition = cloud.getWorldPosition(new THREE.Vector3());
      const normal = cloudPosition.clone().normalize();
      const camera = new THREE.PerspectiveCamera(38, 845 / 767, .000001, 100);
      function projectedWidth(altitude) {
        camera.position.copy(normal).multiplyScalar(1.22 + altitude);
        camera.lookAt(normal); camera.updateMatrixWorld();
        cloud.updateWorldMatrix(true, false);
        const edge = new THREE.Vector3(cloud.geometry.parameters.width / 2, 0, 0);
        return edge.clone().applyMatrix4(cloud.matrixWorld).project(camera).distanceTo(edge.negate().applyMatrix4(cloud.matrixWorld).project(camera)) * 845 / 2;
      }
      const farPixels = projectedWidth(2);
      const nearPixels = projectedWidth(.0002);
      const farOpacity = cloud.material.uniforms.opacity.value;
      flight.setProgress(11.5);
      const middleOpacity = cloud.material.uniforms.opacity.value;
      if (!(middleOpacity > 0 && middleOpacity < 1)) throw new Error('The cloud field should ease into view during the city approach');
      flight.setProgress(16);
      const nearOpacity = cloud.material.uniforms.opacity.value;
      flight.setProgress(11.5);
      if (cloud.material.uniforms.opacity.value !== middleOpacity) throw new Error('Departure should reverse the same smooth distance fade');
      flight.setProgress(8);
      if (cloudLayer.visible || earthGroup.getObjectByName('tokyo-cloud-shadows').visible) throw new Error('Hide cloud and shadow footprints together during pullback');
      return { farPixels, nearPixels, farOpacity, nearOpacity, height: cloudPosition.length() - 1.22 };
    });
    assert.ok(result.farPixels < 25, 'The cloud field must remain local to Tokyo');
    assert.ok(result.nearPixels > 845, 'Approaching the same cloud must fill the view');
    assert.equal(result.farOpacity, 0, 'Hide the footprint before it fills the city view');
    assert.equal(result.nearOpacity, 1, 'Keep the cloud field fully present through the close approach');
    assert.ok(result.height > 0 && result.height < .001, 'Cloud belongs above the surface');
    console.log('PASS: persistent cloud depth and perspective', result);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
