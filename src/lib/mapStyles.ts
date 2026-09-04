export type MapStyleId = "streets" | "night";

/** MapLibre vector styles — same GL stack as Mapbox (used by Swiggy/Zomato-class apps). */
export const MAP_STYLES: Record<MapStyleId, { label: string; url: string }> = {
  streets: {
    label: "Streets",
    url: "https://tiles.openfreemap.org/styles/liberty",
  },
  night: {
    label: "Night",
    url: "https://tiles.openfreemap.org/styles/dark",
  },
};

export function mapStyleUrl(id: MapStyleId) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  if (id === "streets" && token) {
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${token}`;
  }
  return MAP_STYLES[id].url;
}
