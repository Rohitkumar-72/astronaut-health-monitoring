import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import RiskBadge from "./RiskBadge";

const BODY_REGIONS = [
  { id: "overview", label: "Overview" },
  { id: "head", label: "Head" },
  { id: "chest", label: "Chest" },
  { id: "abdomen", label: "Abdomen" },
  { id: "arms", label: "Arms" },
  { id: "legs", label: "Legs" },
];

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

const REGION_SYSTEMS = {
  overview: ["All systems context"],
  head: ["Nervous system"],
  chest: ["Cardiovascular system", "Respiratory system"],
  abdomen: ["Digestive system"],
  arms: ["Muscular system", "Skeletal system"],
  legs: ["Skeletal system", "Muscular system"],
};

const REGION_DESCRIPTIONS = {
  overview: "A broad view of the astronaut suit and the available crew measurements.",
  head: "Sleep and stress readings are shown here as crew-wide indicators, not head or brain measurements.",
  chest: "Cardiovascular and oxygen readings are associated with this approximate surface zone.",
  abdomen: "Temperature readings are associated with this approximate surface zone.",
  arms: "Activity readings provide crew context for this approximate surface zone.",
  legs: "Activity readings provide crew context for this approximate surface zone.",
};

const SYSTEM_NAVIGATION = [
  { label: "Cardiovascular", region: "chest" },
  { label: "Respiratory", region: "chest" },
  { label: "Skeletal", region: "legs" },
  { label: "Muscular", region: "arms" },
  { label: "Nervous", region: "head" },
  { label: "Digestive", region: "abdomen" },
  { label: "Skin surface", region: "overview" },
];

function classifyBodyRegion(name = "") {
  const normalized = name.toLowerCase().replace(/[_-]+/g, " ");
  if (normalized.includes("lifesupport")) return "chest";
  if (normalized.includes("feet") || normalized.includes("legs")) return "legs";
  if (normalized.includes("head")) return "head";
  if (normalized.includes("body")) return "chest";
  return "overview";
}

function classifyBodyPoint(point, bounds) {
  const height = bounds.max.y - bounds.min.y;
  const width = bounds.max.x - bounds.min.x;
  const heightPosition = (point.y - bounds.min.y) / height;
  const distanceFromCenter = Math.abs(point.x - (bounds.min.x + bounds.max.x) / 2);

  if (heightPosition > 0.81) return "head";
  if (heightPosition < 0.43) return "legs";
  if (heightPosition < 0.81 && distanceFromCenter > width * 0.25) return "arms";
  if (heightPosition > 0.56) return "chest";
  return "abdomen";
}

