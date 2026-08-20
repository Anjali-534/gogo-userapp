import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import { MapView, Camera, UserLocation, PointAnnotation, ShapeSource, LineLayer, CircleLayer, SymbolLayer, Images, addCustomHeader, type PointAnnotationRef } from "@maplibre/maplibre-react-native";
import { fetchSanitizedOlaStyle, OLA_KEY } from "@/services/olamaps";
import { COLORS, RADIUS } from "@/constants/theme";

// Sprite ("/sprite" + ".json"/"@2x.png") and glyph ("/fonts/{stack}/{range}.pbf")
// requests are built by MapLibre Native via raw string concatenation onto
// the style's base "sprite"/"glyphs" URLs — an api_key query param baked
// into those base URLs (the way tile sources are keyed below) ends up
// appended *before* that suffix and gets mangled
// (".../sprite?api_key=xxx.json" - the ".json" becomes part of the key
// value, so the request 401s). Confirmed live: Ola's API also accepts the
// key via an `x-api-key` header, which MapLibre Native attaches to every
// request it issues regardless of URL shape — style.json, tile sources,
// sprite, and glyphs alike — so set it once, globally, at module load,
// before any MapView can issue a request.
addCustomHeader("x-api-key", OLA_KEY);

// Fetched (and sanitized) once per app session, not once per screen mount —
// every consumer of this component renders the same static style. On
// failure the promise is cleared (not cached) so the next mount/retry
// re-attempts the fetch instead of being stuck on a dead cached rejection.
let cachedStyle: object | null = null;
let stylePromise: Promise<object> | null = null;

function getSanitizedStyle(): Promise<object> {
  if (cachedStyle) return Promise.resolve(cachedStyle);
  if (!stylePromise) {
    stylePromise = fetchSanitizedOlaStyle()
      .then(style => { cachedStyle = style; return style; })
      .catch(err => { stylePromise = null; throw err; });
  }
  return stylePromise;
}

const DELHI = { lat: 28.6139, lng: 77.2090 };

// Web Mercator ground-resolution constants — used to convert a geographic
// (meters) circle radius into a MapLibre circleRadius (pixels) that still
// reads correctly at any zoom. See metersToPixelsAtZoom() below.
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const TILE_SIZE = 256;
const DENSITY_ZOOM_REF = 20;

