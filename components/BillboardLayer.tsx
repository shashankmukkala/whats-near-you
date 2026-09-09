"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  MercatorCoordinate,
  type CustomLayerInterface,
} from "maplibre-gl";
import * as THREE from "three";
import type { Billboard } from "@/lib/supabase";

type BillboardLayerProps = {
  map: MapLibreMap | null;
  billboards: Billboard[];
};

const LAYER_ID = "billboard-3d-layer";

export default function BillboardLayer({ map, billboards }: BillboardLayerProps) {
  const billboardsRef = useRef(billboards);
  useEffect(() => {
    billboardsRef.current = billboards;
  }, [billboards]);
  const panelsRef = useRef<Map<string, THREE.Object3D>>(new globalThis.Map());

  useEffect(() => {
    if (!map) return;

    let renderer: THREE.WebGLRenderer | undefined;
    let scene: THREE.Scene | undefined;
    let camera: THREE.Camera;

    const layer: CustomLayerInterface = {
      id: LAYER_ID,
      type: "custom",
      renderingMode: "3d",

      onAdd(_map, gl) {
        scene = new THREE.Scene();
        camera = new THREE.Camera();

        scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(0, -1, 1);
        scene.add(sun);

        renderer = new THREE.WebGLRenderer({
          canvas: _map.getCanvas(),
          context: gl,
          antialias: true,
        });
        renderer.autoClear = false;

        rebuildPanels();
      },

      render(gl, args) {
        // Nothing to draw: return without asking for another frame. This
        // used to call triggerRepaint() unconditionally, which pins the
        // map into a permanent render loop — every frame, forever, on
        // every device, even with zero billboards placed (which is the
        // normal state). On a phone that is a continuous GPU wake and one
        // of the largest battery costs in the app, for an empty scene.
        if (panelsRef.current.size === 0) return;

        const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
        camera.projectionMatrix = m;
        renderer!.resetState();
        renderer!.render(scene!, camera);
        // Still a self-driven loop while panels exist — the meshes are
        // static, but MapLibre needs a repaint request to keep compositing
        // this custom layer while the camera moves.
        map!.triggerRepaint();
      },

      // Called by maplibre when the layer is removed (map.removeLayer) or
      // the map itself is torn down — without this the renderer's WebGL
      // resources (and every panel's geometry/material) leaked on every
      // remove/re-add cycle. In dev, React Strict Mode mounts this effect
      // twice (mount -> cleanup -> mount) specifically to catch bugs like
      // this; left undisposed, the second onAdd's WebGLRenderer collided
      // with the first's over the same canvas/GL context and crashed with
      // "Cannot read properties of null (reading 'alpha')".
      onRemove() {
        for (const object of panelsRef.current.values()) {
          scene?.remove(object);
          disposeObject(object);
        }
        panelsRef.current.clear();
        renderer?.dispose();
        renderer = undefined;
        scene = undefined;
      },
    };

    function applyTexture(material: THREE.MeshStandardMaterial, billboard: Billboard) {
      if (!billboard.image_url) return;
      new THREE.TextureLoader().load(
        billboard.image_url,
        (texture) => {
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
          map?.triggerRepaint();
        },
        undefined,
        () => {
          // Keep the warm fallback when a remote asset is unavailable.
        }
      );
    }

    function panelMesh(billboard: Billboard) {
      const origin = MercatorCoordinate.fromLngLat([billboard.lng, billboard.lat], billboard.elevation_m);
      const scale = origin.meterInMercatorCoordinateUnits();

      const material = new THREE.MeshStandardMaterial({ color: 0xff7a3d, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(billboard.width_m, billboard.height_m), material);
      mesh.position.set(origin.x, origin.y, origin.z);
      mesh.scale.set(scale, scale, scale);
      mesh.rotation.x = Math.PI / 2;
      mesh.geometry.translate(0, billboard.height_m / 2, 0);
      applyTexture(material, billboard);

      return mesh;
    }

    function disposeObject(object: THREE.Object3D) {
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          material.map?.dispose();
          material.dispose();
        });
      });
    }

    function rebuildPanels() {
      if (!scene) return;
      for (const object of panelsRef.current.values()) {
        scene.remove(object);
        disposeObject(object);
      }
      panelsRef.current.clear();

      for (const billboard of billboardsRef.current) {
        if (billboard.ad_type === "aircraft" || billboard.ad_type === "rail") continue;
        const mesh = panelMesh(billboard);
        scene.add(mesh);
        panelsRef.current.set(billboard.id, mesh);
      }
    }

    (layer as CustomLayerInterface & { rebuildPanels: () => void }).rebuildPanels = rebuildPanels;

    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    map.addLayer(layer);

    return () => {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const layer = map.getLayer(LAYER_ID) as
      | (CustomLayerInterface & { rebuildPanels?: () => void })
      | undefined;
    layer?.rebuildPanels?.();
    map.triggerRepaint();
  }, [map, billboards]);

  return null;
}
