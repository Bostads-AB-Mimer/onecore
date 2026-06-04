import platformDiagram from '../../../../docs/architecture/onecore-platform.mmd?raw'
import platformDoc from '../../../../docs/architecture/onecore-platform.md?raw'

import {
  frontendServiceMap,
  MarkdownRenderer,
  MermaidDiagram,
} from '@/features/documentation'

import { ViewLayout } from '@/shared/ui/layout'

export function DocumentationPage() {
  return (
    <ViewLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Dokumentation</h1>
        <p className="text-muted-foreground">
          Arkitekturöversikt och plattformsdokumentation för ONECore.
        </p>
      </div>

      <div className="mb-8">
        <MermaidDiagram
          chart={platformDiagram}
          focusOverrides={frontendServiceMap}
        />
      </div>

      <MarkdownRenderer source={platformDoc} />
    </ViewLayout>
  )
}