// meters-per-pixel at a given zoom/latitude, standard Web Mercator formula
// (256px tiles): resolution = (2πR·cos(lat)) / (tileSize · 2^zoom).
// Converting a meters radius through this at a fixed reference zoom, then
// letting MapLibre interpolate the result exponentially (base 2) across
// zoom levels, exactly reproduces a real-world-sized circle at every zoom —
// halving zoom doubles meters-per-pixel, so doubling the pixel radius per
// zoom level (base-2 interpolation) cancels it out exactly.
function metersToPixelsAtZoom(meters: number, latitude: number, zoom: number): number {
  const metersPerPixel = (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / (TILE_SIZE * Math.pow(2, zoom));
  return meters / metersPerPixel;
}

// Never let a pickup/drop bounds-fit zoom out past this — buildings need
// z12+, POIs z11+ (confirmed against Ola's real style.json), so anything
// below ~13 renders as a bare line-drawing (roads + labels only, no fills/
// POIs). Distant pickup/drop pairs may not both stay in frame at this
// floor — an accepted tradeoff for a properly-rendered map.
const MIN_FIT_ZOOM = 13;

// Standard "zoom to fit a lat/lng bounding box in a pixel viewport" formula
// (the same one commonly used for Google Maps' fitBounds), ported to plain
// Web Mercator math so it works the same for MapLibre. Passed to Camera as
// an explicit centerCoordinate+zoomLevel instead of the `bounds` prop, so
// MIN_FIT_ZOOM can be enforced directly rather than assuming MapLibre
// Native's own bounds-fit respects a min-zoom constraint.
function latRad(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
  return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
}

function fitZoomForBounds(ne: LatLng, sw: LatLng, viewportPx: { width: number; height: number }): number {
  const WORLD_PX = 256;
  const ZOOM_MAX = 20;

  const latFraction = (latRad(ne.lat) - latRad(sw.lat)) / Math.PI;
  const lngDiff = ne.lng - sw.lng;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const zoomForDimension = (px: number, fraction: number) =>
    fraction > 0 ? Math.log2(px / WORLD_PX / fraction) : ZOOM_MAX;

  const latZoom = zoomForDimension(viewportPx.height, latFraction);
  const lngZoom = zoomForDimension(viewportPx.width, lngFraction);

  return Math.min(latZoom, lngZoom, ZOOM_MAX);
}

type LatLng = { lat: number; lng: number };

export type OlaMapMarker = {
  id: string;
  coordinate: LatLng;
  anchor?: { x: number; y: number };
  // Android renders a PointAnnotation's child into a static bitmap for the
  // native map layer — if that child contains an image that hasn't finished
  // decoding yet at snapshot time (e.g. a require()'d icon on first mount),
  // it can get captured blank and never redrawn. Passing a function instead
  // of a plain element hands the marker's own PointAnnotationRef.refresh()
  // down, so content that loads asynchronously (like <Image>) can force a
  // re-snapshot via its onLoad callback once it's actually ready.
  element: React.ReactElement | ((refresh: () => void) => React.ReactElement);
};

export type OlaDensityCell = { lat: number; lng: number; count: number };

// Icons registered once by name via `Images`, then referenced by feature
// property from a single ShapeSource+SymbolLayer — a native draw of a
// pre-registered bitmap, not a snapshot of a React view, so this whole
// marker type is structurally immune to the Android PointAnnotation
// bitmap-snapshot timing bug that required per-component onReady/refresh()
// workarounds (SearchVehicleIcon/DriverVehicleIcon/NearbyDriverIcon,
// removed in favor of this).
export type OlaIconMarker = {
  id: string;
  coordinate: LatLng;
  icon: string;   // key into the `iconImages` map passed to this component
  size: number;   // final iconSize multiplier — caller computes targetPx / the icon's native pixel width, since iconSize scales the registered bitmap's own resolution, not a fixed logical size
  rotate?: number; // degrees clockwise, viewport-aligned (matches the old CSS `rotate` transform's behavior, not map-aligned)
};

// Pickup/drop pins — a colored dot (CircleLayer) plus a 📍 glyph
// (SymbolLayer textField) instead of an image, since no pin/marker bitmap
// asset exists in this app; both are native draws, same bug-immunity as
// OlaIconMarker above.
export type OlaPinMarker = {
  id: string;
  coordinate: LatLng;
  color: string;
};

type Props = {
  location?: LatLng | null;
  zoomLevel?: number;
  marker?: React.ReactElement;
  // Renders several custom pins/icons at once (pickup/drop/vehicle, etc.) —
  // additive to the single `location`+`marker` pair above, not a replacement.
  markers?: OlaMapMarker[];
  // Polyline between two or more points (e.g. pickup -> drop).
  routeCoords?: LatLng[];
  routeColor?: string;
  routeDashed?: boolean;
  // When given (2+ points), the camera bounds to fit all of them instead of
  // centering on `location`/`zoomLevel`. Ignored while `followLocation` is set.
  fitTo?: LatLng[];
  fitPadding?: number;
  // Heading-locked follow camera (e.g. tracking a live driver position) —
  // takes priority over `fitTo` and the default location/zoomLevel camera
  // when present. Re-centers and rotates to `followHeading` on every change.
  followLocation?: LatLng;
  followHeading?: number;
  followZoom?: number;
  // Nearby-driver density cells — same shape as react-native-maps' Heatmap/
  // Circle fallback (radius = 300 + count*80 meters, opacity scaled by
  // count), rendered here as a MapLibre CircleLayer instead.
  densityCells?: OlaDensityCell[];
  // Registered once via `Images` — keys referenced by `iconMarkers[].icon`.
  // Only needs passing when `iconMarkers` is used.
  iconImages?: { [key: string]: any };
  // Vehicle-style icon markers (driver position, nearby-driver scatter,
  // searching-phase vehicle icon) — rendered as one ShapeSource+SymbolLayer,
  // additive to `markers` above, not a replacement (markers/PointAnnotation
  // still used for the address-label cards, which need rich View content
  // SymbolLayer can't render).
  iconMarkers?: OlaIconMarker[];
  // Pickup/drop pins — see OlaPinMarker.
  pinMarkers?: OlaPinMarker[];
  // Shows the device's own real GPS position (MapLibre's built-in "you are
  // here" puck) — unrelated to any `driver`/`markers` data. Meaningful on a
  // "where am I while waiting" screen (searching), meaningless and
  // confusable with a driver marker on a "where is my driver" screen
  // (active-ride) — default true to keep every existing caller's behavior
  // unchanged; active-ride explicitly opts out.
  showUserLocation?: boolean;
};

export default function OlaMapView({
  location, zoomLevel = 14, marker, markers, routeCoords, routeColor, routeDashed, fitTo, fitPadding = 60, densityCells,
  iconImages, iconMarkers, pinMarkers,
  followLocation, followHeading, followZoom = 16, showUserLocation = true,
}: Props) {
  const [style, setStyle] = useState<object | null>(cachedStyle);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const annotationRefs = useRef(new Map<string, PointAnnotationRef>()).current;

  // Camera.js only skips re-pushing a move to native when centerCoordinate/
  // heading are reference-stable across renders (its own nativeStop is a
  // useMemo keyed on those props) — an inline `[lng, lat]` array literal is
  // a *new* reference every render even when the numbers didn't change,
  // which re-triggers a native camera move (and cancels in-flight tile
  // requests for the view it's leaving) far more often than the data
  // actually changes. Memoizing on the primitive lat/lng/heading values
  // keeps the reference stable between identical polls.
  const followCenterCoord = useMemo(
    () => (followLocation ? [followLocation.lng, followLocation.lat] : undefined),
    [followLocation?.lat, followLocation?.lng]
  );
  // Same reasoning for the route line's GeoJSON shape — ShapeSource treats
  // a new `shape` object as new data to load, so keep it reference-stable
  // when the caller's routeCoords array itself hasn't changed.
  const routeShape = useMemo(
    () => (routeCoords && routeCoords.length >= 2
      ? { type: "LineString" as const, coordinates: routeCoords.map(p => [p.lng, p.lat]) }
      : undefined),
    [routeCoords]
  );
  // Same reasoning again for the bounds-fit camera — this used to only
  // matter pre-driver (a short-lived state), but "overview" mode (added
  // for the active-ride map's follow/overview toggle) can sit on `fitTo`
  // continuously while driver position polls every few seconds, so it
  // needs the same reference-stability treatment as follow mode got, or
  // it'd re-push a camera move (and cancel in-flight tiles) every render.
  const fitCamera = useMemo(() => {
    if (followLocation || !fitTo || fitTo.length < 2) return undefined;
    const lats = fitTo.map(p => p.lat);
    const lngs = fitTo.map(p => p.lng);
    const ne: LatLng = { lat: Math.max(...lats), lng: Math.max(...lngs) };
    const sw: LatLng = { lat: Math.min(...lats), lng: Math.min(...lngs) };

    const { width, height } = Dimensions.get("window");
    const viewportPx = {
      width:  Math.max(width  - fitPadding * 2, 40),
      height: Math.max(height - fitPadding * 2, 40),
    };

    return {
      center: [(ne.lng + sw.lng) / 2, (ne.lat + sw.lat) / 2] as [number, number],
      zoom: Math.max(fitZoomForBounds(ne, sw, viewportPx), MIN_FIT_ZOOM),
    };
  }, [followLocation, fitTo, fitPadding]);

  const load = useCallback(() => {
    setError(null);
    getSanitizedStyle()
      .then(setStyle)
      .catch(err => {
        console.error("[OlaMapView] failed to load map style", err);
        setError(err instanceof Error ? err.message : "Map style failed to load");
      });
  }, []);

  useEffect(() => {
    if (!style) load();
  }, [retryTick]);

  if (error) {
    return (
      <View style={[StyleSheet.absoluteFillObject, s.center]}>
        <Text style={s.errorText}>Map unavailable</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => setRetryTick(t => t + 1)} activeOpacity={0.8}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!style) {
    return (
      <View style={[StyleSheet.absoluteFillObject, s.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const center = location ?? DELHI;

  const densityFeatures = densityCells?.map((cell, i) => ({
    type: "Feature" as const,
    id: i,
    geometry: { type: "Point" as const, coordinates: [cell.lng, cell.lat] },
    properties: {
      pxAtZoomRef: metersToPixelsAtZoom(300 + cell.count * 80, cell.lat, DENSITY_ZOOM_REF),
      opacity: Math.min(0.15 + cell.count * 0.08, 0.55),
    },
  }));

  return (
    <MapView style={StyleSheet.absoluteFillObject} mapStyle={style}>
      {followCenterCoord ? (
        <Camera
          centerCoordinate={followCenterCoord}
          heading={followHeading ?? 0}
          zoomLevel={followZoom}
          animationDuration={1000}
        />
      ) : fitCamera ? (
        <Camera
          centerCoordinate={fitCamera.center}
          zoomLevel={fitCamera.zoom}
          animationDuration={600}
        />
      ) : (
        <Camera centerCoordinate={[center.lng, center.lat]} zoomLevel={zoomLevel} />
      )}
      <UserLocation visible={showUserLocation} />

      {iconImages && <Images images={iconImages} />}

      {densityFeatures && densityFeatures.length > 0 && (
        <ShapeSource
          id="ola-density-source"
          shape={{ type: "FeatureCollection", features: densityFeatures }}
        >
          <CircleLayer
            id="ola-density-circles"
            style={{
              circleRadius: ["interpolate", ["exponential", 2], ["zoom"], 0, 0, DENSITY_ZOOM_REF, ["get", "pxAtZoomRef"]],
              circleColor: "#FF6B2B",
              circleOpacity: ["get", "opacity"],
              circleStrokeWidth: 0,
            }}
          />
        </ShapeSource>
      )}

      {location && marker && (
        <PointAnnotation id="current-location" coordinate={[location.lng, location.lat]}>
          {marker}
        </PointAnnotation>
      )}

      {routeShape && (
        <ShapeSource
          id="ola-route-source"
          shape={routeShape}
        >
          <LineLayer
            id="ola-route-line"
            style={{
              lineColor: routeColor || COLORS.borderStrong,
              lineWidth: 3,
              lineCap: "round",
              lineJoin: "round",
              ...(routeDashed ? { lineDasharray: [2, 2] } : {}),
            }}
          />
        </ShapeSource>
      )}

      {pinMarkers && pinMarkers.length > 0 && (
        <ShapeSource
          id="ola-pins-source"
          shape={{
            type: "FeatureCollection",
            features: pinMarkers.map(p => ({
              type: "Feature" as const,
              id: p.id,
              geometry: { type: "Point" as const, coordinates: [p.coordinate.lng, p.coordinate.lat] },
              properties: { color: p.color },
            })),
          }}
        >
          {/* Colored dot for at-a-glance pickup(green)/drop(orange) coding,
              plus a 📍 glyph above it for the actual "pin" shape — both
              native draws (circle paint + text glyph), no bitmap asset or
              React-view snapshot involved. */}
          <CircleLayer
            id="ola-pin-dot"
            style={{ circleRadius: 5, circleColor: ["get", "color"], circleStrokeWidth: 2, circleStrokeColor: "#fff" }}
          />
          <SymbolLayer
            id="ola-pin-glyph"
            style={{
              textField: "📍",
              textSize: 26,
              textAnchor: "bottom",
              textOffset: [0, -0.3],
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </ShapeSource>
      )}

      {iconMarkers && iconMarkers.length > 0 && (
        <ShapeSource
          id="ola-icons-source"
          shape={{
            type: "FeatureCollection",
            features: iconMarkers.map(m => ({
              type: "Feature" as const,
              id: m.id,
              geometry: { type: "Point" as const, coordinates: [m.coordinate.lng, m.coordinate.lat] },
              properties: { icon: m.icon, size: m.size, rotate: m.rotate ?? 0 },
            })),
          }}
        >
          <SymbolLayer
            id="ola-icons-symbol"
            style={{
              iconImage: ["get", "icon"],
              iconSize: ["get", "size"],
              iconRotate: ["get", "rotate"],
              iconRotationAlignment: "viewport",
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
            }}
          />
        </ShapeSource>
      )}

      {markers?.map(m => (
        <PointAnnotation
          key={m.id}
          id={m.id}
          ref={(r: PointAnnotationRef | null) => {
            if (r) annotationRefs.set(m.id, r);
            else annotationRefs.delete(m.id);
          }}
          coordinate={[m.coordinate.lng, m.coordinate.lat]}
          anchor={m.anchor}
        >
          {typeof m.element === "function"
            ? m.element(() => annotationRefs.get(m.id)?.refresh())
            : m.element}
        </PointAnnotation>
      ))}
    </MapView>
  );
}

const s = StyleSheet.create({
  center:       { backgroundColor: COLORS.bgAlt, alignItems: "center", justifyContent: "center", gap: 10 },
  errorText:    { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  retryBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 16, paddingVertical: 8 },
  retryBtnText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
});
