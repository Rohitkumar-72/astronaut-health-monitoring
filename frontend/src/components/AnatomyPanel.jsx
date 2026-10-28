import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import RiskBadge from "./RiskBadge";

const BODY_REGIONS = [
  { id: "overview", label: "Overview" },
  { id: "head", label: "Head" },
  { id: "chest", label: "Chest" },
  { id: "abdomen", label: "Abdomen" },
  { id: "arms", label: "Arms" },
  { id: "legs", label: "Legs" },
];

const SKIN_BASE_COLOR = new THREE.Color("#9e755c");
const MODESTY_GARMENT_COLOR = new THREE.Color("#263953");

const REGION_METRICS = {
  overview: [
    "Heart Rate",
    "Oxygen Saturation",
    "Body Temperature",
    "Sleep Duration",
    "Physical Activity",
    "Stress Indicator",
  ],
  head: ["Sleep Duration", "Stress Indicator"],
  chest: ["Heart Rate", "Oxygen Saturation", "Body Temperature"],
  abdomen: ["Body Temperature"],
  arms: ["Physical Activity"],
  legs: ["Physical Activity"],
};

const REGION_INDEX = new Map(BODY_REGIONS.map(({ id }, index) => [id, index]));

function classifyBodyRegion(x, z, bounds) {
  const height = bounds.max.z - bounds.min.z;
  const width = bounds.max.x - bounds.min.x;
  const heightPosition = (z - bounds.min.z) / height;
  const distanceFromCenter = Math.abs(x - (bounds.min.x + bounds.max.x) / 2);

  if (heightPosition > 0.82) return "head";
  if (heightPosition < 0.48) return "legs";
  if (heightPosition < 0.82 && distanceFromCenter > width * 0.29) return "arms";
  if (heightPosition > 0.58) return "chest";
  return "abdomen";
}

