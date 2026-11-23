import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

/**
 * Panelde konum seçimi. Harita sağlayıcısı OpenStreetMap kutucuklarıdır (anahtar gerektirmez);
 * mobil uygulamadaki Google Maps'ten bağımsızdır. Haritaya dokunarak, işaretçiyi sürükleyerek
 * veya enlem/boylamı elle girerek konum seçilebilir.
 */
const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#E8590C;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const TURKEY_CENTER: [number, number] = [39.0, 35.0];

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function LocationPicker({
  latitude, longitude, onChange, error,
}: { latitude: number | null; longitude: number | null; onChange: (lat: number | null, lng: number | null) => void; error?: string }) {
  const [latText, setLatText] = useState(latitude?.toString() ?? '');
  const [lngText, setLngText] = useState(longitude?.toString() ?? '');
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    setLatText(latitude?.toString() ?? '');
    setLngText(longitude?.toString() ?? '');
  }, [latitude, longitude]);

  const pick = (lat: number, lng: number) => onChange(round6(lat), round6(lng));

  const applyManual = () => {
    const lat = Number(latText.replace(',', '.'));
    const lng = Number(lngText.replace(',', '.'));
    if (latText === '' && lngText === '') return onChange(null, null);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) pick(lat, lng);
  };

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) return setGeoError('Tarayıcınız konum özelliğini desteklemiyor.');
    navigator.geolocation.getCurrentPosition(
      (pos) => pick(pos.coords.latitude, pos.coords.longitude),
      () => setGeoError('Konum alınamadı. Haritaya dokunarak seçebilirsiniz.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="h-72 overflow-hidden rounded-lg border">
        <MapContainer
          center={latitude !== null && longitude !== null ? [latitude, longitude] : TURKEY_CENTER}
          zoom={latitude !== null ? 15 : 5}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={pick} />
          <Recenter lat={latitude} lng={longitude} />
          {latitude !== null && longitude !== null && (
            <Marker
              position={[latitude, longitude]}
              icon={markerIcon}
              draggable
              eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); pick(p.lat, p.lng); } }}
            />
          )}
        </MapContainer>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor="lat">Enlem</Label>
          <Input id="lat" inputMode="decimal" value={latText} onChange={(e) => setLatText(e.target.value)} onBlur={applyManual} placeholder="40.990300" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lng">Boylam</Label>
          <Input id="lng" inputMode="decimal" value={lngText} onChange={(e) => setLngText(e.target.value)} onBlur={applyManual} placeholder="29.029000" />
        </div>
        <Button type="button" variant="outline" className="self-end" onClick={useMyLocation}>
          <Crosshair /> Konumumu kullan
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Haritaya dokunun veya işaretçiyi sürükleyin.</p>
      {(error || geoError) && <p className="text-xs text-danger">{error ?? geoError}</p>}
    </div>
  );
}
