"use client";

import type { LeafletMouseEvent } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";

type MapPickerProps = {
  latitude: number;
  longitude: number;
  zoom?: number;
  onChange: (latitude: number, longitude: number) => void;
};

type ClickHandlerProps = {
  onChange: (latitude: number, longitude: number) => void;
};

function ClickHandler({ onChange }: ClickHandlerProps) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onChange(event.latlng.lat, event.latlng.lng);
    }
  });

  return null;
}

export function MapPicker({ latitude, longitude, zoom = 13, onChange }: MapPickerProps) {
  const center: [number, number] = [latitude, longitude];

  return (
    <div className="overflow-hidden rounded border border-slate-300">
      <MapContainer key={`${latitude}:${longitude}`} center={center} zoom={zoom} scrollWheelZoom className="h-72 w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker center={center} pathOptions={{ color: "#2563eb", fillColor: "#2563eb" }} radius={8} />
        <ClickHandler onChange={onChange} />
      </MapContainer>
    </div>
  );
}
