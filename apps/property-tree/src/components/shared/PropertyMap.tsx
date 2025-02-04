import React, { useEffect, useRef, useState } from 'react'
import { geocodingQueue } from '@/utils/geocodingQueue'
import { Map as GeoMap } from 'maplibre-gl'
import { Expand, Minimize2 } from 'lucide-react'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer } from '@deck.gl/layers'
import 'maplibre-gl/dist/maplibre-gl.css'

import { Property } from '@/services/types'

interface PropertyMapProps {
  properties: Property[]
  companyName?: string
}

export function PropertyMap({ properties }: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<GeoMap | null>(null)

  const [propertyCoordinates, setPropertyCoordinates] = useState<
    Map<string, [number, number]>
  >(new Map())
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const processedProperties = new Set<string>()

    properties.forEach((property) => {
      if (processedProperties.has(property.id)) return

      const searchQuery = `${property.designation}, ${property.municipality}, Sweden`

      geocodingQueue.add(
        searchQuery,
        (coords) => {
          setPropertyCoordinates((prev) => {
            const newMap = new Map(prev)
            newMap.set(property.id, coords)
            return newMap
          })
        },
        (error) =>
          console.error(`Geocoding error for ${property.designation}:`, error)
      )

      processedProperties.add(property.id)
    })

    // Cleanup function to reset coordinates when properties change
    return () => {
      setPropertyCoordinates(new Map())
    }
  }, [properties])

  useEffect(() => {
    if (!mapContainer.current) return

    const initMap = () => {
      if (map.current) return

      try {
        map.current = new GeoMap({
          container: mapContainer.current!,
          style:
            'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [16.5455, 59.6099], // Västerås
          zoom: 11,
          maxZoom: 20,
          renderWorldCopies: false,
        })
      } catch (error) {
        console.error('Failed to initialize map:', error)
      }
    }

    // Try to init map after a short delay to ensure DOM is ready
    const timer = setTimeout(initMap, 100)

    return () => {
      clearTimeout(timer)
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [mapContainer.current])

  useEffect(() => {
    if (!map.current) return

    const points = properties
      .filter((property) => propertyCoordinates.has(property.id))
      .map((property) => ({
        position: propertyCoordinates.get(property.id)!,
        property: property,
      }))

    const deckOverlay = new MapboxOverlay({
      interleaved: true,
      layers: [
        new ScatterplotLayer({
          id: 'properties',
          data: points,
          getPosition: (d) => d.position,
          getFillColor: [65, 105, 225], // Royal blue
          getRadius: 300,
          pickable: true,
          onClick: (info) => {
            if (info.object && info.object.property) {
              console.log('Clicked property:', info.object.property.designation)
            }
          },
        }),
      ],
    })

    return () => {
      // remove something here?
    }
  }, [properties, propertyCoordinates])

  return (
    <div className="relative">
      <div
        ref={mapContainer}
        style={{ height: isExpanded ? '80vh' : '300px' }}
        className={`w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${
          isExpanded ? 'fixed top-4 left-4 right-4 z-50' : ''
        }`}
      />
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute top-2 right-2 p-2 bg-white rounded-md shadow-md hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 z-50"
        aria-label={isExpanded ? 'Minimize map' : 'Expand map'}
      >
        {isExpanded ? (
          <Minimize2 className="w-4 h-4" />
        ) : (
          <Expand className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}