function smoothstep(edge0, edge1, value) {
  const amount = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function modestyGarmentCoverage(x, z, bounds) {
  const height = bounds.max.z - bounds.min.z;
  const heightFraction = (z - bounds.min.z) / height;
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const lateralDistance = Math.abs(x - centerX);
  const normalizedX = lateralDistance / 165;
  const top = 0.58 - Math.min(normalizedX, 1) * 0.015;
  const bottom = 0.39 + Math.min(normalizedX, 1) * 0.035;
  const verticalCoverage = smoothstep(bottom - 0.012, bottom + 0.012, heightFraction)
    * (1 - smoothstep(top - 0.012, top + 0.012, heightFraction));
  const lateralCoverage = 1 - smoothstep(145, 165, lateralDistance);

  return verticalCoverage * lateralCoverage;
}

function concealExternalDetail(x, depth, z) {
  if (depth > -145) return depth;

  const lateralBlend = 1 - smoothstep(48, 82, Math.abs(x));
  const upperBlend = smoothstep(735, 775, z);
  const lowerBlend = 1 - smoothstep(850, 890, z);
  const frontBlend = 1 - smoothstep(-188, -148, depth);
  const amount = lateralBlend * upperBlend * lowerBlend * frontBlend;
  const smoothContour = -145;

  return THREE.MathUtils.lerp(depth, smoothContour, amount);
}

function getSkinVariation(x, y, z, normalZ) {
  const surfaceLighting = 1 + THREE.MathUtils.clamp(normalZ, 0, 1) * 0.018;
  return (0.975
    + Math.sin(x * 0.031 + z * 0.017) * 0.012
    + Math.sin(y * 0.027 - z * 0.023) * 0.009
    + Math.sin(x * 0.013 + y * 0.019 + z * 0.009) * 0.008) * surfaceLighting;
}

function createRegionMeshes(sourceGeometry, bounds) {
  const isIndexed = Boolean(sourceGeometry.index);
  const geometry = isIndexed ? sourceGeometry.toNonIndexed() : sourceGeometry;
  const positions = geometry.getAttribute("position");

  if (!positions || positions.count < 3) {
    if (isIndexed) geometry.dispose();
    throw new Error("The anatomy model does not contain a usable surface mesh.");
  }

  const normals = geometry.getAttribute("normal");
  const uvs = geometry.getAttribute("uv");
  const triangleCount = Math.floor(positions.count / 3);
  const surfaceByTriangle = new Uint8Array(triangleCount);
  const vertexCounts = new Uint32Array(BODY_REGIONS.length);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 3.5 / (bounds.max.z - bounds.min.z);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const x = (positions.getX(offset) + positions.getX(offset + 1) + positions.getX(offset + 2)) / 3;
    const z = (positions.getZ(offset) + positions.getZ(offset + 1) + positions.getZ(offset + 2)) / 3;
    const region = REGION_INDEX.get(classifyBodyRegion(x, z, bounds));
    surfaceByTriangle[triangle] = region;
    vertexCounts[region] += 3;
  }

  const regionBuffers = BODY_REGIONS.map((_, region) => ({
    positions: new Float32Array(vertexCounts[region] * 3),
    normals: null,
    uvs: uvs ? new Float32Array(vertexCounts[region] * 2) : null,
    colors: new Float32Array(vertexCounts[region] * 3),
    offset: 0,
  }));

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const sourceOffset = triangle * 3;
    const surface = surfaceByTriangle[triangle];
    const buffer = regionBuffers[surface];

    for (let vertex = 0; vertex < 3; vertex += 1) {
      const sourceIndex = sourceOffset + vertex;
      const targetOffset = buffer.offset;
      const sourceX = positions.getX(sourceIndex);
      const sourceY = positions.getY(sourceIndex);
      const sourceZ = positions.getZ(sourceIndex);
      const adjustedY = concealExternalDetail(sourceX, sourceY, sourceZ);
      buffer.positions[targetOffset] = (sourceX - center.x) * scale;
      buffer.positions[targetOffset + 1] = (adjustedY - center.y) * scale;
      buffer.positions[targetOffset + 2] = (positions.getZ(sourceIndex) - center.z) * scale;

      if (uvs) {
        const uvOffset = (targetOffset / 3) * 2;
        buffer.uvs[uvOffset] = uvs.getX(sourceIndex);
        buffer.uvs[uvOffset + 1] = uvs.getY(sourceIndex);
      }

      const variation = getSkinVariation(
        sourceX,
        sourceY,
        sourceZ,
        normals ? normals.getZ(sourceIndex) : 0
      );
      const garmentCoverage = modestyGarmentCoverage(sourceX, sourceZ, bounds);
      buffer.colors[targetOffset] = THREE.MathUtils.lerp(
        SKIN_BASE_COLOR.r * variation,
        MODESTY_GARMENT_COLOR.r,
        garmentCoverage
      );
      buffer.colors[targetOffset + 1] = THREE.MathUtils.lerp(
        SKIN_BASE_COLOR.g * variation,
        MODESTY_GARMENT_COLOR.g,
        garmentCoverage
      );
      buffer.colors[targetOffset + 2] = THREE.MathUtils.lerp(
        SKIN_BASE_COLOR.b * variation,
        MODESTY_GARMENT_COLOR.b,
        garmentCoverage
      );

      buffer.offset += 3;
    }
  }

  if (isIndexed) geometry.dispose();

  return regionBuffers.flatMap((buffer, surface) => {
    if (buffer.offset === 0) return [];

    const regionGeometry = new THREE.BufferGeometry();
    regionGeometry.setAttribute("position", new THREE.BufferAttribute(buffer.positions, 3));
    if (buffer.normals) {
      regionGeometry.setAttribute("normal", new THREE.BufferAttribute(buffer.normals, 3));
    } else {
      regionGeometry.computeVertexNormals();
    }
    if (buffer.uvs) regionGeometry.setAttribute("uv", new THREE.BufferAttribute(buffer.uvs, 2));
    if (buffer.colors) regionGeometry.setAttribute("color", new THREE.BufferAttribute(buffer.colors, 3));
    regionGeometry.computeBoundingSphere();

    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
      clearcoat: 0.025,
      clearcoatRoughness: 0.9,
      emissive: 0x49e4d0,
      emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(regionGeometry, material);
    mesh.userData.region = BODY_REGIONS[surface].id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return [{ mesh, material, region: mesh.userData.region }];
  });
}

