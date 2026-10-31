import type { City } from "../domain/types";

/** Legacy demo locations ONLY. New reports may be created anywhere, and this is never a whitelist. */
export const cities: City[] = [
  { id: "guwahati", name: "Guwahati", region: "Assam", country: "India", center: { lat: 26.1716, lng: 91.7606 }, radiusKm: 40 },
  { id: "shillong", name: "Shillong", region: "Meghalaya", country: "India", center: { lat: 25.5788, lng: 91.8933 }, radiusKm: 22 },
  { id: "jorhat", name: "Jorhat", region: "Assam", country: "India", center: { lat: 26.7509, lng: 94.2037 }, radiusKm: 25 },
  { id: "silchar", name: "Silchar", region: "Assam", country: "India", center: { lat: 24.8333, lng: 92.7789 }, radiusKm: 25 },
];
