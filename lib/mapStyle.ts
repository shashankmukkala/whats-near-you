import type { ExpressionSpecification } from "maplibre-gl";

export const HYDERABAD_CENTER: [number, number] = [78.4867, 17.385];

// The map opens on the RP Road / Ram Nagar corridor in Secunderabad,
// where most of the pandals cluster — a generic city-centre default would
// open on a mostly-empty area. Zoomed out far enough to hold both that
// corridor and Khairatabad, which is the one pin most people arrive
// looking for.
export const DEFAULT_MAP_CENTER: [number, number] = [78.4955, 17.4235];
export const DEFAULT_PITCH = 55;
// Flat by default (see TopBar's is3D). Tilt makes clustered pins occlude
// each other, and three Ram Nagar pandals sit within ~200m.
export const DEFAULT_ZOOM = 13.2;
export const DEFAULT_BEARING = -17;

// Telangana viewport guard. MapLibre uses a rectangular camera boundary;
// this deliberately follows the state's outermost extent closely enough to
// keep the browsing experience inside Telangana without allowing a world
// wrap or a zoomed-out national view.
export const TELANGANA_BOUNDS: [[number, number], [number, number]] = [
  [77.15, 15.75],
  [81.45, 20.15],
];
export const TELANGANA_MIN_ZOOM = 8.65;
export const TELANGANA_MAX_ZOOM = 19;

export const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// Dark charcoal ramp, keyed off render_height, so taller buildings read as
// subtly lighter — the opposite direction from a light-theme map, where
// height reads as "darker" — so they still stand out with some depth
// instead of the map turning into a flat black wall of silhouettes.
export const BUILDING_HEIGHT_COLOR_RAMP: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "render_height"],
  0,
  "#28282c",
  15,
  "#313136",
  40,
  "#3a3a41",
  80,
  "#45454e",
  150,
  "#55555f",
];

export const BUILDING_LAYER_ID = "building-3d";

// Roads default to the "liberty" style's yellow/cream palette; overridden
// here to very faint, low-alpha whites (higher class = slightly more
// opaque, but even motorways stay subtle) so the road network reads as a
// quiet structural hint rather than a bright grid competing with the
// aurora backdrop and cafe pins for attention. Casings (the outline layers
// under major roads, orange #e9ac77 in the light style) are pushed even
// fainter than their road, and dropped almost to nothing for track/rail —
// present for edge definition at high zoom, invisible at a glance.
export const ROAD_LINE_COLOR_OVERRIDES: Record<string, string> = {
  road_motorway: "rgba(255,255,255,0.30)",
  road_trunk_primary: "rgba(255,255,255,0.30)",
  road_secondary_tertiary: "rgba(255,255,255,0.22)",
  road_minor: "rgba(255,255,255,0.15)",
  road_link: "rgba(255,255,255,0.22)",
  road_service_track: "rgba(255,255,255,0.08)",
  road_path_pedestrian: "rgba(255,255,255,0.10)",
  road_major_rail: "rgba(255,255,255,0.16)",
  road_transit_rail: "rgba(255,255,255,0.16)",
  road_motorway_casing: "rgba(255,255,255,0.06)",
  road_trunk_primary_casing: "rgba(255,255,255,0.06)",
  road_secondary_tertiary_casing: "rgba(255,255,255,0.06)",
  road_link_casing: "rgba(255,255,255,0.06)",
  road_motorway_link_casing: "rgba(255,255,255,0.06)",
  bridge_motorway: "rgba(255,255,255,0.30)",
  bridge_trunk_primary: "rgba(255,255,255,0.30)",
  bridge_secondary_tertiary: "rgba(255,255,255,0.22)",
  bridge_street: "rgba(255,255,255,0.15)",
  bridge_link: "rgba(255,255,255,0.22)",
  bridge_service_track: "rgba(255,255,255,0.08)",
  bridge_path_pedestrian: "rgba(255,255,255,0.10)",
  bridge_major_rail: "rgba(255,255,255,0.16)",
  bridge_transit_rail: "rgba(255,255,255,0.16)",
  bridge_motorway_casing: "rgba(255,255,255,0.06)",
  bridge_trunk_primary_casing: "rgba(255,255,255,0.06)",
  bridge_secondary_tertiary_casing: "rgba(255,255,255,0.06)",
  bridge_link_casing: "rgba(255,255,255,0.06)",
  bridge_motorway_link_casing: "rgba(255,255,255,0.06)",
  tunnel_motorway: "rgba(255,255,255,0.30)",
  tunnel_trunk_primary: "rgba(255,255,255,0.30)",
  tunnel_secondary_tertiary: "rgba(255,255,255,0.22)",
  tunnel_minor: "rgba(255,255,255,0.15)",
  tunnel_link: "rgba(255,255,255,0.22)",
  tunnel_service_track: "rgba(255,255,255,0.08)",
  tunnel_path_pedestrian: "rgba(255,255,255,0.10)",
  tunnel_major_rail: "rgba(255,255,255,0.16)",
  tunnel_transit_rail: "rgba(255,255,255,0.16)",
  tunnel_motorway_casing: "rgba(255,255,255,0.06)",
  tunnel_trunk_primary_casing: "rgba(255,255,255,0.06)",
  tunnel_secondary_tertiary_casing: "rgba(255,255,255,0.06)",
  tunnel_link_casing: "rgba(255,255,255,0.06)",
  tunnel_motorway_link_casing: "rgba(255,255,255,0.06)",
};

// Matches the page's cream ground, so the seam between map and page does
// not read as two different whites. This was near-black while the map was
// dark-restyled at runtime; the ramp and road overrides above are from
// that era and are no longer applied — see the note in components/Map.tsx
// for why they are kept rather than deleted.
export const MAP_BACKGROUND_COLOR = "#fdf3e0";

// General-interest POI layers in OpenFreeMap's "liberty" style
// (poi_r1/r7/r20, source-layer "poi") render every OSM point of interest
// — hospitals, pharmacies, shops, restaurants, banks, places of worship,
// and so on. Far too busy under a curated layer, so they are narrowed to
// transit stations, notable landmarks, and parks.
// "place_of_worship" is deliberately excluded, for the same reason the
// cafe map excluded "cafe": PlaceMarkers is the curated layer for what
// this map is about, and OSM's unmoderated temple pins sitting underneath
// would compete with it — a visitor cannot tell which pins were checked
// by a person and which were not.
// Water/lake features aren't POIs at all (they're the always-on "water" fill
// layer), so they're unaffected by this and don't need listing here.
export const KEEP_POI_CLASSES = [
  "railway",
  "bus",
  "airport",
  "monument",
  "memorial",
  "museum",
  "attraction",
  "art_gallery",
  "park",
  "garden",
];

export const GENERAL_POI_LAYER_IDS = ["poi_r1", "poi_r7", "poi_r20"];
