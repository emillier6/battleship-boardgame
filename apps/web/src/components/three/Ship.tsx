import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useFBX } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Ship as ShipType, ShipKind } from "@battleship/shared";

const MODEL_PATHS: Record<ShipKind, string> = {
  carrier: "/models/carrier.fbx",
  battleship: "/models/battleship.fbx",
  cruiser: "/models/cruiser.fbx",
  submarine: "/models/submarine.fbx",
  destroyer: "/models/destroyer.fbx",
};

const SHIP_TINT: Record<ShipKind, string> = {
  carrier: "#bfa14a",
  battleship: "#7a8ba8",
  cruiser: "#5f8a7d",
  submarine: "#3e4a6e",
  destroyer: "#a85f4a",
};

Object.values(MODEL_PATHS).forEach((p) => useFBX.preload(p));

export interface ShipProps {
  ship: ShipType;
  origin?: [number, number, number];
  preview?: "valid" | "invalid" | null;
  onPointerDown?: (e: { stopPropagation: () => void }) => void;
}

interface FitInfo {
  scale: number;
  rotation: THREE.Euler;
  offset: THREE.Vector3;
}

type Axis = "x" | "y" | "z";
const MODEL_FRAME: Record<ShipKind, { length: Axis; up: Axis }> = {
  carrier: { length: "z", up: "y" },
  battleship: { length: "z", up: "y" },
  cruiser: { length: "z", up: "y" },
  submarine: { length: "y", up: "z" },
  destroyer: { length: "x", up: "y" },
};

const MODEL_SCALE_FUDGE: Record<ShipKind, number> = {
  carrier: 1,
  battleship: 1,
  cruiser: 1,
  submarine: 1,
  destroyer: 1,
};

const MODEL_EXTRA_ROLL_X: Record<ShipKind, number> = {
  carrier: 0,
  battleship: 0,
  cruiser: 0,
  submarine: 0,
  destroyer: Math.PI / 2,
};

const MODEL_EXTRA_ROLL_Y: Record<ShipKind, number> = {
  carrier: 0,
  battleship: 0,
  cruiser: 0,
  submarine: Math.PI,
  destroyer: 0,
};

function buildOrientationMatrix(lengthAxis: Axis, upAxis: Axis): THREE.Matrix4 {
  const l = new THREE.Vector3();
  l[lengthAxis] = 1;
  const u = new THREE.Vector3();
  u[upAxis] = 1;
  const s = new THREE.Vector3().crossVectors(l, u);
  return new THREE.Matrix4().makeBasis(l, u, s).transpose();
}

const BBOX_CORNERS = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 1, 0],
  [0, 1, 1],
  [1, 0, 0],
  [1, 0, 1],
  [1, 1, 0],
  [1, 1, 1],
] as const;

function computeFit(
  source: THREE.Object3D,
  shipLength: number,
  kind: ShipKind,
): FitInfo {
  const frame = MODEL_FRAME[kind];
  const baseOrient = buildOrientationMatrix(frame.length, frame.up);
  const rollX = MODEL_EXTRA_ROLL_X[kind];
  const rollY = MODEL_EXTRA_ROLL_Y[kind];
  const orient = baseOrient.clone();
  if (rollX !== 0) {
    orient.premultiply(new THREE.Matrix4().makeRotationX(rollX));
  }
  if (rollY !== 0) {
    orient.premultiply(new THREE.Matrix4().makeRotationY(rollY));
  }

  const bbox = new THREE.Box3().setFromObject(source);
  const rotated = new THREE.Box3();
  const corner = new THREE.Vector3();
  for (const [a, b, c] of BBOX_CORNERS) {
    corner.set(
      a ? bbox.max.x : bbox.min.x,
      b ? bbox.max.y : bbox.min.y,
      c ? bbox.max.z : bbox.min.z,
    );
    corner.applyMatrix4(orient);
    rotated.expandByPoint(corner);
  }

  const rSize = new THREE.Vector3();
  rotated.getSize(rSize);

  const scaleByLength = (shipLength * 0.9) / Math.max(rSize.x, 1e-6);
  const scaleByWidth = 0.85 / Math.max(rSize.z, 1e-6);
  const scale = Math.min(scaleByLength, scaleByWidth) * MODEL_SCALE_FUDGE[kind];

  const scaledMin = rotated.min.clone().multiplyScalar(scale);
  const scaledMax = rotated.max.clone().multiplyScalar(scale);
  const sCenter = scaledMin.clone().add(scaledMax).multiplyScalar(0.5);

  return {
    scale,
    rotation: new THREE.Euler().setFromRotationMatrix(orient),
    offset: new THREE.Vector3(-sCenter.x, -scaledMin.y, -sCenter.z),
  };
}

