import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Location {
  name: string
  coordinates: [number, number]
  floor?: number
  color?: string
}

interface MapProps {
  locations: Location[]
  center: [number, number]
}

export function Map({ locations, center }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current) return

    const MAPTILER_KEY = 'PG6pJ2mVQ5TkHGTIkrfq'
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`,
      center: center,
      zoom: 17,
      pitch: 45,
      bearing: -17.6,
      maxZoom: 19,
      minZoom: 14,
      canvasContextAttributes: { antialias: true }
    })

    map.current.on('load', () => {
      if (!map.current) return

      // Find label layer to place buildings under it
      const layers = map.current.getStyle().layers
      let labelLayerId
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol' && layers[i].layout && 'text-field' in layers[i].layout) {
          labelLayerId = layers[i].id
          break
        }
      }

      // Add OpenMapTiles source
      map.current.addSource('openmaptiles', {
        url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}`,
        type: 'vector',
      })

      // Add 3D building layer
      map.current.addLayer(
        {
          'id': '3d-buildings',
          'source': 'openmaptiles',
          'source-layer': 'building',
          'type': 'fill-extrusion',
          'minzoom': 15,
          'filter': ['!=', ['get', 'hide_3d'], true],
          'paint': {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'render_height'],
              0, 'lightgray',
              200, 'royalblue',
              400, 'lightblue'
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              16,
              ['get', 'render_height']
            ],
            'fill-extrusion-base': [
              'case',
              ['>=', ['get', 'zoom'], 16],
              ['get', 'render_min_height'],
              0
            ]
          }
        },
        labelLayerId
      )
    })

    // Add markers and popups for each location
    locations.forEach((location) => {
      const el = document.createElement('div')
      el.className = 'marker'
      el.style.backgroundColor = location.color || '#4A5568'
      el.style.width = '20px'
      el.style.height = '20px'
      el.style.borderRadius = '50%'
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
      
      const floorHeight = location.floor || 0
      const heightOffset = floorHeight * 0.0001 // Adjust this value to change vertical spacing

      new maplibregl.Marker({
        element: el,
        offset: [0, -10],
      })
        .setLngLat([
          location.coordinates[0],
          location.coordinates[1] + heightOffset, // Offset latitude based on floor
        ])
        .setPopup(
          new maplibregl.Popup().setHTML(
            `<h3 class="text-sm font-semibold">${location.name}</h3>` +
            (location.floor ? `<p class="text-xs">Floor: ${location.floor}</p>` : '')
          )
        )
        .addTo(map.current)
    })

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    return () => {
      map.current?.remove()
    }
  }, [locations, center])

  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  )
}