function formatBodyPartName(name = "") {
  if (name.includes("LifeSupport")) return "Life-support backpack";
  if (name.includes("Head")) return "Helmet";
  if (name.includes("Feet")) return "Boots";
  if (name.includes("Legs")) return "Leg suit";
  if (name.includes("Body")) return "Torso and arm suit";
  return "Suit detail";
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
  const selectableMeshesRef = useRef([]);
  const [renderState, setRenderState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("overview");
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const readingByParameter = latestByParameter(readings);
  const regionLabel = BODY_REGIONS.find(({ id }) => id === selectedRegion)?.label || "Overview";
  const selectedLabel = selectedPart?.label || regionLabel;
  const regionSystems = REGION_SYSTEMS[selectedRegion] || REGION_SYSTEMS.overview;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleRegions = BODY_REGIONS.filter(({ label }) => label.toLowerCase().includes(normalizedSearch));
  const visibleSystems = SYSTEM_NAVIGATION.filter(({ label }) => label.toLowerCase().includes(normalizedSearch));
  const selectedReadings = (REGION_METRICS[selectedRegion] || [])
    .map((parameter) => readingByParameter.get(parameter))
    .filter(Boolean);

  useEffect(() => {
    for (const entry of selectableMeshesRef.current) {
      const selected = selectedPart
        ? entry.mesh.uuid === selectedPart.id
        : selectedRegion === "overview"
          || entry.region === selectedRegion
          || (entry.region === "chest" && ["arms", "abdomen"].includes(selectedRegion));
      for (const material of entry.materials) {
        material.emissive.set(selected ? 0x197e8a : 0x000000);
        material.emissiveIntensity = selected ? (selectedPart ? 0.42 : 0.16) : 0;
      }
    }
  }, [renderState, selectedPart, selectedRegion]);

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
    const selectableMeshes = [];

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
        "Interactive 3D astronaut spacesuit. Click or tap a suit mesh to select it; drag to rotate."
      );
      renderer.domElement.setAttribute("role", "img");
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffeee0, 0x24243c, 1.55));
      const keyLight = new THREE.DirectionalLight(0xffead8, 2.2);
      keyLight.position.set(-2.2, 3.5, 4.5);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x9c83ff, 1.05);
      rimLight.position.set(3, 2, -3);
      scene.add(rimLight);
      const fillLight = new THREE.DirectionalLight(0x84caff, 0.78);
      fillLight.position.set(-4, -2, 3);
      scene.add(fillLight);

      floor = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 5),
        new THREE.MeshBasicMaterial({ color: 0x08101f, transparent: true, opacity: 0.32 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.78;
      scene.add(floor);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 3;
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
      const onPointerCancel = () => {
        pointerDown = undefined;
      };
      const onPointerUp = (event) => {
        if (!pointerDown?.moved && body) {
          const bounds = renderer.domElement.getBoundingClientRect();
          pointer.set(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -((event.clientY - bounds.top) / bounds.height) * 2 + 1
          );
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(body.children, true)[0];
          if (hit?.object.userData.region) {
            const region = classifyBodyPoint(hit.point, body.userData.bounds);
            const regionName = BODY_REGIONS.find((item) => item.id === region)?.label || "Body";
            setSelectedRegion(region);
            setSelectedPart({
              id: hit.object.uuid,
              label: `${regionName} · ${hit.object.userData.bodyPart}`,
            });
            setSelectedSystem(null);
          }
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
      renderer.domElement.addEventListener("pointercancel", onPointerCancel);
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);

      const render = () => {
        if (disposed || contextLost) return;
        controls.update();
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(render);
      };
      animationFrame = window.requestAnimationFrame(render);

      const loader = new GLTFLoader();
      modelRequest = loader.load(
        "/models/astronaut-spacesuit.glb",
        (gltf) => {
          const model = gltf.scene;
          if (disposed) {
            releaseModel(model);
            return;
          }

          try {
            model.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(model);
            if (bounds.isEmpty() || bounds.max.y <= bounds.min.y) {
              throw new Error("The local model has invalid anatomical bounds.");
            }

            const center = bounds.getCenter(new THREE.Vector3());
            const size = bounds.getSize(new THREE.Vector3());
            const scale = 3.1 / size.y;
            const packWidth = size.x * 0.28;
            const packHeight = size.y * 0.23;
            const packDepth = Math.max(size.z * 0.4, 0.14);
            const packCenter = new THREE.Vector3(
              center.x,
              center.y + size.y * 0.18,
              center.z - size.z * 0.5
            );
            const shellMaterial = new THREE.MeshStandardMaterial({
              color: "#91a6bb",
              metalness: 0.42,
              roughness: 0.48,
            });
            shellMaterial.name = "SciFi_Main";
            const tankMaterial = new THREE.MeshStandardMaterial({
              color: "#183353",
              metalness: 0.34,
              roughness: 0.52,
            });
            tankMaterial.name = "SciFi_MainDark";
            const panelMaterial = new THREE.MeshStandardMaterial({
              color: "#10243d",
              metalness: 0.25,
              roughness: 0.4,
            });
            panelMaterial.name = "Grey";
            const accentMaterial = new THREE.MeshStandardMaterial({
              color: "#36d5f2",
              metalness: 0.28,
              roughness: 0.38,
            });
            accentMaterial.name = "SciFi_Light_Accent";
            for (const material of [shellMaterial, tankMaterial, panelMaterial, accentMaterial]) {
              materials.add(material);
            }
            const addPackPart = (part, geometry, material, position) => {
              const mesh = new THREE.Mesh(geometry, material);
              mesh.name = `SpaceSuit_LifeSupport_${part}`;
              mesh.position.copy(position);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              model.add(mesh);
            };
            addPackPart(
              "Shell",
              new THREE.BoxGeometry(packWidth, packHeight, packDepth),
              shellMaterial,
              packCenter
            );
            for (const side of [-1, 1]) {
              addPackPart(
                `Tank_${side}`,
                new THREE.CylinderGeometry(packWidth * 0.1, packWidth * 0.1, packHeight * 0.84, 8),
                tankMaterial,
                new THREE.Vector3(
                  packCenter.x + side * packWidth * 0.42,
                  packCenter.y,
                  packCenter.z
                )
              );
            }
            const rearPanelZ = packCenter.z - packDepth * 0.5 - 0.008;
            addPackPart(
              "ControlPanel",
              new THREE.BoxGeometry(packWidth * 0.58, packHeight * 0.3, 0.018),
              panelMaterial,
              new THREE.Vector3(packCenter.x, packCenter.y + packHeight * 0.17, rearPanelZ)
            );
            addPackPart(
              "PanelAccent",
              new THREE.BoxGeometry(packWidth * 0.28, packHeight * 0.045, 0.012),
              accentMaterial,
              new THREE.Vector3(packCenter.x, packCenter.y + packHeight * 0.17, rearPanelZ - 0.015)
            );
            model.scale.setScalar(scale);
            model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
            body = new THREE.Group();
            body.userData.bounds = new THREE.Box3(
              bounds.min.clone().multiplyScalar(scale).sub(center.clone().multiplyScalar(scale)),
              bounds.max.clone().multiplyScalar(scale).sub(center.clone().multiplyScalar(scale))
            );
            model.traverse((object) => {
              if (!object.isMesh) return;
              const originalMaterials = object.material
                ? (Array.isArray(object.material) ? object.material : [object.material])
                : [new THREE.MeshStandardMaterial()];
              const meshMaterials = originalMaterials.map((material) => {
                const meshMaterial = material.clone();
                const materialName = material.name.toLowerCase();
                if (materialName.includes("light_accent")) meshMaterial.color.set("#36d5f2");
                else if (materialName.includes("maindark")) meshMaterial.color.set("#183353");
                else if (materialName === "grey") meshMaterial.color.set("#10243d");
                else if (materialName.includes("main")) meshMaterial.color.set("#8299b2");
                else meshMaterial.color.set("#edf2f8");
                meshMaterial.emissive?.set(0x000000);
                meshMaterial.emissiveIntensity = 0;
                meshMaterial.needsUpdate = true;
                materials.add(meshMaterial);
                return meshMaterial;
              });
              object.material = Array.isArray(object.material) ? meshMaterials : meshMaterials[0];
              object.userData.region = classifyBodyRegion(object.name);
              object.userData.bodyPart = formatBodyPartName(object.name);
              object.castShadow = false;
              object.receiveShadow = true;
              selectableMeshes.push({
                mesh: object,
                materials: meshMaterials,
                region: object.userData.region,
              });
            });

            if (selectableMeshes.length === 0) {
              throw new Error("No separately selectable body-region meshes were found in the local model.");
            }

            body.add(model);
            scene.add(body);
            selectableMeshesRef.current = selectableMeshes;
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
            console.error("The local Quaternius spacesuit model could not be prepared.", error);
            if (body) {
              scene.remove(body);
              releaseModel(body);
              body = undefined;
            }
            for (const material of materials) material.dispose();
            materials.clear();
            selectableMeshes.length = 0;
            selectableMeshesRef.current = [];
            setLoadError("The local astronaut spacesuit model could not be prepared for display.");
            setRenderState("unavailable");
            releaseModel(model);
          }
        },
        undefined,
        (error) => {
          if (disposed) return;
          console.error("The local Quaternius spacesuit model could not be loaded.", error);
          setLoadError("The local astronaut spacesuit model could not be loaded. Check the local model asset and try again.");
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
        renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
        renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        if (body) releaseModel(body);
        floor?.geometry.dispose();
        floor?.material.dispose();
        for (const material of materials) material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        controlsRef.current = null;
        selectableMeshesRef.current = [];
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
        selectableMeshesRef.current = [];
      };
    }
  }, []);

  const isUnavailable = renderState === "unavailable";

  return (
    <section className="anatomy-explorer-card" id="body-explorer">
      <header className="anatomy-workspace-header">
        <div>
          <span className="anatomy-workspace-kicker">ASTRA EXTRAVEHICULAR SUIT</span>
          <h2>3D astronaut exploration</h2>
          <p>Select a suit region to review related readings. Drag to rotate and zoom.</p>
        </div>
        <span className="anatomy-model-label">QUATERNIUS SPACESUIT · CC0</span>
      </header>

      <div className="anatomy-workspace-grid">
        <aside className="anatomy-region-panel" aria-label="Body region navigation">
          <div className="anatomy-panel-heading">
            <span>REGION NAVIGATION</span>
            <strong>Explore by region</strong>
          </div>
          <label className="anatomy-search">
            <span>Search body region</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="e.g. chest, arm, foot"
              aria-label="Search body regions and systems"
            />
          </label>
          <div className="anatomy-region-controls" role="group" aria-label="Select a body region">
            {visibleRegions.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={selectedRegion === id ? "is-selected" : ""}
                aria-pressed={selectedRegion === id}
                onClick={() => {
                  setSelectedRegion(id);
                  setSelectedSystem(null);
                  setSelectedPart(null);
                }}
              >
                <span>{String(BODY_REGIONS.findIndex((region) => region.id === id) + 1).padStart(2, "0")}</span>
                {label}
              </button>
            ))}
            {visibleRegions.length === 0 && visibleSystems.length === 0 && (
              <p className="anatomy-search-empty">No regions or systems match this search.</p>
            )}
          </div>
          <div className="anatomy-system-navigation">
            <span>BODY SYSTEM CATEGORIES</span>
            <div role="group" aria-label="Explore a body system surface context">
              {visibleSystems.map(({ label, region }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={selectedSystem === label}
                  onClick={() => {
                    setSelectedRegion(region);
                    setSelectedSystem(label);
                    setSelectedPart(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <small>System labels select a related exterior region; internal organs are not included.</small>
          </div>
          <div className="anatomy-scope-note">
            <span className="anatomy-scope-icon" aria-hidden="true">i</span>
            <p>The suit has four named meshes and a modeled life-support pack. Highlights cover whole meshes; arm and abdominal zones are approximate, and internal organs are not modeled.</p>
          </div>
        </aside>

        <div className="anatomy-view-column">
          <div className="anatomy-view-toolbar">
            <div>
              <span>SELECTED BODY PART</span>
              <strong>{selectedLabel}</strong>
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
          <div className={`anatomy-stage${isUnavailable ? " is-unavailable" : ""}`}>
            <div ref={mountRef} className="anatomy-canvas" />
            {renderState === "loading" && (
              <div className="anatomy-loading" role="status">Loading local 3D astronaut spacesuit…</div>
            )}
            {isUnavailable && (
              <div className="anatomy-error" role="alert">
                <strong>Interactive 3D model unavailable</strong>
                <span>{loadError || "The local anatomy model could not be shown."}</span>
              </div>
            )}
            {renderState === "ready" && (
              <div className="anatomy-stage-note">Drag to rotate · Scroll or pinch to zoom · Tap a suit region to select it</div>
            )}
          </div>
          <div className="anatomy-view-footer">
            <span>ROTATABLE SURFACE VIEW</span>
            <span>Selection: {selectedLabel}</span>
          </div>
        </div>

        <aside className="anatomy-details-panel" aria-live="polite">
          <div className="anatomy-panel-heading">
            <span>SELECTED BODY PART</span>
            <strong>{selectedLabel}</strong>
          </div>
          <p className="anatomy-region-description">
            {selectedPart
              ? `${selectedPart.label} selected. Related health readings are shown for the broader ${regionLabel.toLowerCase()} region.`
              : REGION_DESCRIPTIONS[selectedRegion] || REGION_DESCRIPTIONS.overview}
          </p>
          <div className="anatomy-system-context">
            <span>RELATED SYSTEM CONTEXT</span>
            <div>{regionSystems.map((system) => <span key={system}>{system}</span>)}</div>
          </div>
          <div className="anatomy-measurement">
            <div className="anatomy-measurement-heading">
              <div>
                <span className="dashboard-trend-kicker">BACKEND DEMONSTRATION DATA</span>
                <h3>Related readings</h3>
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
          </div>
          <div className="anatomy-preventive-note">
            <span>PREVENTIVE GUIDANCE</span>
            <p>No region-specific recommendations are provided in the current data.</p>
          </div>
          <p className="anatomy-disclaimer">
            Suit regions provide crew-health context and do not represent independently selectable organs. Readings are not diagnostic.
            {" "}
            <a
              href="https://quaternius.com/packs/ultimatemodularcharacters.html"
              target="_blank"
              rel="noreferrer"
            >
              Quaternius spacesuit · CC0
            </a>
          </p>
        </aside>
      </div>
    </section>
  );
}