function useShipModel(kind: ShipKind, shipLength: number) {
  const source = useFBX(MODEL_PATHS[kind]);

  const fit = useMemo(
    () => computeFit(source, shipLength, kind),
    [source, shipLength, kind],
  );

  const cloned = useMemo(() => {
    const c = cloneSkeleton(source);
    const brighten = (m: THREE.Material) => {
      const cloned = m.clone();
      const std = cloned as THREE.MeshStandardMaterial;
      if ("color" in std && std.color) {
        std.color.multiplyScalar(1.6);
      }
      if ("roughness" in std) std.roughness = 0.55;
      if ("metalness" in std) std.metalness = 0.15;
      return cloned;
    };
    c.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if ((mesh as unknown as { isMesh?: boolean }).isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mesh.material = mat.map(brighten);
        } else if (mat) {
          mesh.material = brighten(mat as THREE.Material);
        }
      }
    });
    return c;
  }, [source]);

  return { model: cloned, fit };
}

function applyTint(
  model: THREE.Object3D,
  _baseTint: string,
  preview: ShipProps["preview"],
  sunk: boolean,
) {
  const emissiveHex =
    preview === "invalid"
      ? "#d24a4a"
      : preview === "valid"
        ? "#4adc7a"
        : sunk
          ? "#5a2424"
          : "#000000";
  const emissive = new THREE.Color(emissiveHex);
  const emissiveIntensity = preview ? 0.9 : sunk ? 0.6 : 0;
  const transparent = Boolean(preview) || sunk;
  const opacity = sunk ? 0.85 : preview ? 0.75 : 1;

  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((m) => {
      const std = m as THREE.MeshStandardMaterial;
      if (!std) return;
      if ("emissive" in std && std.emissive) {
        std.emissive.copy(emissive);
        std.emissiveIntensity = emissiveIntensity;
      }
      std.transparent = transparent;
      std.opacity = opacity;
      std.needsUpdate = true;
    });
  });
}

export function Ship({
  ship,
  origin = [0, 0, 0],
  preview = null,
  onPointerDown,
}: ShipProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sinkProgressRef = useRef(0);
  const wasSunkRef = useRef(ship.sunk);

  const { model, fit } = useShipModel(ship.kind, ship.length);

  const isH = ship.orientation === "H";
  const width = isH ? ship.length : 1;
  const depth = isH ? 1 : ship.length;
  const x = origin[0] + ship.origin.x + width / 2;
  const z = origin[2] + ship.origin.y + depth / 2;
  const y = origin[1] + 0.05;

  const baseTint = SHIP_TINT[ship.kind] ?? "#888";

  useEffect(() => {
    applyTint(model, baseTint, preview, ship.sunk);
  }, [model, baseTint, preview, ship.sunk]);

  useEffect(() => {
    if (ship.sunk && !wasSunkRef.current) {
      sinkProgressRef.current = 0;
    }
    wasSunkRef.current = ship.sunk;
  }, [ship.sunk]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (ship.sunk) {
      sinkProgressRef.current = Math.min(
        1,
        sinkProgressRef.current + delta * 0.5,
      );
    }
    const t = sinkProgressRef.current;
    groupRef.current.rotation.z = -0.6 * t;
    groupRef.current.position.y = y - 0.6 * t;
  });

  const yawForOrientation = isH ? 0 : Math.PI / 2;

  return (
    <group
      ref={groupRef}
      position={[x, y, z]}
      rotation={[0, yawForOrientation, 0]}
      onPointerDown={(e) => onPointerDown?.(e)}
    >
      <primitive
        object={model}
        scale={fit.scale}
        rotation={fit.rotation}
        position={[fit.offset.x, fit.offset.y, fit.offset.z]}
      />
    </group>
  );
}