function latestByParameter(readings) {
  const latest = new Map();
  for (const reading of readings) {
    if (!reading?.parameter || !Number.isFinite(Number(reading.value))) continue;
    const current = latest.get(reading.parameter);
    const currentTime = Date.parse(current?.timestamp || "") || 0;
    const readingTime = Date.parse(reading.timestamp || "") || 0;
    if (!current || readingTime > currentTime) latest.set(reading.parameter, reading);
  }
  return latest;
}

function formatTimestamp(timestamp) {
  const value = Date.parse(timestamp || "");
  return value ? new Date(value).toLocaleString() : "Timestamp unavailable";
}

export default function AnatomyPanel({ readings }) {
  const mountRef = useRef(null);
  const controlsRef = useRef(null);
  const regionMaterialsRef = useRef(new Map());
  const [renderState, setRenderState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("overview");
  const readingByParameter = latestByParameter(readings);
  const regionLabel = BODY_REGIONS.find(({ id }) => id === selectedRegion)?.label || "Overview";
  const selectedReadings = (REGION_METRICS[selectedRegion] || [])
    .map((parameter) => readingByParameter.get(parameter))
    .filter(Boolean);

  useEffect(() => {
    for (const [region, materials] of regionMaterialsRef.current) {
      for (const material of materials) {
        material.emissiveIntensity = region === selectedRegion ? 0.035 : 0;
      }
    }
  }, [renderState, selectedRegion]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    let scene;
    let controls;
    let resizeObserver;
    let animationFrame = 0;
    let modelRequest;
    let body;
    let floor;
    let disposed = false;
    let contextLost = false;
    let pointerDown;
    const materials = new Set();
    const regionMaterials = new Map();

    const releaseModel = (model) => {
      model.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach((material) => material.dispose());
        }
      });
    };

    try {
      scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
      camera.position.set(0, 0, 5.7);
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute(
        "aria-label",
        "Interactive 3D BodyParts3D skin model. Click or tap a body region to select it; drag to rotate."
      );
      renderer.domElement.setAttribute("role", "img");
      mount.appendChild(renderer.domElement);

      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.VSMShadowMap;
      scene.add(new THREE.HemisphereLight(0xf5ebdf, 0x243048, 1.2));
      const keyLight = new THREE.DirectionalLight(0xfff4e9, 1.7);
      keyLight.position.set(-2, 4, 5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 12;
      keyLight.shadow.camera.left = -3;
      keyLight.shadow.camera.right = 3;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -3;
      keyLight.shadow.radius = 5;
      keyLight.shadow.blurSamples = 8;
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x49e4d0, 0.58);
      rimLight.position.set(3, 1, -3);
      scene.add(rimLight);
      const fillLight = new THREE.DirectionalLight(0x8d9fff, 0.52);
      fillLight.position.set(-4, -2, 3);
      scene.add(fillLight);

      floor = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 5),
        new THREE.ShadowMaterial({ color: 0x020712, opacity: 0.3 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.78;
      floor.receiveShadow = true;
      scene.add(floor);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 4;
      controls.maxDistance = 9;
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;

      const resize = () => {
        const { width, height } = mount.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
      resize();

      const pointer = new THREE.Vector2();
      const raycaster = new THREE.Raycaster();
      const onPointerDown = (event) => {
        pointerDown = { x: event.clientX, y: event.clientY };
      };
      const onPointerMove = (event) => {
        if (!pointerDown) return;
        if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 8) {
          pointerDown.moved = true;
        }
      };
      const onPointerUp = (event) => {
        if (!pointerDown?.moved && body) {
          const bounds = renderer.domElement.getBoundingClientRect();
          pointer.set(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -((event.clientY - bounds.top) / bounds.height) * 2 + 1
          );
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(body.children, false)[0];
          if (hit?.object.userData.region) setSelectedRegion(hit.object.userData.region);
        }
        pointerDown = undefined;
      };
      const onContextLost = (event) => {
        event.preventDefault();
        contextLost = true;
        window.cancelAnimationFrame(animationFrame);
        setLoadError("WebGL was interrupted. Reload the page to restore the interactive model.");
        setRenderState("unavailable");
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
      renderer.domElement.addEventListener("pointercancel", onPointerUp);
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);

      const render = () => {
        if (disposed || contextLost) return;
        controls.update();
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(render);
      };
      animationFrame = window.requestAnimationFrame(render);

      const loader = new OBJLoader();
      modelRequest = loader.load(
        "/models/bodyparts3d-skin.obj",
        (model) => {
          if (disposed) {
            releaseModel(model);
            return;
          }

          try {
            model.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(model);
            if (bounds.isEmpty() || bounds.max.z <= bounds.min.z) {
              throw new Error("The local model has invalid anatomical bounds.");
            }

            body = new THREE.Group();
            body.rotation.x = -Math.PI / 2;
            model.traverse((object) => {
              if (!object.isMesh) return;
              const sections = createRegionMeshes(object.geometry, bounds);
              for (const { mesh, material, region } of sections) {
                body.add(mesh);
                materials.add(material);
                const regionMaterialsList = regionMaterials.get(region) || [];
                regionMaterialsList.push(material);
                regionMaterials.set(region, regionMaterialsList);
              }
              object.geometry.dispose();
              if (object.material) {
                const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
                objectMaterials.forEach((material) => material.dispose());
              }
            });

            if (body.children.length === 0) {
              throw new Error("No renderable skin surface was found in the local model.");
            }

            scene.add(body);
            regionMaterialsRef.current = regionMaterials;
            controlsRef.current = {
              reset() {
                controls.reset();
                camera.position.set(0, 0, 5.7);
                controls.target.set(0, 0, 0);
                controls.update();
              },
              zoom(amount) {
                camera.position.multiplyScalar(amount);
                controls.update();
              },
            };
            setRenderState("ready");
          } catch (error) {
            console.error("The local BodyParts3D skin model could not be prepared.", error);
            if (body) {
              scene.remove(body);
              releaseModel(body);
              body = undefined;
            }
            for (const material of materials) material.dispose();
            materials.clear();
            regionMaterials.clear();
            regionMaterialsRef.current = new Map();
            setLoadError("The local BodyParts3D model could not be prepared for display.");
            setRenderState("unavailable");
            releaseModel(model);
          }
        },
        undefined,
        (error) => {
          if (disposed) return;
          console.error("The local BodyParts3D skin model could not be loaded.", error);
          setLoadError("The local BodyParts3D model could not be loaded. Check the local model asset and try again.");
          setRenderState("unavailable");
        }
      );

      return () => {
        disposed = true;
        modelRequest?.abort?.();
        window.cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        controls?.dispose();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        renderer.domElement.removeEventListener("pointercancel", onPointerUp);
        renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        if (body) releaseModel(body);
        floor?.geometry.dispose();
        floor?.material.dispose();
        for (const material of materials) material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        controlsRef.current = null;
        regionMaterialsRef.current = new Map();
      };
    } catch (error) {
      console.error("The interactive anatomy viewer could not be initialized.", error);
      animationFrame = window.requestAnimationFrame(() => {
        if (disposed) return;
        setLoadError("WebGL could not be initialized in this browser.");
        setRenderState("unavailable");
      });
      renderer?.dispose();
      renderer?.domElement.remove();
      return () => {
        disposed = true;
        modelRequest?.abort?.();
        window.cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        controls?.dispose();
        if (body) releaseModel(body);
        floor?.geometry.dispose();
        floor?.material.dispose();
        for (const material of materials) material.dispose();
        controlsRef.current = null;
        regionMaterialsRef.current = new Map();
      };
    }
  }, []);

  const isUnavailable = renderState === "unavailable";

  return (
    <section className="app-panel dashboard-anatomy-panel">
      <div className="dashboard-section-heading anatomy-heading">
        <div>
          <span className="dashboard-section-kicker">INTERACTIVE ANATOMY</span>
          <h2>Human body regions</h2>
          <p>Click or tap the model or use the region controls to view available sample readings.</p>
        </div>
        <span className="anatomy-model-label">BODY PARTS 3D · LICENSED SKIN SURFACE</span>
      </div>
      <div className={`anatomy-stage${isUnavailable ? " is-unavailable" : ""}`}>
        <div ref={mountRef} className="anatomy-canvas" />
        {renderState === "loading" && (
          <div className="anatomy-loading" role="status">Loading local BodyParts3D skin model…</div>
        )}
        {isUnavailable && (
          <div className="anatomy-error" role="alert">
            <strong>Interactive 3D model unavailable</strong>
            <span>{loadError || "The local anatomy model could not be shown."}</span>
          </div>
        )}
        {renderState === "ready" && (
          <div className="anatomy-stage-note">Drag to rotate · Scroll or pinch to zoom · Select a colored region</div>
        )}
      </div>
      <div className="anatomy-control-row">
        <div className="anatomy-region-controls" role="group" aria-label="Select a body region">
          {BODY_REGIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={selectedRegion === id ? "is-selected" : ""}
              aria-pressed={selectedRegion === id}
              onClick={() => setSelectedRegion(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="anatomy-zoom-controls" role="group" aria-label="3D view controls">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={isUnavailable}
            onClick={() => controlsRef.current?.zoom(1.12)}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={isUnavailable}
            onClick={() => controlsRef.current?.zoom(0.89)}
          >
            +
          </button>
          <button type="button" disabled={isUnavailable} onClick={() => controlsRef.current?.reset()}>
            Reset view
          </button>
        </div>
      </div>
      <div className="anatomy-measurement">
        <div className="anatomy-measurement-heading">
          <div>
            <span className="dashboard-trend-kicker">AVAILABLE SAMPLE DATA</span>
            <h3>{regionLabel} readings</h3>
          </div>
          <span className="anatomy-reading-count">
            {selectedReadings.length} indicator{selectedReadings.length === 1 ? "" : "s"}
          </span>
        </div>
        {selectedReadings.length > 0 ? (
          <div className="anatomy-reading-grid">
            {selectedReadings.map((reading) => (
              <article className="anatomy-reading-card" key={reading.parameter}>
                <div className="anatomy-reading-heading">
                  <strong>{reading.parameter}</strong>
                  {reading.severity && (
                    <RiskBadge severity={reading.severity} status={reading.status} />
                  )}
                </div>
                <strong className="anatomy-reading-value">
                  {reading.value} <small>{reading.unit || "Unit unavailable"}</small>
                </strong>
                <span>{reading.astronautName || "Crew member unavailable"}</span>
                <time dateTime={reading.timestamp || undefined}>{formatTimestamp(reading.timestamp)}</time>
                {reading.message && <p>{reading.message}</p>}
              </article>
            ))}
          </div>
        ) : (
          <p className="dashboard-no-data">
            No matching health readings are available for this region in the current dataset.
          </p>
        )}
        <p className="anatomy-disclaimer">
          These broad surface regions are approximate hit zones, not separate organ meshes. Sample alerts can refer to different crew members and are not diagnostic.
          {" "}
          <a
            href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
            target="_blank"
            rel="noreferrer"
          >
            BodyParts3D skin model · CC BY 4.0
          </a>
        </p>
      </div>
    </section>
  );
}
