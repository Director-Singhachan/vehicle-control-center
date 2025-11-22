import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Vehicle } from '../services';

interface MapWidgetProps {
  vehicles: Vehicle[];
  isDark: boolean;
}

export const MapWidget: React.FC<MapWidgetProps> = ({ vehicles, isDark }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    if (!mapContainer.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://demotiles.maplibre.org/style.json', // Free demo style
        center: [-74.0060, 40.7128], // NYC
        zoom: 11,
        attributionControl: false
      });

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  }, []);

  // Update markers when vehicles change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers (rudimentary way for this demo)
    // In a real app, we'd track marker instances.
    const markers = document.getElementsByClassName('map-marker');
    while(markers[0]) {
      markers[0].parentNode?.removeChild(markers[0]);
    }

    // Add simple markers
    vehicles.forEach(vehicle => {
      const color = vehicle.status === 'active' ? '#10b981' : 
                    vehicle.status === 'maintenance' ? '#ef4444' : '#fbbf24';
      
      const el = document.createElement('div');
      el.className = 'map-marker';
      el.style.backgroundColor = color;
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
      el.style.cursor = 'pointer';

      new maplibregl.Marker({ element: el })
        .setLngLat([vehicle.lng, vehicle.lat])
        .setPopup(new maplibregl.Popup({ offset: 25 })
          .setHTML(`<div style="color:#333; font-family:sans-serif; padding:4px;">
                      <strong style="font-size:14px;">${vehicle.name}</strong><br>
                      <span style="color:#666; font-size:12px; text-transform:capitalize;">${vehicle.status}</span>
                    </div>`))
        .addTo(map.current!);
    });

  }, [vehicles]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: '400px' }} />
      
      <div className="absolute top-4 left-4 bg-white/90 dark:bg-charcoal-900/90 backdrop-blur p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 z-10">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">คำอธิบาย</h4>
        <div className="space-y-1.5">
          <div className="flex items-center text-xs text-slate-700 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2"></span> ใช้งาน
          </div>
          <div className="flex items-center text-xs text-slate-700 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-2"></span> ว่าง
          </div>
          <div className="flex items-center text-xs text-slate-700 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2"></span> ซ่อมบำรุง
          </div>
        </div>
      </div>
    </div>
  );
};